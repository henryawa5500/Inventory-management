import { ArrowLeft } from 'lucide-react'
import { APP_CREDIT, APP_NAME } from '../../app/constants'

export type LegalPage = 'privacy' | 'terms' | 'about'

const pageTitles: Record<LegalPage, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  about: 'About and support',
}

export function LegalInformationScreen({
  page,
  onBack,
  onOpenPage,
}: {
  page: LegalPage
  onBack: () => void
  onOpenPage?: (page: LegalPage) => void
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl bg-[var(--app-bg)] px-4 py-6 text-[var(--text-color)] sm:px-6 sm:py-8 lg:px-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[var(--border-color)] bg-[var(--surface)] px-4 text-sm font-medium"
      >
        <ArrowLeft size={17} /> Back
      </button>

      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">{APP_NAME} · {APP_CREDIT}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{pageTitles[page]}</h1>
        {page !== 'about' && <p className="mt-2 text-sm text-[var(--muted)]">Effective date: 11 October 2026</p>}
      </header>

      {page === 'privacy' && <PrivacyPolicy />}
      {page === 'terms' && <TermsOfUse />}
      {page === 'about' && <AboutSupport onOpenPage={onOpenPage} />}
    </main>
  )
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-[var(--text-soft)]">{children}</div>
    </section>
  )
}

function PrivacyPolicy() {
  return (
    <article className="space-y-6 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <PolicySection title="1. About this policy">
        <p>This policy explains how the bar and inventory management app handles account and business information.</p>
      </PolicySection>
      <PolicySection title="2. Information handled by the app">
        <p>Account details include a business name and the owner's name and email. Business operations can include menu items, stock movements, sales, staff accounts, activity entries, notifications, and item images.</p>
        <p>Business records are stored by the service and separated by business. The app also stores a local offline copy in the browser so previously signed-in users can continue working without a connection. Passwords are hashed on the server; staff accounts are created by the business owner or an authorized manager. Keep account credentials private and protect devices that contain offline business data.</p>
      </PolicySection>
      <PolicySection title="3. How information is used">
        <p>Information is used to provide account access, inventory, staff management, sales, notifications, activity history, and offline synchronization. The app does not process payments.</p>
      </PolicySection>
      <PolicySection title="4. Browser storage and third parties">
        <p>The browser stores a session, selected display preferences, and offline business data. The app uses hosting, database, and font services to operate; those providers may receive standard connection data when the app is used. Review the service operator's current provider list and privacy practices for details.</p>
      </PolicySection>
      <PolicySection title="5. Security and retention">
        <p>Access is controlled by account roles, and business records are scoped to the authenticated business. Offline browser data remains accessible to people with access to that browser profile. Keep independent backups of important records. An owner can download or print a date-range sales report, then clear sales for that range after re-entering the owner password. Sales are not cleared automatically; stock movement and activity history are retained by that action. Clearing browser site data removes that device's local copy.</p>
      </PolicySection>
      <PolicySection title="6. Your choices and contact">
        <p>For account access, data corrections, or privacy requests, contact your business owner or the service administrator. A dedicated privacy contact address should be supplied by the service operator.</p>
      </PolicySection>
      <p className="border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)]">This notice is informational and should be reviewed by the service operator for the applicable jurisdictions.</p>
    </article>
  )
}

function TermsOfUse() {
  return (
    <article className="space-y-6 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <PolicySection title="1. Service">
        <p>The app provides business owners and authorized staff with bar operations and inventory-management tools.</p>
      </PolicySection>
      <PolicySection title="2. Account responsibilities">
        <p>Owners register their business. Staff accounts are created by the business owner or an authorized manager. Keep credentials private, sign out on shared devices, and promptly notify the business administrator if an account may have been misused. Do not attempt to access another business's data or bypass role restrictions.</p>
      </PolicySection>
      <PolicySection title="3. Acceptable use and data">
        <p>The app does not process payments. Maintain appropriate business records and backups, and verify inventory and transaction information before relying on it operationally.</p>
      </PolicySection>
      <PolicySection title="4. Availability and warranty">
        <p>The service is provided “as is” and “as available,” without a guarantee of uninterrupted operation, accuracy, data persistence, or fitness for a particular purpose. Browser-local records can be lost, altered, or cleared. These terms do not limit rights that cannot lawfully be excluded.</p>
      </PolicySection>
      <PolicySection title="5. Changes and contact">
        <p>The app may be updated or withdrawn as it develops. For account access or questions, contact your business administrator. The service operator should provide its legal identity, support contact, governing law, and applicable consumer rights.</p>
      </PolicySection>
      <p className="border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)]">Effective 20 October 2026. This notice is informational, not legal advice.</p>
    </article>
  )
}

function AboutSupport({ onOpenPage }: { onOpenPage?: (page: LegalPage) => void }) {
  return (
    <article className="space-y-6 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <PolicySection title="Product">
        <p><strong>{APP_NAME}</strong> is a multi-business bar operations and inventory-management app.</p>
        <p>{APP_CREDIT}. Each business has separate records. Item images are stored with the business record and cached on the device for offline use.</p>
      </PolicySection>
      <PolicySection title="Support">
        <p>For account access, corrections, or operational support, contact your business owner or service administrator.</p>
      </PolicySection>
      <PolicySection title="Accessibility">
        <p>The app uses labeled form controls, keyboard-operable buttons, and visible focus indicators. If you encounter an accessibility barrier, please report it to the business administrator so it can be addressed.</p>
      </PolicySection>
      <PolicySection title="Legal information">
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => onOpenPage?.('privacy')} className="min-h-11 underline underline-offset-4">Privacy Policy</button>
          <button type="button" onClick={() => onOpenPage?.('terms')} className="min-h-11 underline underline-offset-4">Terms of Use</button>
        </div>
      </PolicySection>
    </article>
  )
}
