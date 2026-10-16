import { useState, type FormEvent } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { APP_NAME, DEFAULT_THEME } from '../../app/constants'
import { Button } from '../../components/Button'
import type { LegalPage } from '../legal/LegalInformationScreen'

export function LoginScreen({
  onLogin,
  onOpenLegal,
  theme,
  onToggleTheme,
}: {
  onLogin: (username: string, password: string) => Promise<boolean>
  onOpenLegal: (page: LegalPage) => void
  theme: string
  onToggleTheme: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      if (await onLogin(username, password)) return
      setError('The username or password is incorrect, or this account is inactive.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[var(--app-bg)] px-4 py-8 text-[var(--text-color)] sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Bar operations · Made by Henry Me</p>
            <h1 className="mt-2 text-[32px] font-bold tracking-[-0.05em]">{APP_NAME}</h1>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-2.5 text-[var(--text-color)] shadow-sm"
            aria-label="Toggle theme"
          >
            {theme === DEFAULT_THEME ? <SunMedium size={18} /> : <MoonStar size={18} />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium">Username or email</label>
            <input
              id="login-username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username or email"
              className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-[var(--text-color)]"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-[var(--text-color)]"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" fullWidth>Sign in</Button>
        </form>
        <div className="mt-6 flex justify-center gap-5 text-xs text-[var(--muted)]">
          <button type="button" onClick={() => onOpenLegal('privacy')} className="min-h-11 underline underline-offset-4">Privacy</button>
          <button type="button" onClick={() => onOpenLegal('terms')} className="min-h-11 underline underline-offset-4">Terms</button>
          <button type="button" onClick={() => onOpenLegal('about')} className="min-h-11 underline underline-offset-4">About / Support</button>
        </div>
      </div>
    </div>
  )
}
