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
    <main className="mx-auto min-h-screen max-w-2xl bg-[var(--app-bg)] px-5 py-8 text-[var(--text-color)]">
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
        <p>This policy explains how the D'Queens bar operations app handles information. The app is currently a browser-based prototype. It is not connected to a production server, cloud image store, or payment processor.</p>
      </PolicySection>
      <PolicySection title="2. Information handled by the app">
        <p>Registration and account details may include an owner or staff member's name, email address (for owners), username, and password. Operational demo data can include inventory, stock movements, sales records, and the user who recorded an action.</p>
        <p>Account records, salted PBKDF2 password verifiers, business settings, inventory, stock movements, sales, activity entries, notifications, and uploaded item images are saved in this browser's local storage so they remain available after a reload. The current session ID and selected theme are stored there as well. Uploaded images are compressed and remain in this browser; they are not uploaded to cloud storage. This client-side prototype does not provide production authentication, secure backups, or tamper-proof records. Browser data can be changed or removed by someone with access to the browser profile. Demo accounts and passwords are seeded for testing. Do not use real customer, staff, or business-sensitive information in this prototype.</p>
      </PolicySection>
      <PolicySection title="3. How information is used">
        <p>Information is used only to provide the app's account, inventory, staff-management, and sales-demo features. The current prototype does not submit registration or operational records to a D'Queens backend, and does not include analytics, advertising, or a payment service.</p>
      </PolicySection>
      <PolicySection title="4. Browser storage and third parties">
        <p>The prototype uses local storage for the records described above and does not currently use advertising cookies. The Inter font is requested from Google Fonts and seeded demo product images are requested from Unsplash; those providers may receive standard connection data such as your IP address when the assets are requested. User-uploaded images are not sent to those providers. Their privacy practices are governed by their own policies.</p>
      </PolicySection>
      <PolicySection title="5. Security and retention">
        <p>This prototype is not designed for production credentials or confidential data. Passwords are verified with salted PBKDF2 hashes, but client-side authentication is not a substitute for a secure server-side identity system and browser-local activity entries are not tamper-proof. There are no durable backups or production administrative security controls. An owner can download or print a date-range sales report, then clear sales for that range after re-entering the owner password. Sales are not cleared automatically; stock movement and activity history are retained by that action. Clearing browser site data removes all locally stored records.</p>
      </PolicySection>
      <PolicySection title="6. Your choices and contact">
        <p>Do not enter real personal or business-sensitive information until a production service with appropriate safeguards is available. For questions about this prototype or a data request, contact the D'Queens business owner or the administrator who provided access. No dedicated privacy contact address has been provided in this release.</p>
      </PolicySection>
      <p className="border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)]">This prototype notice is informational and is not legal advice or a substitute for a jurisdiction-specific privacy review before public production use.</p>
    </article>
  )
}

function TermsOfUse() {
  return (
    <article className="space-y-6 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <PolicySection title="1. Prototype service">
        <p>D'Queens is a bar operations and inventory-management prototype made by Henry Me. It is provided for demonstration and evaluation. Features and sample records may change or reset without notice.</p>
      </PolicySection>
      <PolicySection title="2. Account responsibilities">
        <p>Use only an account assigned or created by the business owner or an authorized manager. Keep credentials private, sign out on shared devices, and promptly notify the business administrator if an account may have been misused. Do not attempt to access another user's account or bypass role restrictions.</p>
      </PolicySection>
      <PolicySection title="3. Acceptable use and data">
        <p>Do not use this prototype to process real payments, maintain the only copy of business records, or store sensitive personal information. Demo sales are not payment records. You are responsible for verifying inventory and transaction information before relying on it operationally.</p>
      </PolicySection>
      <PolicySection title="4. Availability and warranty">
        <p>The prototype is provided “as is” and “as available,” without a guarantee of uninterrupted operation, accuracy, data persistence, or fitness for a particular purpose. Browser-local records can be lost, altered, or cleared and are not backed up. These terms do not limit rights that cannot lawfully be excluded.</p>
      </PolicySection>
      <PolicySection title="5. Changes and contact">
        <p>The app may be updated or withdrawn as it develops. For account access or questions, contact the D'Queens business owner or the administrator who provided access. Before public production launch, these terms should be reviewed and updated with the operator's legal identity, support contact, governing law, and applicable consumer rights.</p>
      </PolicySection>
      <p className="border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)]">Effective 11 October 2026. This prototype notice is informational, not legal advice.</p>
    </article>
  )
}

function AboutSupport({ onOpenPage }: { onOpenPage?: (page: LegalPage) => void }) {
  return (
    <article className="space-y-6 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-5">
      <PolicySection title="Product">
        <p><strong>{APP_NAME}</strong> is a bar operations and inventory-management app for D'Queens.</p>
        <p>{APP_CREDIT}. This build is a prototype with seeded sample data and browser-local storage. Uploaded item images are stored on this device only.</p>
      </PolicySection>
      <PolicySection title="Support">
        <p>For account access, corrections, or operational support, contact the D'Queens owner or the administrator who gave you access. A support email or phone number has not yet been configured.</p>
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
