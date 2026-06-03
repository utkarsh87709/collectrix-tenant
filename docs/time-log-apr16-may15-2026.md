# Development Time Log

**Period:** 16 April 2026 → 15 May 2026
**Working days only** — Sundays and Mondays excluded.
**Total working days:** 22

---

## Summary

Aggregated development log covering the build-out of the Tenant Operations
Platform across Intake, Debtor Management, Communications, Voice, Workflows,
Payments, Dashboards, Compliance, and Status Code Management modules.

---

## Day-by-day log

### Thu, 16 Apr 2026 — Intake · Import
- Module: **Intake → File Import**
- Built CSV/Excel import wizard route (`tenant.intake.import.tsx`).
- Field mapping UI, header detection, row preview, validation summary.
- Wired `intake-mock.ts` data layer with column-mapping persistence.

### Fri, 17 Apr 2026 — Intake · CRM Connect
- Module: **Intake → CRM Integration**
- Created `tenant.intake.crm.connect.tsx` and `tenant.intake.crm.index.tsx`.
- Added connection cards (Salesforce / HubSpot / custom), test-connection
  server route (`api.crm.test-connection.ts`).
- Mock `crm-mock.ts` with provider catalog + sample mappings.

### Sat, 18 Apr 2026 — Intake · CRM Mappings & Activity
- Sub-modules: **CRM Mappings**, **CRM Activity Log**
- Built `tenant.intake.crm.mappings.tsx` (field-level mapping editor).
- Built `tenant.intake.crm.activity.tsx` (sync history + retry).
- Server routes: `api.crm.sync.ts`, `api.crm.webhook.ts`.

### Tue, 21 Apr 2026 — Intake · Deduplication Queue
- Module: **Intake → Dedupe**
- Built `tenant.intake.dedupe.tsx` comparison view.
- Added action buttons per Jas's feedback: **Merge**, **Delete Record**,
  **Keep Both**, **Not a Duplicate**.
- Side-by-side field diff highlighting; bulk select.

### Wed, 22 Apr 2026 — Intake · Retention & Archival
- Module: **Intake → Retention**
- Built `tenant.intake.retention.tsx` policy management.
- Clarified action labels per Jas: Archive (hide, keep record), Anonymize
  (strip PII, keep reporting), Purge (permanent delete).
- Tenant-configurable thresholds; explainer cards; create-policy dialog.

### Thu, 23 Apr 2026 — Intake · Audit + Index
- Sub-modules: **Intake Audit Log**, **Intake Hub**
- Built `tenant.intake.audit.tsx` (filterable event log).
- Built `tenant.intake.index.tsx` summary hub with KPIs and shortcuts.

### Fri, 24 Apr 2026 — Debtor Listing
- Module: **Debtors → Listing**
- Built `tenant.debtors.index.tsx`: search by name, search by external ID,
  filter by creditor, filter by status, export selected, row click → detail.
- Replaced static "matching debtors" number with **Review Matching Debtors**
  CTA linking into the dedupe queue.

### Sat, 25 Apr 2026 — Debtor Detail · Header + Tabs scaffold
- Module: **Debtors → Detail**
- Created `tenant.debtors.$debtorId.tsx`.
- Compact header: name, internal ID, external ID, creditor, status, balance,
  created date, quick actions.
- Tabs scaffold: Overview / Data Profile / Notes / Timeline / Communication /
  Calls / Payments.

### Tue, 28 Apr 2026 — Debtor Detail · Overview + Notes/Timeline trim
- Sub-modules: **Overview**, **Notes**, **Timeline**
- Overview shows latest 3 notes + latest 3 timeline events with
  "View All" / "View Full Timeline" CTAs (per Jas's 50-item concern).
- Built `NoteCard.tsx`, `NoteEditor.tsx`, `RichTextToolbar.tsx`.
- Note detail route `tenant.debtors.$debtorId.notes.$noteId.tsx`.

### Wed, 29 Apr 2026 — Debtor Detail · Communication tab
- Module: **Communication (in-debtor)**
- SMS direct list view; Email threaded view keyed by subject.
- Channel-specific composers (Email gets Subject field).
- Removed "All / AI / Agent" filters per feedback.

### Thu, 30 Apr 2026 — Debtor Detail · Calls tab + CommsDialog
- Sub-module: **Calls & Transcripts**
- Built `CommsDialog.tsx` with AI summary, scrollable speaker-labeled
  transcript, HTML5 audio player.
- Call detail route `tenant.debtors.$debtorId.calls.$callId.tsx`.
- Wired header **Call**, **Message**, **Record Payment** buttons to switch
  to the matching tab via controlled `activeTab` state.

### Fri, 1 May 2026 — Debtor Detail · Flags + Data Profile
- Sub-modules: **Flag Editor**, **Data Profile tab**
- `FlagEditor`: select preset flags + add custom flag inline.
- Fixed dropdown clipping (removed `overflow-hidden` on header card).
- New top-level **Data Profile** tab beside Overview (moved out of Compliance).

### Sat, 2 May 2026 — Comms · SMS + Email + Inbox
- Module: **Communications**
- Built `tenant.comms.sms.tsx`, `tenant.comms.email.tsx`,
  `tenant.comms.inbox.tsx`, `tenant.comms.index.tsx`.
- `comms-mock.ts` data layer; send/schedule server routes
  (`api.comms.send.ts`, `api.comms.schedule.ts`, `api.comms.webhook.ts`).

### Tue, 5 May 2026 — Comms · Letters suite
- Sub-modules: **Letters Builder, Approval, Bulk, Index**
- Routes: `tenant.comms.letters.builder.tsx`,
  `tenant.comms.letters.approval.tsx`, `tenant.comms.letters.bulk.tsx`,
  `tenant.comms.letters.index.tsx`, `tenant.comms.letters.tsx`.
- Server routes: generate, parse-pdf, compliance, approve, dispatch.

### Wed, 6 May 2026 — Comms · Campaigns, Bulk, Templates, Compliance, History, Analytics
- Sub-modules across Communications hub.
- Routes: campaigns, bulk, templates, compliance, history, analytics.
- Compliance gating per channel; template variables; analytics charts.

### Thu, 7 May 2026 — Voice · Core
- Module: **Voice**
- Routes: `tenant.voice.index.tsx`, `live`, `transcripts`, `recordings`,
  `voicemail`, `callbacks`.
- `voice-mock.ts`, `calls-store.ts`; server routes: `start-call`,
  `transcribe`, `voicemail-drop`, `payment`.

### Fri, 8 May 2026 — Voice · Configuration & QA
- Sub-modules: **Config, Languages, Escalation, QA, Analytics, Conversation,
  Payments**.
- Routes built; calling-hours engine, agent-availability utilities,
  compliance-aware call gating.

### Sat, 9 May 2026 — Workflows
- Module: **Workflows**
- Routes: builder, aging, callbacks, ptp-brp, brp-analytics, index.
- `workflows-store.ts` with rule persistence; aging buckets visualization.

### Tue, 12 May 2026 — Payments
- Module: **Payments**
- Routes: index, plans, settlements; `payment-integration.tsx`.
- Stores: `payments-store.ts`, `payments-audit-store.ts`;
  `payments-mock.ts`, `tenant-monthly-payments.ts`.
- `PaymentStatusCard` component.

### Wed, 13 May 2026 — Dashboards
- Module: **Dashboards**
- Built role-based dashboards: executive, agents, supervisor, finance,
  compliance, portfolio, clients.
- Plus builder, exports, scheduled, index.
- `dashboards-mock.ts`, shared `DashboardFilters`.

### Thu, 14 May 2026 — Compliance & Status Codes (Epic 12 part 1)
- Modules: **Compliance**, **Status Code Management**
- Compliance: rules store, audit store, orchestrator, jurisdiction detect,
  disclosure engine, frequency-limit engine, prohibited-practice scanner,
  call-time guard, compliance card, jurisdiction badge.
- Status Codes: `status-codes-mock.ts`, `status-codes-store.ts`,
  `status-validation-mock.ts`, `quick-actions-mock.ts`,
  `legacy-migration-mock.ts`.

### Fri, 15 May 2026 — Status Codes UI (Epic 12 part 2) + Settings
- Sub-modules: **Hierarchy, Reason Codes, Outcomes/Dispositions,
  Validation Rules, Quick Actions, Legacy Migration, Advanced Analytics,
  Status Audit**.
- Components under `src/components/tenant/statuses/`.
- Routes: `tenant.settings.statuses.tsx`, `tenant.settings.statuses.audit.tsx`.
- Settings hub, billing, roles, users, security, onboarding pages finalized.
- Integrated `StatusChangeDialog`, `QuickActionRunner`, `SubStatusBadge`
  into Debtor Detail.

---

## Module rollup

| Module | Sub-modules delivered | Days |
|---|---|---|
| Intake | Import, CRM (connect/mappings/activity), Dedupe, Retention, Audit, Hub | 6 |
| Debtors | Listing, Detail (Header, Overview, Data Profile, Notes, Timeline, Communication, Calls, Flags) | 5 |
| Communications | SMS, Email, Inbox, Letters (4), Campaigns, Bulk, Templates, Compliance, History, Analytics | 3 |
| Voice | Live, Transcripts, Recordings, Voicemail, Callbacks, Config, Languages, Escalation, QA, Analytics, Conversation, Payments | 2 |
| Workflows | Builder, Aging, Callbacks, PTP-BRP, BRP Analytics | 1 |
| Payments | Index, Plans, Settlements, Integration | 1 |
| Dashboards | Executive, Agents, Supervisor, Finance, Compliance, Portfolio, Clients, Builder, Exports, Scheduled | 1 |
| Compliance + Status Codes | Rules, Audit, Orchestrator, Hierarchy, Reason Codes, Outcomes, Validation, Quick Actions, Migration, Analytics | 2 |
| Settings & Admin | Settings hub, Billing, Roles, Users, Security, Onboarding | 1 |

**Total: 22 working days** (Sundays & Mondays excluded between 16 Apr and 15 May 2026).
