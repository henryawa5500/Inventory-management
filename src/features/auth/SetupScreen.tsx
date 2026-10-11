import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, MoonStar, SunMedium } from 'lucide-react'
import { APP_NAME } from '../../app/constants'
import { Button } from '../../components/Button'
import { LegalInformationScreen, type LegalPage } from '../legal/LegalInformationScreen'

type RegistrationPayload = {
  name: string
  businessName: string
  email: string
  username: string
  password: string
  role: 'owner'
}

type RegistrationForm = Omit<RegistrationPayload, 'role'> & { confirmPassword: string }

export function SetupScreen({
  onCreate,
  onBackToLogin,
  theme,
  onToggleTheme,
}: {
  onCreate: (payload: RegistrationPayload) => Promise<void>
  onBackToLogin?: () => void
  theme: string
  onToggleTheme: () => void
}) {
  const [form, setForm] = useState<RegistrationForm>({
    name: '',
    businessName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { confirmPassword: _confirmPassword, ...registration } = form
      await onCreate({ ...registration, role: 'owner' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create your account. Please try again.')
      setSubmitting(false)
    }
  }

  const passwordField = (
    id: 'owner-password' | 'owner-confirm-password',
    label: string,
    value: string,
    visible: boolean,
    onToggle: () => void,
    onChange: (value: string) => void,
    autoComplete: 'new-password',
  ) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={id === 'owner-password' ? 'At least 8 characters' : 'Re-enter your password'}
          className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 pr-11 text-base text-[var(--text-color)]"
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )

  if (legalPage) {
    return (
      <LegalInformationScreen
        page={legalPage}
        onBack={() => setLegalPage(null)}
        onOpenPage={setLegalPage}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-[var(--app-bg)] px-4 pb-8 pt-6 text-[var(--text-color)] sm:px-6 sm:pt-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Owner registration</p>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.05em]">{APP_NAME}</h1>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-2.5 text-[var(--text-color)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>
      </div>

      <p className="mb-5 text-sm text-[var(--muted)]">Set up your business and create the owner account.</p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div>
          <label htmlFor="owner-name" className="mb-1.5 block text-sm font-medium">Owner full name</label>
          <input
            id="owner-name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="e.g. Jane Smith"
            className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-base text-[var(--text-color)]"
          />
        </div>
        <div>
          <label htmlFor="business-name" className="mb-1.5 block text-sm font-medium">Business name</label>
          <input
            id="business-name"
            autoComplete="organization"
            required
            value={form.businessName}
            onChange={(event) => setForm({ ...form, businessName: event.target.value })}
            placeholder="e.g. The Corner Bar"
            className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-base text-[var(--text-color)]"
          />
        </div>
        <div>
          <label htmlFor="owner-email" className="mb-1.5 block text-sm font-medium">Email address</label>
          <input
            id="owner-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
            className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-base text-[var(--text-color)]"
          />
        </div>
        <div>
          <label htmlFor="owner-username" className="mb-1.5 block text-sm font-medium">Username</label>
          <input
            id="owner-username"
            autoComplete="username"
            required
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="Choose a username"
            className="h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-base text-[var(--text-color)]"
          />
        </div>
        {passwordField(
          'owner-password',
          'Password',
          form.password,
          showPassword,
          () => setShowPassword((value) => !value),
          (password) => setForm({ ...form, password }),
          'new-password',
        )}
        {passwordField(
          'owner-confirm-password',
          'Confirm password',
          form.confirmPassword,
          showConfirmPassword,
          () => setShowConfirmPassword((value) => !value),
          (confirmPassword) => setForm({ ...form, confirmPassword }),
          'new-password',
        )}

        <div className="flex items-start gap-3 pt-1">
          <input
            id="registration-terms"
            type="checkbox"
            required
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 accent-black"
          />
          <label htmlFor="registration-terms" className="text-sm leading-6 text-[var(--muted)]">
            I agree to the{' '}
            <button type="button" onClick={() => setLegalPage('terms')} className="font-medium text-[var(--text-color)] underline underline-offset-4">Terms of Use</button>
            {' '}and acknowledge the{' '}
            <button type="button" onClick={() => setLegalPage('privacy')} className="font-medium text-[var(--text-color)] underline underline-offset-4">Privacy Policy</button>.
          </label>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create owner account'}
          {!submitting && <ArrowRight size={18} className="ml-2" />}
        </Button>
      </form>

      {onBackToLogin && (
        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-5 self-center text-sm font-medium text-[var(--muted)] underline underline-offset-4"
        >
          Already registered? Sign in
        </button>
      )}
      <div className="mt-5 flex justify-center gap-5 text-xs text-[var(--muted)]">
        <button type="button" onClick={() => setLegalPage('privacy')} className="min-h-11 underline underline-offset-4">Privacy</button>
        <button type="button" onClick={() => setLegalPage('terms')} className="min-h-11 underline underline-offset-4">Terms</button>
        <button type="button" onClick={() => setLegalPage('about')} className="min-h-11 underline underline-offset-4">About / Support</button>
      </div>
    </div>
  )
}
