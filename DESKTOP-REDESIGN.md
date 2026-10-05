# ZedPing desktop redesign

## Changes

- Forest-green navigation grouped into Workspace, Build and Manage. Contacts contains groups; Automations contains active rules and flows; WhatsApp contains numbers and templates; Settings contains business, team, integrations and billing.
- Compact Overview with real connection status, expandable setup, attention queue, agent deployments, recent campaigns and messages. Failed requests show unavailable/error states, not successful zero counts.
- Campaign list and addressable creation/detail pages, a template preview, persisted composition fields and explicit processing status. Sending, Scheduled, Processed and Failed stay distinct. Campaign times are shown in CAT.
- Three-panel Inbox retains assignments, takeover, resolution, bulk actions and rich replies. Conversation URLs and view filters survive refresh; text reply drafts are scoped to conversation, workspace and user in session storage.
- Zed AI retains the existing backend identifiers, agent names, knowledge, private tests, Test/Live/Paused lifecycle and commercial handoff configuration. The agent list prioritizes existing agents. Local edits recover within the same browser tab without publishing them.
- Flow drafts recover by workspace/user/flow and Back returns to the flow list. Publication semantics and role checks are unchanged.
- The shared surface, typography, input, button, status and table styling applies to all existing work pages. Existing small-screen behavior remains usable; this is not a separately approved mobile redesign.
- Legacy URLs remain aliases, including /broadcasts, /contact-groups, /chatbot-flows, /zoe-ai and their existing resource links.

## Data and scope

The design uses existing APIs. Analytics is an honest snapshot of available records and queue counts, not new backend reporting. Delivery/read rates, response times and AI resolution rates remain unavailable. No fictional charts or measurements are introduced. The integrations page directs users to the existing supported connection workflow and support for special integrations; it does not imply new connectors exist.

No authentication, tenancy, messaging or database APIs were replaced. No schema migration is required. Session-storage drafts are confined to the current browser tab, may be unavailable under browser storage restrictions, and are cleared on explicit sign-out. Text reply drafts are retained; attachment files must be selected again after refresh.

## Verification

- `node --test`: 98 tests, 95 passed, 3 pre-existing optional browser tests skipped.
- `node node_modules/typescript/bin/tsc -p tsconfig.app.json`: passed.
- Production Vite build: passed (existing large-bundle warning remains).
- `scripts/verify-desktop.cjs`: synthetic, network-intercepted production-build browser checks covering 15 destinations, Inbox deep links and Back/refresh, reply and campaign draft recovery, AI draft recovery, number states, unavailable metrics, and the existing narrow-screen menu. No browser runtime errors or unmatched API fixtures.
- Live authentication/database checks: pending by user instruction. Synthetic checks are not a claim of live end-to-end validation.

To run browser verification, serve the production build on `127.0.0.1:4186`, make Playwright available (or set `PLAYWRIGHT_MODULE` to its module path), and run `node scripts/verify-desktop.cjs`. Chrome is required. Screenshots are saved under ignored `desktop-artifacts/`. All external service requests are intercepted; fixture accounts are not real accounts.

On the restricted Windows review host, Vite's config bundler cannot traverse an ancestor directory. The successful equivalent build uses Vite's JavaScript API with `configFile:false`, the existing React plugin, and `esbuild.tsconfigRaw.compilerOptions.jsx = 'react-jsx'`. Project dependencies and the production build command are unchanged.
