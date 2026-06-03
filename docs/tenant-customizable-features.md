# Tenant Customizable Features — Actual Inventory

Strictly what exists in the tenant portal today, derived from the route files in `src/routes/tenant.*`. One row per page that is actually shipped.

| # | Area | Page | Route file |
|---|------|------|------------|
| 1 | Home | Tenant dashboard | `tenant.index.tsx` |
| 2 | Onboarding | Onboarding checklist | `tenant.onboarding.tsx` |
| 3 | Settings | Settings hub | `tenant.settings.index.tsx` |
| 4 | Settings | Statuses & sub-statuses | `tenant.settings.statuses.tsx` |
| 5 | Settings | Status change audit | `tenant.settings.statuses.audit.tsx` |
| 6 | Users | Users | `tenant.users.tsx` |
| 7 | Users | Roles | `tenant.roles.tsx` |
| 8 | Security | Security | `tenant.security.tsx` |
| 9 | Audit | Audit log | `tenant.audit.tsx` |
| 10 | Billing | Tenant billing | `tenant.billing.tsx` |
| 11 | Assignment | Assignment rules | `tenant.assignment.tsx` |
| 12 | Compliance | Compliance | `tenant.compliance.index.tsx` |
| 13 | Intake | Intake hub | `tenant.intake.index.tsx` |
| 14 | Intake | Import | `tenant.intake.import.tsx` |
| 15 | Intake | Dedupe | `tenant.intake.dedupe.tsx` |
| 16 | Intake | Retention | `tenant.intake.retention.tsx` |
| 17 | Intake | Intake audit | `tenant.intake.audit.tsx` |
| 18 | Intake / CRM | CRM index | `tenant.intake.crm.index.tsx` |
| 19 | Intake / CRM | CRM connect | `tenant.intake.crm.connect.tsx` |
| 20 | Intake / CRM | CRM field mappings | `tenant.intake.crm.mappings.tsx` |
| 21 | Intake / CRM | CRM activity | `tenant.intake.crm.activity.tsx` |
| 22 | Workflows | Follow-up queue | `tenant.workflows.index.tsx` |
| 23 | Workflows | PTP / BRP tracker | `tenant.workflows.ptp-brp.tsx` |
| 24 | Workflows | BRP analytics | `tenant.workflows.brp-analytics.tsx` |
| 25 | Workflows | Callbacks | `tenant.workflows.callbacks.tsx` |
| 26 | Workflows | Aging stages | `tenant.workflows.aging.tsx` |
| 27 | Workflows | Workflow builder | `tenant.workflows.builder.tsx` |
| 28 | Comms | Comms hub | `tenant.comms.index.tsx` |
| 29 | Comms | Templates | `tenant.comms.templates.tsx` |
| 30 | Comms | Email | `tenant.comms.email.tsx` |
| 31 | Comms | SMS | `tenant.comms.sms.tsx` |
| 32 | Comms | Voice | `tenant.comms.voice.tsx` |
| 33 | Comms | Inbox | `tenant.comms.inbox.tsx` |
| 34 | Comms | History | `tenant.comms.history.tsx` |
| 35 | Comms | Analytics | `tenant.comms.analytics.tsx` |
| 36 | Comms | Bulk send | `tenant.comms.bulk.tsx` |
| 37 | Comms | Campaigns | `tenant.comms.campaigns.tsx` |
| 38 | Comms | Compliance | `tenant.comms.compliance.tsx` |
| 39 | Comms / Letters | Library | `tenant.comms.letters.index.tsx` |
| 40 | Comms / Letters | Builder | `tenant.comms.letters.builder.tsx` |
| 41 | Comms / Letters | Bulk generate | `tenant.comms.letters.bulk.tsx` |
| 42 | Comms / Letters | Approval queue | `tenant.comms.letters.approval.tsx` |
| 43 | Voice | Voice hub | `tenant.voice.index.tsx` |
| 44 | Voice | Configuration | `tenant.voice.config.tsx` |
| 45 | Voice | Languages | `tenant.voice.languages.tsx` |
| 46 | Voice | Escalation | `tenant.voice.escalation.tsx` |
| 47 | Voice | Callbacks | `tenant.voice.callbacks.tsx` |
| 48 | Voice | In-call payments | `tenant.voice.payments.tsx` |
| 49 | Voice | QA | `tenant.voice.qa.tsx` |
| 50 | Voice | Voicemail drops | `tenant.voice.voicemail.tsx` |
| 51 | Voice | Conversation flows | `tenant.voice.conversation.tsx` |
| 52 | Voice | Live calls | `tenant.voice.live.tsx` |
| 53 | Voice | Recordings | `tenant.voice.recordings.tsx` |
| 54 | Voice | Transcripts | `tenant.voice.transcripts.tsx` |
| 55 | Voice | Analytics | `tenant.voice.analytics.tsx` |
| 56 | Payments | Overview | `tenant.payments.index.tsx` |
| 57 | Payments | Payment plans | `tenant.payments.plans.tsx` |
| 58 | Payments | Settlements | `tenant.payments.settlements.tsx` |
| 59 | Dashboards | Hub | `tenant.dashboards.index.tsx` |
| 60 | Dashboards | Executive | `tenant.dashboards.executive.tsx` |
| 61 | Dashboards | Supervisor | `tenant.dashboards.supervisor.tsx` |
| 62 | Dashboards | Agents | `tenant.dashboards.agents.tsx` |
| 63 | Dashboards | Finance | `tenant.dashboards.finance.tsx` |
| 64 | Dashboards | Compliance | `tenant.dashboards.compliance.tsx` |
| 65 | Dashboards | Portfolio | `tenant.dashboards.portfolio.tsx` |
| 66 | Dashboards | Clients | `tenant.dashboards.clients.tsx` |
| 67 | Dashboards | Scheduled reports | `tenant.dashboards.scheduled.tsx` |
| 68 | Dashboards | Data exports | `tenant.dashboards.exports.tsx` |
| 69 | Dashboards | Builder | `tenant.dashboards.builder.tsx` |
| 70 | Debtors | Debtor list | `tenant.debtors.index.tsx` |
| 71 | Debtors | Debtor detail | `tenant.debtors.$debtorId.tsx` |
| 72 | Debtors | Call detail | `tenant.debtors.$debtorId.calls.$callId.tsx` |
| 73 | Debtors | Note detail | `tenant.debtors.$debtorId.notes.$noteId.tsx` |
