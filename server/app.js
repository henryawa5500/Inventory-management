import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { pool, withTransaction } from './db.js'

const app = express()
const roles = ['owner', 'manager', 'staff']
const roleSchema = z.enum(roles)
const uuidSchema = z.string().uuid()
const jsonObject = z.record(z.string(), z.unknown())
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 2 * 1024 * 1024
const accessCookie = 'dqueens_access'
const refreshCookie = 'dqueens_refresh'
const accessTokenLifetimeMs = 7 * 24 * 60 * 60 * 1000
const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (!origin || allowed.includes(origin)) return callback(null, true)
    return callback(new Error('This origin is not permitted by CORS.'))
  },
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json({ limit: '4mb' }))

app.use((request, _response, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !request.get('origin')) return next()
  const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
  if (!allowed.includes(request.get('origin'))) return next(httpError(403, 'This origin is not permitted.'))
  next()
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function requireEnvironment() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.')
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
}

function signToken(user) {
  requireEnvironment()
  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '7d', issuer: 'dqueens-api', audience: 'dqueens-app' },
  )
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    businessId: row.business_id,
    businessName: row.business_name,
    username: row.username,
    password: '',
    role: row.role,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function cookieOptions(path, maxAge) {
  const sameSite = process.env.COOKIE_SAME_SITE ?? 'lax'
  const secure = process.env.NODE_ENV === 'production' || sameSite === 'none'
  return { httpOnly: true, secure, sameSite, path, maxAge }
}

function refreshHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function createSession(response, user, executor = pool) {
  const accessToken = signToken(user)
  const refreshToken = crypto.randomBytes(32).toString('base64url')
  await executor.query(
    `INSERT INTO app_refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [user.id, refreshHash(refreshToken)],
  )
  response.cookie(accessCookie, accessToken, cookieOptions('/', accessTokenLifetimeMs))
  response.cookie(refreshCookie, refreshToken, cookieOptions('/api/auth', refreshTokenLifetimeMs))
}

function clearSessionCookies(response) {
  response.clearCookie(accessCookie, cookieOptions('/', 0))
  response.clearCookie(refreshCookie, cookieOptions('/api/auth', 0))
}

async function authenticate(request, response, next) {
  try {
    const token = request.cookies?.[accessCookie] ?? request.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw httpError(401, 'Sign in is required.')
    requireEnvironment()
    const claims = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'dqueens-api',
      audience: 'dqueens-app',
    })
    if (typeof claims === 'string' || typeof claims.sub !== 'string') throw httpError(401, 'Invalid session.')
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.username, u.role, u.is_active, u.created_at,
              u.business_id, b.name AS business_name
       FROM app_users u JOIN app_businesses b ON b.id = u.business_id
       WHERE u.id = $1`,
      [claims.sub],
    )
    const user = result.rows[0]
    if (!user?.is_active) throw httpError(401, 'This account is inactive. Contact the owner.')
    request.user = publicUser(user)
    next()
  } catch (error) {
    next(error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError
      ? httpError(401, 'Your session is invalid or expired. Sign in again.')
      : error)
  }
}

function permit(...allowedRoles) {
  return (request, _response, next) => {
    if (!allowedRoles.includes(request.user.role)) return next(httpError(403, 'Your role cannot perform this action.'))
    next()
  }
}

function validate(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) throw httpError(400, result.error.issues.map((issue) => issue.message).join('; '))
  return result.data
}

const accountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  username: z.string().trim().min(3).max(64),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  password: z.string().min(12).max(128),
})

const actionSchema = z.object({
  clientUuid: uuidSchema,
  deviceId: z.string().trim().min(1).max(128),
  createdAtClient: z.string().datetime({ offset: true }),
  type: z.enum([
    'item.upsert',
    'item.archive',
    'item.delete',
    'category.save',
    'sale.confirm',
    'sale.void',
    'stock.purchase',
    'stock.adjustment',
    'settings.update',
    'notifications.read',
  ]),
  payload: jsonObject,
})

function dateString(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw httpError(400, 'A valid action timestamp is required.')
  return date
}

function safeInteger(value, label, { min = 0, max = 2_000_000_000 } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw httpError(400, `${label} must be a whole number from ${min} to ${max}.`)
  }
  return value
}

async function publish(client, businessId, entityType, entityId, payload) {
  await client.query('SELECT pg_advisory_xact_lock(827365)')
  await client.query(
    `INSERT INTO app_change_log (business_id, entity_type, entity_id, payload)
     VALUES ($1, $2, $3, $4)`,
    [businessId, entityType, entityId, payload],
  )
}

async function logActivity(client, actor, action, what, oldValue = '', newValue = '') {
  const result = await client.query(
    `INSERT INTO app_activity_log
       (business_id, user_id, user_name, user_role, action, what, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, user_name, user_role, action, what, old_value, new_value, created_at`,
    [actor.businessId, actor.id, actor.name, actor.role, action, what, oldValue, newValue],
  )
  const row = result.rows[0]
  const entry = {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    what: row.what,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at.toISOString(),
  }
  const notificationResult = await client.query(
    `INSERT INTO app_notifications (business_id, audit_entry_id, action, what, user_name, user_role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [actor.businessId, row.id, action, what, actor.name, actor.role],
  )
  const notificationRow = notificationResult.rows[0]
  await publish(client, actor.businessId, 'activity', entry.id, entry)
  await publish(client, actor.businessId, 'notification', notificationRow.id, {
    id: notificationRow.id,
    auditEntryId: entry.id,
    action,
    what,
    userName: actor.name,
    userRole: actor.role,
    createdAt: notificationRow.created_at.toISOString(),
  })
  return entry
}

async function getItem(client, id, businessId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT i.* FROM app_items i WHERE i.id = $1 AND i.business_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [id, businessId],
  )
  return result.rows[0]
}

function mapItem(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    baseUnit: row.base_unit,
    packSize: row.pack_size,
    trackStock: row.track_stock,
    costPriceKobo: row.cost_price_kobo,
    reorderLevel: row.reorder_level,
    pricePoints: row.price_points,
    archived: row.archived,
    ...(row.has_image ? { photo: `/api/items/${encodeURIComponent(row.id)}/image` } : row.photo_url ? { photo: row.photo_url } : {}),
    createdAt: row.created_at.toISOString(),
  }
}

async function currentQuantity(client, itemId, businessId) {
  const result = await client.query(
    'SELECT COALESCE(SUM(quantity_delta), 0)::integer AS quantity FROM app_stock_events WHERE item_id = $1 AND business_id = $2',
    [itemId, businessId],
  )
  return result.rows[0].quantity
}

async function recordStockEvent(client, { action, actor, item, eventType, quantityDelta, description, unitCostKobo }) {
  safeInteger(Math.abs(quantityDelta), 'Stock change', { min: 1 })
  await client.query('SELECT id FROM app_items WHERE id = $1 AND business_id = $2 FOR UPDATE', [item.id, actor.businessId])
  const priorQuantity = await currentQuantity(client, item.id, actor.businessId)
  const id = crypto.randomUUID()
  const result = await client.query(
    `INSERT INTO app_stock_events
       (id, business_id, client_uuid, item_id, event_type, quantity_delta, description, actor_user_id,
        device_id, unit_cost_kobo, created_at_client)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, item_id, event_type, quantity_delta, description, actor_user_id,
               unit_cost_kobo, created_at_server`,
    [
      id,
      actor.businessId,
      action.clientUuid,
      item.id,
      eventType,
      quantityDelta,
      description,
      actor.id,
      action.deviceId,
      unitCostKobo ?? null,
      dateString(action.createdAtClient),
    ],
  )
  const row = result.rows[0]
  const movement = {
    id: row.id,
    itemId: row.item_id,
    itemName: item.name,
    type: row.event_type,
    quantityChange: row.quantity_delta,
    description: row.description,
    createdAt: row.created_at_server.toISOString(),
    userId: row.actor_user_id,
    ...(row.unit_cost_kobo !== null ? { unitCostKobo: row.unit_cost_kobo } : {}),
  }
  const nextQuantity = priorQuantity + quantityDelta
  await publish(client, actor.businessId, 'stockEvent', movement.id, movement)
  if (nextQuantity < 0) {
    await logActivity(client, actor, 'Stock review required', item.name, `${priorQuantity} units`, `${nextQuantity} units after offline sale`)
  } else if (item.track_stock && priorQuantity > item.reorder_level && nextQuantity <= item.reorder_level) {
    await logActivity(client, actor, 'Low stock', item.name, `${priorQuantity} units`, `${nextQuantity} units (reorder level ${item.reorder_level})`)
  }
  return movement
}

function parseImage(photo) {
  if (typeof photo !== 'string' || !photo.startsWith('data:')) return undefined
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(photo)
  if (!match || !allowedImageTypes.has(match[1])) throw httpError(400, 'Item images must be JPG, PNG or WebP.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length === 0 || bytes.length > maxImageBytes) throw httpError(413, 'Compressed item images must be 2 MB or smaller.')
  return { contentType: match[1], bytes }
}

function actionPayloadForStorage(payload) {
  const stored = structuredClone(payload)
  const item = stored.item
  if (typeof item?.photo === 'string' && item.photo.startsWith('data:')) {
    item.photo = '[image stored in app_item_images]'
  }
  return stored
}

async function applyAction(client, action, actor) {
  const payload = action.payload
  switch (action.type) {
    case 'item.upsert': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can edit inventory.')
      const item = validate(z.object({
        id: z.string().min(1).max(128),
        name: z.string().trim().min(1).max(160),
        categoryId: z.string().min(1).max(128),
        categoryName: z.string().trim().min(1).max(120),
        baseUnit: z.string().trim().min(1).max(64),
        packSize: z.number().int().positive(),
        trackStock: z.boolean(),
        costPriceKobo: z.number().int().nonnegative(),
        reorderLevel: z.number().int().nonnegative(),
        pricePoints: z.array(z.object({
          id: z.string().min(1).max(128),
          label: z.string().trim().min(1).max(80),
          priceKobo: z.number().int().nonnegative(),
          baseUnitsUsed: z.number().int().positive(),
        })).max(100),
        archived: z.boolean().optional(),
        photo: z.string().max(3_000_000).optional(),
      }), payload.item)
      const old = await getItem(client, item.id, actor.businessId, { lock: true })
      if (!old) {
        const itemIdCollision = await client.query('SELECT 1 FROM app_items WHERE id = $1', [item.id])
        if (itemIdCollision.rowCount) throw httpError(409, 'This item ID is already used by another business. Please retry.')
      }
      const previousImage = old ? await client.query(
        'SELECT 1 FROM app_item_images WHERE item_id = $1 AND business_id = $2',
        [item.id, actor.businessId],
      ) : null
      const categoryName = item.categoryName.trim()
      await client.query(
        `INSERT INTO app_categories (business_id, id, name)
         VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [actor.businessId, item.categoryId, categoryName],
      )
      const category = await client.query(
        'SELECT id FROM app_categories WHERE id = $1 AND business_id = $2',
        [item.categoryId, actor.businessId],
      )
      if (!category.rowCount) throw httpError(409, 'This category is not part of your business.')
      const photo = parseImage(item.photo)
      await client.query(
        `INSERT INTO app_items
           (id, business_id, name, category_id, category_name, base_unit, pack_size, track_stock, cost_price_kobo,
            reorder_level, price_points, archived, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, category_id = EXCLUDED.category_id, category_name = EXCLUDED.category_name,
           base_unit = EXCLUDED.base_unit, pack_size = EXCLUDED.pack_size, track_stock = EXCLUDED.track_stock,
           cost_price_kobo = EXCLUDED.cost_price_kobo, reorder_level = EXCLUDED.reorder_level,
           price_points = EXCLUDED.price_points, archived = EXCLUDED.archived, updated_at = now()
         WHERE app_items.business_id = EXCLUDED.business_id`,
        [
          item.id,
          actor.businessId,
          item.name,
          item.categoryId,
          categoryName,
          item.baseUnit,
          item.packSize,
          item.trackStock,
          item.costPriceKobo,
          item.reorderLevel,
          JSON.stringify(item.pricePoints),
          item.archived ?? false,
        ],
      )
      if (photo) {
        await client.query('UPDATE app_items SET photo_url = NULL WHERE id = $1 AND business_id = $2', [item.id, actor.businessId])
        await client.query(
          `INSERT INTO app_item_images (item_id, business_id, content_type, image_data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id) DO UPDATE SET
             content_type = EXCLUDED.content_type, image_data = EXCLUDED.image_data, updated_at = now()`,
          [item.id, actor.businessId, photo.contentType, photo.bytes],
        )
      } else if (item.photo === '') {
        await client.query('DELETE FROM app_item_images WHERE item_id = $1 AND business_id = $2', [item.id, actor.businessId])
        await client.query('UPDATE app_items SET photo_url = NULL WHERE id = $1 AND business_id = $2', [item.id, actor.businessId])
      } else if (item.photo?.startsWith('https://')) {
        await client.query('DELETE FROM app_item_images WHERE item_id = $1 AND business_id = $2', [item.id, actor.businessId])
        await client.query('UPDATE app_items SET photo_url = $2 WHERE id = $1 AND business_id = $3', [item.id, item.photo, actor.businessId])
      }
      const saved = await client.query(
        `SELECT i.*, EXISTS(SELECT 1 FROM app_item_images im WHERE im.item_id = i.id) AS has_image
         FROM app_items i WHERE i.id = $1 AND i.business_id = $2`,
        [item.id, actor.businessId],
      )
      if (!saved.rowCount) throw httpError(409, 'This item ID is already used by another business. Please retry.')
      const mapped = mapItem(saved.rows[0])
      const oldValue = old ? JSON.stringify({ name: old.name, pricePoints: old.price_points, reorderLevel: old.reorder_level }) : 'Not available'
      const newValue = JSON.stringify({ name: mapped.name, pricePoints: mapped.pricePoints, reorderLevel: mapped.reorderLevel })
      await logActivity(client, actor, old ? 'Updated item' : 'Created item', mapped.name, oldValue, newValue)
      const imageChanged = Boolean(photo) || item.photo === '' || item.photo?.startsWith('https://')
      if (imageChanged) {
        await logActivity(
          client,
          actor,
          old ? 'Updated item image' : 'Added item image',
          mapped.name,
          previousImage?.rowCount ? 'Image present' : 'No image',
          mapped.photo ? 'Image present' : 'No image',
        )
      }
      await publish(client, actor.businessId, 'item', mapped.id, mapped)
      return mapped
    }
    case 'item.archive': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can archive inventory.')
      const id = validate(z.string().min(1).max(128), payload.itemId)
      const old = await getItem(client, id, actor.businessId, { lock: true })
      if (!old) throw httpError(404, 'Item not found.')
      await client.query('UPDATE app_items SET archived = true, updated_at = now() WHERE id = $1 AND business_id = $2', [id, actor.businessId])
      await logActivity(client, actor, 'Archived item', old.name, 'Active', 'Archived')
      const saved = await client.query(
        `SELECT i.*, EXISTS(SELECT 1 FROM app_item_images im WHERE im.item_id = i.id) AS has_image
         FROM app_items i WHERE i.id = $1 AND i.business_id = $2`,
        [id, actor.businessId],
      )
      const item = mapItem(saved.rows[0])
      await publish(client, actor.businessId, 'item', id, item)
      return item
    }
    case 'item.delete': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can remove inventory.')
      const id = validate(z.string().min(1).max(128), payload.itemId)
      const old = await getItem(client, id, actor.businessId, { lock: true })
      if (!old) throw httpError(404, 'Item not found.')
      const history = await client.query(
        `SELECT EXISTS (SELECT 1 FROM app_sale_items WHERE item_id = $1 AND business_id = $2)
          OR EXISTS (SELECT 1 FROM app_stock_events WHERE item_id = $1 AND business_id = $2) AS has_history`,
        [id, actor.businessId],
      )
      if (history.rows[0].has_history) throw httpError(409, 'This item has history. Archive it instead to preserve records.')
      await client.query('DELETE FROM app_items WHERE id = $1 AND business_id = $2', [id, actor.businessId])
      await logActivity(client, actor, 'Deleted item', old.name, 'Available', 'Deleted')
      await publish(client, actor.businessId, 'item.deleted', id, { id })
      return { id }
    }
    case 'category.save': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can manage categories.')
      const category = validate(z.object({
        id: z.string().min(1).max(128),
        name: z.string().trim().min(1).max(120),
        sortOrder: z.number().int().min(0).max(100_000),
      }), payload.category)
      const old = await client.query(
        'SELECT id FROM app_categories WHERE id = $1 AND business_id = $2',
        [category.id, actor.businessId],
      )
      await client.query(
        `INSERT INTO app_categories (business_id, id, name, sort_order)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()`,
        [actor.businessId, category.id, category.name, category.sortOrder],
      )
      const savedCategory = await client.query(
        'SELECT id FROM app_categories WHERE id = $1 AND business_id = $2',
        [category.id, actor.businessId],
      )
      if (!savedCategory.rowCount) throw httpError(409, 'This category ID is already used by another business.')
      await logActivity(client, actor, old.rowCount ? 'Updated category' : 'Created category', category.name)
      await publish(client, actor.businessId, 'category', category.id, category)
      return category
    }
    case 'sale.confirm': {
      if (!['owner', 'staff'].includes(actor.role)) throw httpError(403, 'Only owners and staff can record sales.')
      const lines = validate(z.array(z.object({
        itemId: z.string().min(1).max(128),
        itemName: z.string().min(1).max(160),
        pricePointId: z.string().min(1).max(128),
        pricePointLabel: z.string().min(1).max(80),
        quantity: z.number().int().positive(),
        unitPriceKobo: z.number().int().nonnegative(),
        baseUnitsDeducted: z.number().int().positive(),
        totalKobo: z.number().int().nonnegative(),
      })).min(1).max(100), payload.lines)
      let total = 0
      const quantities = new Map()
      for (const line of lines) {
        if (line.totalKobo !== line.quantity * line.unitPriceKobo) throw httpError(400, `Invalid total for ${line.itemName}.`)
        total += line.totalKobo
        const item = await getItem(client, line.itemId, actor.businessId)
        if (!item || item.archived) throw httpError(409, `${line.itemName} is no longer available.`)
        quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity * line.baseUnitsDeducted)
      }
      safeInteger(total, 'Sale total', { max: Number.MAX_SAFE_INTEGER })
      const saleId = action.clientUuid
      const createdAt = dateString(action.createdAtClient)
      await client.query(
        `INSERT INTO app_sales (id, business_id, client_uuid, staff_id, staff_name, total_kobo, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [saleId, actor.businessId, action.clientUuid, actor.id, actor.name, total, createdAt],
      )
      const saleLines = []
      for (const [index, line] of lines.entries()) {
        const lineId = `${saleId}:${index}`
        await client.query(
          `INSERT INTO app_sale_items
             (id, business_id, sale_id, item_id, item_name, price_point_id, price_point_label,
              quantity, unit_price_kobo, base_units_deducted, total_kobo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [lineId, actor.businessId, saleId, line.itemId, line.itemName, line.pricePointId, line.pricePointLabel,
            line.quantity, line.unitPriceKobo, line.baseUnitsDeducted, line.totalKobo],
        )
        saleLines.push({ ...line })
      }
      const sale = {
        id: saleId,
        staffId: actor.id,
        staffName: actor.name,
        createdAt: createdAt.toISOString(),
        totalKobo: total,
        status: 'synced',
        lines: saleLines,
      }
      for (const [itemId, quantity] of [...quantities].sort(([left], [right]) => left.localeCompare(right))) {
        const item = await getItem(client, itemId, actor.businessId)
        if (item.track_stock) {
          await recordStockEvent(client, {
            action,
            actor,
            item,
            eventType: 'sale',
            quantityDelta: -quantity,
            description: `Sale ${saleId}`,
          })
        }
      }
      await logActivity(client, actor, 'Confirmed sale', saleId, 'Pending sync', `${lines.length} line items · ${total} kobo`)
      await publish(client, actor.businessId, 'sale', saleId, sale)
      return sale
    }
    case 'sale.void': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can void a sale.')
      const input = validate(z.object({
        saleId: z.string().min(1).max(128),
        reason: z.string().trim().max(500).default('No reason supplied'),
      }), payload)
      const saleResult = await client.query(
        `SELECT id, staff_id, staff_name, total_kobo, created_at, voided_at, void_reason
         FROM app_sales WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [input.saleId, actor.businessId],
      )
      const saleRow = saleResult.rows[0]
      if (!saleRow) throw httpError(404, 'Sale not found.')
      if (saleRow.voided_at) return { id: saleRow.id, status: 'voided', voidReason: saleRow.void_reason }
      const quantities = await client.query(
        `SELECT item_id, item_name, SUM(quantity * base_units_deducted)::integer AS quantity
         FROM app_sale_items WHERE sale_id = $1 AND business_id = $2 GROUP BY item_id, item_name ORDER BY item_id`,
        [saleRow.id, actor.businessId],
      )
      for (const row of quantities.rows) {
        const item = await getItem(client, row.item_id, actor.businessId)
        if (item?.track_stock) {
          await recordStockEvent(client, {
            action,
            actor,
            item,
            eventType: 'adjustment',
            quantityDelta: row.quantity,
            description: `Voided sale ${saleRow.id}`,
          })
        }
      }
      const reason = input.reason || 'No reason supplied'
      await client.query(
        'UPDATE app_sales SET voided_at = now(), void_reason = $2 WHERE id = $1 AND business_id = $3',
        [saleRow.id, reason, actor.businessId],
      )
      await logActivity(client, actor, 'Voided sale', saleRow.id, 'Active', reason)
      const items = await client.query(
        `SELECT item_id, item_name, price_point_id, price_point_label, quantity,
                unit_price_kobo, base_units_deducted, total_kobo
         FROM app_sale_items WHERE sale_id = $1 AND business_id = $2 ORDER BY id`,
        [saleRow.id, actor.businessId],
      )
      const sale = {
        id: saleRow.id,
        staffId: saleRow.staff_id,
        staffName: saleRow.staff_name,
        createdAt: saleRow.created_at.toISOString(),
        totalKobo: Number(saleRow.total_kobo),
        status: 'voided',
        voidReason: reason,
        lines: items.rows.map((row) => ({
          itemId: row.item_id,
          itemName: row.item_name,
          pricePointId: row.price_point_id,
          pricePointLabel: row.price_point_label,
          quantity: row.quantity,
          unitPriceKobo: row.unit_price_kobo,
          baseUnitsDeducted: row.base_units_deducted,
          totalKobo: Number(row.total_kobo),
        })),
      }
      await publish(client, actor.businessId, 'sale', sale.id, sale)
      return sale
    }
    case 'stock.purchase':
    case 'stock.adjustment': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can change stock.')
      const input = validate(z.object({
        itemId: z.string().min(1).max(128),
        quantityDelta: z.number().int().refine((value) => value !== 0),
        description: z.string().trim().min(1).max(500),
        unitCostKobo: z.number().int().nonnegative().optional(),
      }), payload)
      if (action.type === 'stock.purchase' && input.quantityDelta < 1) throw httpError(400, 'Stock purchases must add a positive quantity.')
      const item = await getItem(client, input.itemId, actor.businessId)
      if (!item) throw httpError(404, 'Item not found.')
      if (!item.track_stock) throw httpError(409, 'Stock tracking is disabled for this item.')
      const movement = await recordStockEvent(client, {
        action,
        actor,
        item,
        eventType: action.type === 'stock.purchase' ? 'purchase' : 'adjustment',
        quantityDelta: input.quantityDelta,
        description: input.description,
        unitCostKobo: input.unitCostKobo,
      })
      await logActivity(
        client,
        actor,
        action.type === 'stock.purchase' ? 'Added stock' : 'Adjusted stock',
        item.name,
        `${(await currentQuantity(client, item.id, actor.businessId)) - input.quantityDelta} units`,
        `${await currentQuantity(client, item.id, actor.businessId)} units · ${input.description}`,
      )
      return movement
    }
    case 'settings.update': {
      if (actor.role !== 'owner') throw httpError(403, 'Only the owner can change business settings.')
      const settings = validate(z.record(z.string(), z.unknown()), payload.settings)
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO app_settings (business_id, key, value) VALUES ($1, $2, $3)
           ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [actor.businessId, key, value],
        )
        if (key === 'businessName' && typeof value === 'string') {
          await client.query('UPDATE app_businesses SET name = $2 WHERE id = $1', [actor.businessId, value])
        }
      }
      await logActivity(client, actor, 'Updated business settings', 'Business settings')
      await publish(client, actor.businessId, 'settings', 'business', settings)
      return settings
    }
    case 'notifications.read': {
      if (!['owner', 'manager'].includes(actor.role)) throw httpError(403, 'Only owners and managers can mark notifications read.')
      const updated = await client.query(
        `UPDATE app_notifications SET read_at = COALESCE(read_at, now())
         WHERE read_at IS NULL AND business_id = $1
         RETURNING id, audit_entry_id, action, what, user_name, user_role, created_at, read_at`,
        [actor.businessId],
      )
      for (const row of updated.rows) {
        await publish(client, actor.businessId, 'notification', row.id, {
          id: row.id,
          auditEntryId: row.audit_entry_id,
          action: row.action,
          what: row.what,
          userName: row.user_name,
          userRole: row.user_role,
          createdAt: row.created_at.toISOString(),
          readAt: row.read_at.toISOString(),
        })
      }
      return { markedRead: updated.rowCount }
    }
    default:
      throw httpError(400, 'Unsupported sync action.')
  }
}

async function pushOne(actionInput, actor) {
  const action = validate(actionSchema, actionInput)
  return await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [action.clientUuid])
    const existing = await client.query(
      'SELECT business_id, user_id, accepted, result, rejection_reason FROM app_sync_actions WHERE client_uuid = $1',
      [action.clientUuid],
    )
    if (existing.rowCount) {
      const prior = existing.rows[0]
      if (prior.business_id !== actor.businessId || prior.user_id !== actor.id) {
        return { clientUuid: action.clientUuid, accepted: false, error: 'This action ID is already associated with another account.' }
      }
      return {
        clientUuid: action.clientUuid,
        accepted: prior.accepted,
        result: prior.result,
        ...(prior.rejection_reason ? { error: prior.rejection_reason } : {}),
        duplicate: true,
      }
    }
    await client.query('SAVEPOINT action_attempt')
    try {
      const value = await applyAction(client, action, actor)
      await client.query(
        `INSERT INTO app_sync_actions
           (client_uuid, business_id, device_id, user_id, action_type, payload, accepted, result, created_at_client)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
        [action.clientUuid, actor.businessId, action.deviceId, actor.id, action.type, actionPayloadForStorage(action.payload), value, dateString(action.createdAtClient)],
      )
      await client.query('RELEASE SAVEPOINT action_attempt')
      return { clientUuid: action.clientUuid, accepted: true, result: value }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action rejected.'
      await client.query('ROLLBACK TO SAVEPOINT action_attempt')
      await client.query(
        `INSERT INTO app_sync_actions
           (client_uuid, business_id, device_id, user_id, action_type, payload, accepted, rejection_reason, created_at_client)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)`,
        [action.clientUuid, actor.businessId, action.deviceId, actor.id, action.type, actionPayloadForStorage(action.payload), message, dateString(action.createdAtClient)],
      )
      await client.query('RELEASE SAVEPOINT action_attempt')
      return { clientUuid: action.clientUuid, accepted: false, error: message }
    }
  })
}

async function readSnapshot(client, actor) {
  const isManager = actor.role === 'owner' || actor.role === 'manager'
  const [
    userRows,
    categoryRows,
    itemRows,
    movementRows,
    saleRows,
    settingsRows,
    activityRows,
    notificationRows,
  ] = await Promise.all([
    client.query('SELECT id, name, email, username, role, is_active, created_at, business_id FROM app_users WHERE business_id = $1 ORDER BY created_at', [actor.businessId]),
    client.query('SELECT id, name, sort_order FROM app_categories WHERE business_id = $1 ORDER BY sort_order, name', [actor.businessId]),
    client.query(
      `SELECT i.*, EXISTS(
         SELECT 1 FROM app_item_images im WHERE im.item_id = i.id AND im.business_id = i.business_id
       ) AS has_image
       FROM app_items i WHERE i.business_id = $1 ORDER BY i.name`,
      [actor.businessId],
    ),
    client.query(
      `SELECT e.id, e.item_id, i.name AS item_name, e.event_type, e.quantity_delta, e.description,
              e.actor_user_id, e.unit_cost_kobo, e.created_at_server
       FROM app_stock_events e JOIN app_items i ON i.id = e.item_id
       WHERE e.business_id = $1 AND i.business_id = $1 ORDER BY e.created_at_server`,
      [actor.businessId],
    ),
    client.query(
      `SELECT s.id, s.staff_id, s.staff_name, s.total_kobo, s.created_at, s.cleared_at, s.voided_at, s.void_reason,
              COALESCE(json_agg(json_build_object(
                'itemId', si.item_id, 'itemName', si.item_name, 'pricePointId', si.price_point_id,
                'pricePointLabel', si.price_point_label, 'quantity', si.quantity,
                'unitPriceKobo', si.unit_price_kobo, 'baseUnitsDeducted', si.base_units_deducted,
                'totalKobo', si.total_kobo
              ) ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL), '[]') AS lines
       FROM app_sales s LEFT JOIN app_sale_items si
         ON si.sale_id = s.id AND si.business_id = s.business_id
       WHERE s.cleared_at IS NULL
         AND s.business_id = $3
         AND ($1::boolean OR s.staff_id = $2)
       GROUP BY s.id ORDER BY s.created_at DESC`,
      [isManager, actor.id, actor.businessId],
    ),
    client.query('SELECT key, value FROM app_settings WHERE business_id = $1', [actor.businessId]),
    client.query(
      `SELECT id, user_id, user_name, user_role, action, what, old_value, new_value, created_at
       FROM app_activity_log WHERE business_id = $2 AND $1::boolean ORDER BY created_at DESC`,
      [actor.role === 'owner', actor.businessId],
    ),
    client.query(
      `SELECT id, audit_entry_id, action, what, user_name, user_role, created_at, read_at
       FROM app_notifications WHERE business_id = $2 AND $1::boolean ORDER BY created_at DESC`,
      [isManager, actor.businessId],
    ),
  ])
  const users = userRows.rows
    .filter((row) => actor.role === 'owner' || actor.role === 'manager' && row.role === 'staff' || row.id === actor.id)
    .map(publicUser)
  const items = itemRows.rows.map(mapItem)
  const movements = movementRows.rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.event_type,
    quantityChange: row.quantity_delta,
    description: row.description,
    createdAt: row.created_at_server.toISOString(),
    userId: row.actor_user_id,
    ...(row.unit_cost_kobo !== null ? { unitCostKobo: row.unit_cost_kobo } : {}),
  }))
  const sales = saleRows.rows.map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    createdAt: row.created_at.toISOString(),
    totalKobo: Number(row.total_kobo),
    status: row.voided_at ? 'voided' : 'synced',
    ...(row.void_reason ? { voidReason: row.void_reason } : {}),
    lines: row.lines,
  }))
  const stockLevels = items.map((item) => ({
    itemId: item.id,
    quantity: movements.filter((movement) => movement.itemId === item.id)
      .reduce((sum, movement) => sum + movement.quantityChange, 0),
    low: false,
    negative: false,
  })).map((level) => {
    const item = items.find((entry) => entry.id === level.itemId)
    return {
      ...level,
      low: Boolean(item?.trackStock && level.quantity <= item.reorderLevel),
      negative: level.quantity < 0,
    }
  })
  const activityLog = activityRows.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    what: row.what,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at.toISOString(),
  }))
  const notifications = notificationRows.rows.map((row) => ({
    id: row.id,
    auditEntryId: row.audit_entry_id,
    action: row.action,
    what: row.what,
    userName: row.user_name,
    userRole: row.user_role,
    createdAt: row.created_at.toISOString(),
    ...(row.read_at ? { readAt: row.read_at.toISOString() } : {}),
  }))
  const settings = Object.fromEntries(settingsRows.rows.map((row) => [row.key, row.value]))
  return {
    users,
    categories: categoryRows.rows.map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order })),
    items,
    movements,
    sales,
    stockLevels,
    settings,
    activityLog,
    notifications,
  }
}

app.get('/api/health', async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ status: 'ok' })
})

app.get('/api/auth/setup-status', async (_request, response) => {
  response.json({ ownerExists: false })
})

app.post('/api/auth/register-owner', authLimiter, async (request, response) => {
  requireEnvironment()
  const input = validate(accountSchema.extend({
    email: z.string().trim().email().max(254),
    businessName: z.string().trim().min(1).max(160),
  }), request.body)
  const registration = await withTransaction(async (client) => {
    const businessId = crypto.randomUUID()
    await client.query(
      'INSERT INTO app_businesses (id, name) VALUES ($1, $2)',
      [businessId, input.businessName],
    )
    const result = await client.query(
      `INSERT INTO app_users (id, business_id, name, email, username, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'owner')
       RETURNING id, business_id, name, email, username, role, is_active, created_at`,
      [crypto.randomUUID(), businessId, input.name, input.email.toLowerCase(), input.username, await bcrypt.hash(input.password, 12)],
    )
    const owner = { ...result.rows[0], business_name: input.businessName }
    const user = publicUser(owner)
    await logActivity(client, user, 'Registered business', input.businessName, 'Not available', input.businessName)
    await client.query(
      `INSERT INTO app_settings (business_id, key, value) VALUES ($1, 'businessName', $2)
       ON CONFLICT (business_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [businessId, JSON.stringify(input.businessName)],
    )
    await client.query(
      `INSERT INTO app_categories (business_id, id, name, sort_order) VALUES
         ($1, $2, 'Spirits', 1),
         ($1, $3, 'Beer', 2),
         ($1, $4, 'Soft Drinks', 3),
         ($1, $5, 'Food', 4),
         ($1, $6, 'Other', 5)`,
      [businessId, ...['spirits', 'beer', 'soft-drinks', 'food', 'other'].map((id) => `${businessId}:${id}`)],
    )
    return { user, businessId }
  })
  await createSession(response, registration.user)
  response.status(201).json({ user: registration.user })
})

app.post('/api/auth/login', authLimiter, async (request, response) => {
  requireEnvironment()
  const input = validate(z.object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(128),
  }), request.body)
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.username, u.password_hash, u.role, u.is_active, u.created_at,
            u.business_id, b.name AS business_name
     FROM app_users u JOIN app_businesses b ON b.id = u.business_id
     WHERE lower(u.username) = lower($1) OR lower(u.email) = lower($1) LIMIT 1`,
    [input.identifier],
  )
  const row = result.rows[0]
  if (!row || !row.is_active || !(await bcrypt.compare(input.password, row.password_hash))) {
    throw httpError(401, 'The username or password is incorrect, or this account is inactive.')
  }
  const user = publicUser(row)
  await createSession(response, user)
  response.json({ user })
})

app.post('/api/auth/refresh', authLimiter, async (request, response) => {
  requireEnvironment()
  const oldToken = request.cookies?.[refreshCookie]
  if (!oldToken) throw httpError(401, 'Your session expired. Sign in again.')
  const replacement = crypto.randomBytes(32).toString('base64url')
  const user = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT r.id AS refresh_id, u.id, u.name, u.email, u.username, u.role,
              u.is_active, u.created_at, u.business_id, b.name AS business_name
       FROM app_refresh_tokens r JOIN app_users u ON u.id = r.user_id
       JOIN app_businesses b ON b.id = u.business_id
       WHERE r.token_hash = $1 AND r.revoked_at IS NULL AND r.expires_at > now()
       FOR UPDATE OF r`,
      [refreshHash(oldToken)],
    )
    const row = result.rows[0]
    if (!row?.is_active) throw httpError(401, 'Your session is invalid or this account is inactive.')
    await client.query(
      `UPDATE app_refresh_tokens SET token_hash = $2, expires_at = now() + interval '30 days'
       WHERE id = $1`,
      [row.refresh_id, refreshHash(replacement)],
    )
    return publicUser(row)
  })
  response.cookie(accessCookie, signToken(user), cookieOptions('/', accessTokenLifetimeMs))
  response.cookie(refreshCookie, replacement, cookieOptions('/api/auth', refreshTokenLifetimeMs))
  response.json({ user })
})

app.post('/api/auth/logout', async (request, response) => {
  const token = request.cookies?.[refreshCookie]
  if (token) {
    await pool.query(
      'UPDATE app_refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
      [refreshHash(token)],
    )
  }
  clearSessionCookies(response)
  response.status(204).end()
})

app.get('/api/me', authenticate, (request, response) => response.json({ user: request.user }))

app.get('/api/users', authenticate, permit('owner', 'manager'), async (request, response) => {
  const result = await pool.query(
    `SELECT id, name, email, username, role, is_active, created_at, business_id
     FROM app_users WHERE business_id = $1 AND ($2::boolean OR role = 'staff' OR id = $3)
     ORDER BY created_at`,
    [request.user.businessId, request.user.role === 'owner', request.user.id],
  )
  response.json(result.rows.map(publicUser))
})

app.post('/api/users', authenticate, permit('owner', 'manager'), async (request, response) => {
  const input = validate(accountSchema.extend({
    role: roleSchema.default('staff'),
  }), request.body)
  if (request.user.role === 'manager' && input.role !== 'staff') throw httpError(403, 'Managers can only create staff accounts.')
  const created = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO app_users (id, business_id, name, email, username, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, business_id, name, email, username, role, is_active, created_at`,
      [crypto.randomUUID(), request.user.businessId, input.name, input.email || null, input.username, await bcrypt.hash(input.password, 12), input.role],
    )
    const user = publicUser({ ...result.rows[0], business_name: request.user.businessName })
    await logActivity(client, request.user, 'Created staff account', user.name, 'Not available', user.role)
    await publish(client, request.user.businessId, 'user', user.id, user)
    return user
  })
  response.status(201).json(created)
})

app.patch('/api/users/:id', authenticate, permit('owner', 'manager'), async (request, response) => {
  const changes = validate(z.object({
    name: z.string().trim().min(1).max(120).optional(),
    username: z.string().trim().min(3).max(64).optional(),
    password: z.string().min(12).max(128).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0), request.body)
  const updated = await withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id, name, username, role, is_active FROM app_users WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [request.params.id, request.user.businessId],
    )
    if (!existing.rowCount) throw httpError(404, 'User not found.')
    if (request.user.role === 'manager' && existing.rows[0].role !== 'staff') {
      throw httpError(403, 'Managers can only manage staff accounts.')
    }
    if (request.user.id === request.params.id && changes.isActive === false) {
      throw httpError(400, 'You cannot deactivate your own account.')
    }
    const values = []
    const fields = []
    for (const [key, value] of Object.entries(changes)) {
      const column = { name: 'name', username: 'username', isActive: 'is_active' }[key]
      if (column) {
        values.push(value)
        fields.push(`${column} = $${values.length}`)
      } else if (key === 'password') {
        values.push(await bcrypt.hash(value, 12))
        fields.push(`password_hash = $${values.length}`)
      }
    }
    values.push(request.params.id, request.user.businessId)
    const result = await client.query(
      `UPDATE app_users SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${values.length - 1} AND business_id = $${values.length}
       RETURNING id, business_id, name, email, username, role, is_active, created_at`,
      values,
    )
    if (changes.isActive === false) {
      await client.query(
        'UPDATE app_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [request.params.id],
      )
    }
    const user = publicUser({ ...result.rows[0], business_name: request.user.businessName })
    await logActivity(
      client,
      request.user,
      changes.isActive === false ? 'Deactivated staff account' : 'Updated staff account',
      user.name,
      JSON.stringify({ name: existing.rows[0].name, username: existing.rows[0].username, isActive: existing.rows[0].is_active }),
      JSON.stringify({ name: user.name, username: user.username, isActive: user.isActive }),
    )
    await publish(client, request.user.businessId, 'user', user.id, user)
    return user
  })
  response.json(updated)
})

app.delete('/api/users/:id', authenticate, permit('owner', 'manager'), async (request, response) => {
  if (request.user.id === request.params.id) throw httpError(400, 'You cannot deactivate your own account.')
  await withTransaction(async (client) => {
    const target = await client.query(
      `SELECT id, name, email, username, role, is_active, created_at
       , business_id FROM app_users WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [request.params.id, request.user.businessId],
    )
    if (!target.rowCount) throw httpError(404, 'User not found.')
    if (request.user.role === 'manager' && target.rows[0].role !== 'staff') {
      throw httpError(403, 'Managers can only manage staff accounts.')
    }
    await client.query(
      'UPDATE app_users SET is_active = false, updated_at = now() WHERE id = $1 AND business_id = $2',
      [request.params.id, request.user.businessId],
    )
    await client.query(
      'UPDATE app_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [request.params.id],
    )
    const user = publicUser({ ...target.rows[0], is_active: false, business_name: request.user.businessName })
    await logActivity(client, request.user, 'Deactivated staff account', user.name, 'Active', 'Inactive')
    await publish(client, request.user.businessId, 'user', user.id, user)
  })
  response.status(204).end()
})

app.get('/api/items/:id/image', authenticate, async (request, response) => {
  const result = await pool.query(
    `SELECT im.content_type, im.image_data
     FROM app_item_images im JOIN app_items i ON i.id = im.item_id
     WHERE im.item_id = $1 AND im.business_id = $2 AND i.business_id = $2`,
    [request.params.id, request.user.businessId],
  )
  if (!result.rowCount) throw httpError(404, 'Item image not found.')
  response.set('Content-Type', result.rows[0].content_type)
  response.set('Cache-Control', 'private, max-age=3600')
  response.send(result.rows[0].image_data)
})

app.post('/api/sync/push', authenticate, async (request, response) => {
  const input = validate(z.object({
    actions: z.array(z.unknown()).min(1).max(100),
  }), request.body)
  const results = []
  for (const action of input.actions) {
    try {
      results.push(await pushOne(action, request.user))
    } catch (error) {
      results.push({
        clientUuid: typeof action === 'object' && action !== null && 'clientUuid' in action
          ? action.clientUuid
          : null,
        accepted: false,
        error: error instanceof Error ? error.message : 'Action rejected.',
      })
    }
  }
  response.json({ results })
})

app.get('/api/sync/pull', authenticate, async (request, response) => {
  const since = request.query.since
  if (since !== undefined && (typeof since !== 'string' || Number.isNaN(Date.parse(since)))) {
    throw httpError(400, 'The since parameter must be a valid timestamp.')
  }
  const after = request.query.after
  if (after !== undefined && (typeof after !== 'string' || !/^\d+$/.test(after))) {
    throw httpError(400, 'The after parameter must be a change-log ID.')
  }
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(827365)')
    const activeUser = await client.query(
      'SELECT id, is_active FROM app_users WHERE id = $1 AND business_id = $2',
      [request.user.id, request.user.businessId],
    )
    if (!activeUser.rows[0]?.is_active) throw httpError(401, 'This account is inactive. Contact the owner.')
    const highWater = await client.query(
      'SELECT COALESCE(MAX(id), 0)::text AS id FROM app_change_log WHERE business_id = $1',
      [request.user.businessId],
    )
    const cursor = new Date().toISOString()
    if (!since) {
      return {
        snapshot: await readSnapshot(client, request.user),
        cursor,
        changeId: highWater.rows[0].id,
        userActive: true,
      }
    }
    const filter = `
      AND (entity_type <> 'activity' OR $3 = 'owner')
      AND (entity_type <> 'notification' OR $3 IN ('owner', 'manager'))
      AND (entity_type <> 'user' OR $3 = 'owner' OR payload->>'id' = $4
        OR ($3 = 'manager' AND payload->>'role' = 'staff'))
      AND (entity_type NOT IN ('sale', 'sale.cleared') OR $3 IN ('owner', 'manager') OR payload->>'staffId' = $4)`
    const changes = after
      ? await client.query(
        `SELECT id, entity_type, entity_id, payload, created_at
         FROM app_change_log WHERE business_id = $1 AND id > $2::bigint ${filter}
         ORDER BY id LIMIT 5000`,
        [request.user.businessId, after, request.user.role, request.user.id],
      )
      : await client.query(
        `SELECT id, entity_type, entity_id, payload, created_at
         FROM app_change_log WHERE business_id = $1 AND created_at > $2 ${filter}
         ORDER BY id LIMIT 5000`,
        [request.user.businessId, new Date(since), request.user.role, request.user.id],
      )
    const changeId = changes.rowCount === 5000
      ? String(changes.rows[changes.rowCount - 1].id)
      : highWater.rows[0].id
    const settings = await client.query('SELECT key, value FROM app_settings WHERE business_id = $1', [request.user.businessId])
    return {
      changes: changes.rows.map((row) => ({
        id: String(row.id),
        type: row.entity_type,
        entityId: row.entity_id,
        data: row.payload,
        createdAt: row.created_at.toISOString(),
      })),
      settings: Object.fromEntries(settings.rows.map((row) => [row.key, row.value])),
      cursor,
      changeId,
      userActive: true,
    }
  })
  response.json(result)
})

app.post('/api/notifications/read', authenticate, permit('owner', 'manager'), async (request, response) => {
  await pool.query(
    'UPDATE app_notifications SET read_at = now() WHERE read_at IS NULL AND business_id = $1',
    [request.user.businessId],
  )
  response.status(204).end()
})

app.get('/api/sync/rejected', authenticate, permit('owner'), async (request, response) => {
  const result = await pool.query(
    `SELECT a.client_uuid, a.device_id, a.user_id, u.name AS user_name, a.action_type,
            a.payload, a.rejection_reason, a.created_at_client, a.processed_at
     FROM app_sync_actions a JOIN app_users u ON u.id = a.user_id
     WHERE a.accepted = false AND a.business_id = $1
     ORDER BY a.processed_at DESC LIMIT 1000`,
    [request.user.businessId],
  )
  response.json(result.rows)
})

app.post('/api/storage/clear-sales', authenticate, permit('owner'), async (request, response) => {
  const input = validate(z.object({
    password: z.string().min(1).max(128),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }), request.body)
  if (input.from > input.to) throw httpError(400, 'The start date must not be after the end date.')
  for (const value of [input.from, input.to]) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw httpError(400, 'Select valid calendar dates.')
    }
  }
  const auth = await pool.query(
    'SELECT password_hash FROM app_users WHERE id = $1 AND business_id = $2 AND is_active',
    [request.user.id, request.user.businessId],
  )
  if (!auth.rowCount || !(await bcrypt.compare(input.password, auth.rows[0].password_hash))) {
    throw httpError(401, 'The owner password could not be verified.')
  }
  const result = await withTransaction(async (client) => {
    const cleared = await client.query(
      `UPDATE app_sales SET cleared_at = now()
       WHERE business_id = $3
         AND cleared_at IS NULL
         AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date
       RETURNING id, staff_id`,
      [input.from, input.to, request.user.businessId],
    )
    for (const sale of cleared.rows) {
      await publish(client, request.user.businessId, 'sale.cleared', sale.id, { id: sale.id, staffId: sale.staff_id })
    }
    await logActivity(client, request.user, 'Cleared sales records', `${input.from} to ${input.to}`, `${cleared.rowCount} records`, 'Report generated before clearing')
    return cleared.rowCount
  })
  response.json({ clearedCount: result })
})

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Request body must be valid JSON.' })
    return
  }
  const status = Number.isInteger(error.status) ? error.status : 500
  if (status >= 500) console.error('API request failed', error)
  response.status(status).json({
    error: status >= 500 ? 'An unexpected server error occurred.' : error.message,
  })
})

export { actionSchema, app, parseImage, safeInteger }
