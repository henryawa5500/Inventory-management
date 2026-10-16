import test from 'node:test'
import assert from 'node:assert/strict'
import { actionSchema, parseImage, safeInteger } from './app.js'

test('sync action envelopes require UUIDs and device metadata', () => {
  const parsed = actionSchema.safeParse({
    clientUuid: 'd3a35b87-f043-405d-a70f-2ee9b7e76e70',
    deviceId: 'tablet-1',
    createdAtClient: '2026-04-18T12:00:00.000Z',
    type: 'stock.purchase',
    payload: { itemId: 'item-1', quantityDelta: 4 },
  })
  assert.equal(parsed.success, true)

  const invalid = actionSchema.safeParse({
    clientUuid: 'not-a-uuid',
    deviceId: '',
    createdAtClient: 'yesterday',
    type: 'sale.confirm',
    payload: {},
  })
  assert.equal(invalid.success, false)
})

test('compressed item images accept only supported formats and size limits', () => {
  const image = parseImage(`data:image/png;base64,${Buffer.from('image').toString('base64')}`)
  assert.equal(image.contentType, 'image/png')
  assert.equal(image.bytes.toString(), 'image')
  assert.throws(() => parseImage('data:image/gif;base64,YQ=='), /JPG, PNG or WebP/)
  assert.throws(
    () => parseImage(`data:image/webp;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')}`),
    /2 MB or smaller/,
  )
})

test('stock event deltas must be safe integers within the allowed range', () => {
  assert.equal(safeInteger(6, 'Stock change', { min: 1 }), 6)
  assert.throws(() => safeInteger(0, 'Stock change', { min: 1 }), /whole number/)
  assert.throws(() => safeInteger(Number.MAX_SAFE_INTEGER + 1, 'Stock change'), /whole number/)
})
