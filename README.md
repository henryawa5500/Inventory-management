# D'Queens

Bar operations and inventory-management app for D'Queens, made by Henry Me.

## Development

```sh
npm install
npm run dev
```

Available checks:

```sh
npm run lint
npm test
npm run build
```

## Prototype status

The current app is a front-end prototype backed by seeded mock data and browser local storage. Account records, settings, inventory, stock movements, sales, activity entries, and notifications persist in that browser across reloads. Password verifiers use salted PBKDF2, but client-side authentication and browser-local activity history are not production security or tamper-proof storage. Manager-uploaded item images are compressed and stored only in the browser; cloud image storage is not configured. There is no production backend, payment processor, or durable backup. Do not enter real or sensitive business or personal information.

Quick Sale keeps items pending until a staff member confirms the order and rejects quantities beyond available stock. An owner can download or print a date-range sales report before clearing sales for that range; stock movements and the activity log are retained. Managers and owners can review notifications, and the activity log is owner-only in the app. These controls are prototype UI safeguards, not server-enforced security.

The interface adapts across narrow phones, tablets, laptops, and wide desktop displays: navigation changes from a mobile bottom bar to a desktop sidebar, and product, staff, inventory, and sales layouts add columns as screen width increases.

The in-app **Privacy Policy**, **Terms of Use**, and **About and support** pages describe the prototype's current behavior. They are informational drafts, not legal advice. Before public production use, replace them with jurisdiction-reviewed policies, the operator's legal identity and support/privacy contact details, and disclosures matching the actual backend, data retention, security, and third-party integrations.
