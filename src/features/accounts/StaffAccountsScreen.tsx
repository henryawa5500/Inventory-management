import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { Button } from '../../components/Button'
import type { User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

type StaffForm = {
  name: string
  username: string
  password: string
}

const emptyForm: StaffForm = { name: '', username: '', password: '' }

export function StaffAccountsScreen() {
  const repository = useInventoryRepository()
  const [staff, setStaff] = useState<User[] | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<StaffForm>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')

  const refreshStaff = useCallback(async () => {
    const users = await repository.listUsers()
    setStaff(users.filter((user) => user.role === 'staff'))
  }, [repository])

  useEffect(() => {
    void repository.listUsers()
      .then((users) => setStaff(users.filter((user) => user.role === 'staff')))
      .catch((caught: unknown) => {
        setStaff([])
        setError(caught instanceof Error ? caught.message : 'Unable to load staff accounts.')
      })
  }, [repository])

  const openCreateForm = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setError('')
    setFormOpen(true)
  }

  const openEditForm = (user: User) => {
    setEditingUser(user)
    setForm({ name: user.name, username: user.username, password: '' })
    setError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      const name = form.name.trim()
      const username = form.username.trim()
      if (editingUser) {
        await repository.updateUser(editingUser.id, {
          name,
          username,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await repository.createUser({ name, username, password: form.password, role: 'staff' })
      }
      await refreshStaff()
      setFormOpen(false)
      setEditingUser(null)
      setForm(emptyForm)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this account.')
    }
  }

  const handleToggleActive = async (user: User) => {
    setError('')
    try {
      await repository.updateUser(user.id, {
        name: user.name,
        username: user.username,
        isActive: !user.isActive,
      })
      await refreshStaff()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this account.')
    }
  }

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Permanently delete the account for ${user.name}?`)) return
    setError('')
    try {
      await repository.deleteUser(user.id)
      await refreshStaff()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete this account.')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Team</p>
            <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">Staff accounts</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Create and manage staff sign-in access.</p>
          </div>
          {!formOpen && (
            <Button aria-label="Add staff account" onClick={openCreateForm} className="h-12 w-12 min-h-0 rounded-[12px] p-0">
              <Plus size={19} />
            </Button>
          )}
        </div>
      </section>

      {formOpen && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{editingUser ? 'Edit staff account' : 'Create staff account'}</h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
              aria-label="Close account form"
            >
              <X size={18} />
            </button>
          </div>
          <div>
            <label htmlFor="staff-name" className="mb-1.5 block text-sm font-medium">Full name</label>
            <input
              id="staff-name"
              autoComplete="name"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Jane Smith"
              className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-[var(--text-color)]"
            />
          </div>
          <div>
            <label htmlFor="staff-username" className="mb-1.5 block text-sm font-medium">Username</label>
            <input
              id="staff-username"
              autoComplete="username"
              required
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="e.g. janesmith"
              className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-[var(--text-color)]"
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="mb-1.5 block text-sm font-medium">
              {editingUser ? 'New password (optional)' : 'Temporary password'}
            </label>
            <input
              id="staff-password"
              type="password"
              autoComplete="new-password"
              required={!editingUser}
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingUser ? 'Leave blank to keep current password' : 'At least 8 characters'}
              className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-[var(--text-color)]"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" fullWidth>{editingUser ? 'Save changes' : 'Create account'}</Button>
          </div>
        </form>
      )}

      {error && !formOpen && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        {staff === null ? (
          <p className="p-4 text-center text-sm text-[var(--muted)]">Loading staff accounts…</p>
        ) : staff.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--surface)] p-6 text-center">
            <UserRound className="mx-auto mb-2 text-[var(--muted)]" size={22} />
            <p className="text-sm text-[var(--muted)]">No staff accounts yet.</p>
          </div>
        ) : staff.map((user) => (
          <article key={user.id} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{user.name}</h3>
                <p className="mt-0.5 text-sm text-[var(--muted)]">@{user.username}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--surface-elevated)] text-[var(--muted)]'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEditForm(user)}
                  aria-label={`Edit ${user.name}`}
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-color)]"
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(user)}
                  aria-label={`Delete ${user.name}`}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleToggleActive(user)}
              className="mt-3 text-sm font-medium text-[var(--text-color)] underline underline-offset-4"
            >
              {user.isActive ? 'Deactivate account' : 'Activate account'}
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}
