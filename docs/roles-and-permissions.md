# Roles & Permissions — permission model and backend contract

This replaces the placeholder permission catalog (numeric `configId`s from `getConfiguredRoles`) with a model built from the APIs each module actually calls. The frontend side is done. The backend shipped the role endpoints in section 2; see **Backend status** below for what is still open.

The source of truth is [`src/lib/permissions/catalog.ts`](../src/lib/permissions/catalog.ts). The tables in section 5 were generated from it. If the two ever disagree, the code wins.

## Backend status (verified live 2026-10-14)

| Item | Status |
| --- | --- |
| `getAllRole` returns `permissionSchema: 2`, `roleDescription`, `permissions`, `userCount` | Done |
| `createRole` / `updateRole` accept `permissions` | Done |
| `deleteRole` | Done |
| `getConfiguredRoles` removed | Done (404) |
| Duplicate `roleName` rejected (case-insensitive) | Done |
| Empty `roleName` rejected | **Open** — saves a role with an empty name |
| Unknown permission keys rejected | **Open** — stored as sent |
| `deleteRole` refuses a role users are on | Not verified (not tested on a live role); unknown `roleId` returns success |
| `myProfile` returns `permissions` | **Open** — frontend falls back to `getAllRole` |
| Endpoints check the caller's permission key (section 3) | **Open** — e.g. `deleteClient` succeeds without `clients.delete` |

## 1. The model

Permissions follow the sidebar: **module → page → action**.

- A **module** is a sidebar group, such as Case Files or Access Control.
- A **page** is a screen, or a tab of the customer profile that has its own endpoints (Notes, SMS & email, Calls, Documents).
- An **action** is one thing a user can do on that page. Most pages have View / Create / Edit / Delete. Some add domain actions like Send SMS, Take on or Release.

Each action is a stable string key, `<page>.<action>`, for example `customers.notes.delete`. A role stores a list of these keys. That gives 76 keys across 22 pages in 8 modules.

Keys are permanent identifiers. Never rename or reuse one: add a new key and migrate instead.

Two rules hold for every role:

1. **Every action needs its page's View.** For example, `customers.notes.delete` needs `customers.notes.view`.
2. **Some pages need another page's View.** The full list:

| Permission                 | Also requires                               |
| -------------------------- | ------------------------------------------- |
| `customers.notes.view`     | `customers.view`                            |
| `customers.messages.view`  | `customers.view`                            |
| `customers.calls.view`     | `customers.view`                            |
| `customers.documents.view` | `customers.view`                            |
| `inbox.view`               | `customers.view`, `customers.messages.view` |

The built-in **tenantAdmin** role is not a row in `getAllRole` and always has every permission. The frontend treats `role === "tenantAdmin"` as full access whatever list it receives.

Permissions decide what a user may _do_. Which files they _see_ is still scoped by the backend as today; for example, `getCustomerList` only returns files assigned to the caller. Nothing about data scoping changes.

## 2. API changes

All endpoints keep the existing conventions: `POST`, raw token in `Authorization`, and the `{ meta, data }` envelope where success is `meta.status === true`.

### `POST /tenant/getAllRole` — changed

```jsonc
// request
{}
// response data
{
  "permissionSchema": 2,             // NEW — tells the frontend this is the new format
  "roles": [
    {
      "roleId": 4,
      "roleName": "Collections agent",
      "roleDescription": "Works their own files",   // NEW — was never returned before
      "userCount": 12,
      "permissions": ["customers.view", "customers.changeStatus", "inbox.view"]  // NEW — replaces allowedConfiguration
    }
  ]
}
```

`totalConfiguration` and `allowedConfiguration` can be dropped.

### `POST /tenant/createRole` and `POST /tenant/updateRole` — changed

```jsonc
// createRole request
{ "roleName": "Team lead", "roleDescription": "Runs a team", "permissions": ["customers.view", "teamDeck.assign"] }
// updateRole request — same plus roleId
{ "roleId": 4, "roleName": "Team lead", "roleDescription": "Runs a team", "permissions": ["..."] }
// response data: createRole → {}, updateRole → {}
```

Validation, all returned as `meta.status: false` with the message shown to the user:

| Case                                                  | Expected behaviour                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Empty `roleName`                                      | Reject: "Role name is required."                                                                                         |
| Duplicate `roleName` in the tenant (case-insensitive) | Reject: "Role name already exists."                                                                                      |
| A key that isn't in the catalog                       | Reject: "Unknown permission: `<key>`."                                                                                   |
| A key whose requirements are missing                  | Add the missing requirements before saving. The frontend always sends a complete set, so this only guards other clients. |
| `permissions: []`                                     | Allowed. The role can only open Overview.                                                                                |

A role change must take effect on the next request of every user on that role, without them signing in again.

### `POST /tenant/deleteRole` — new

```jsonc
// request
{ "roleId": 4 }
// response data
{}
```

Reject with `meta.status: false` and "This role is assigned to N users. Move them to another role first." while `userCount > 0`.

### `POST /tenant/myProfile` — changed

Add the caller's own keys to the existing response:

```jsonc
{
  "userId": 17,
  "roleId": 4,
  "role": "Collections agent",
  // …existing fields unchanged…
  "permissions": ["customers.view", "inbox.view"], // NEW
}
```

This matters because `getAllRole` now needs `roles.view`. Without this field an agent couldn't read their own permissions. For tenantAdmin, send `[]` or every key; the frontend ignores it.

### `POST /tenant/getConfiguredRoles` — retired

The catalog now lives in the frontend, so nothing calls this endpoint any more. The backend still needs the list of valid keys to validate saves. Keep a copy of the key column in section 5, or load it from `catalog.ts`.

## 3. Enforcing permissions on endpoints

Every endpoint in section 5 needs the key it is listed under. The frontend hides controls the user can't use, but that is a courtesy. The backend check is the real boundary.

When a check fails, keep the envelope convention: HTTP 200 with `meta: { status: false, code: 403, message: "You don't have permission to <what they tried>." }`. The frontend shows `meta.message` in a toast. It also copes with HTTP 403, so either works.

Some endpoints serve several pages and follow different rules:

| Endpoint                                                                                                                      | Who may call it                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `getclientList`, `getStatusList`, `getAllStatus`, `getTeamList`, `getMovedTeamList`, `assignTeamList`                         | Any signed-in user. These are lightweight pickers used across pages.                       |
| `myProfile`, `updateProfile`, `uploadProfilePic`, `sendResetMyPasswordLink`, `getTimezoneList`, `/user/logout`                | Any signed-in user, acting on themselves.                                                  |
| `getAllClients`                                                                                                               | `clients.view` **or** `imports.view`. The upload page reads clients for its client picker. |
| `getClientTemplate`                                                                                                           | `templates.view` **or** `statusAutomation.view`. Status automation picks templates.        |
| `getTeamDeckAssignUserList`                                                                                                   | `teamDeck.assign`, `movedFiles.takeOn`, `inbox.assign` **or** `statusAutomation.view`.     |
| `getRoleList`                                                                                                                 | `users.view`. Used for the role picker on the user form.                                   |
| `getTeamPhoneNumber`                                                                                                          | `users.create` **or** `users.edit`.                                                        |
| `getAllLeaderList`, `getUnassignedTeamMemember`, `getTeamNumbers`                                                             | `teams.create` **or** `teams.edit`.                                                        |
| `/user/login`, `validateResetPassword`, `resetPassword`, `getInviteCodeDetails`, `makePayment`, `completeTenantInviteOnboard` | Public, unchanged.                                                                         |

Four permissions have no endpoint of their own and are enforced only in the frontend: `customers.export`, `archive.export` and `audit.export` build CSVs from data the user can already see, and `statuses.view` opens a page whose data comes from the `getAllStatus` picker.

One related backend issue: `getTenantDetails` returns `senderEmailPassword` in plain text to anyone who can open Settings. It should be masked or omitted, and only accepted on `updateTenantDetails` from callers with `settings.edit`.

## 4. Migrating existing roles

Existing roles hold numeric `allowedConfiguration` ids. Convert each role once, when the new format ships:

```text
for each role:
    held = set(role.allowedConfiguration)
    keys = every catalog key K where
             K is not in the table below, OR held contains any id listed for K
    role.permissions = keys plus all their requirements
```

| New key                        | Granted when the role held any of these configIds |
| ------------------------------ | ------------------------------------------------- |
| `customers.edit`               | 3, 4, 7                                           |
| `customers.changeStatus`       | 18                                                |
| `customers.manageFlags`        | 3, 6, 7, 18                                       |
| `customers.moveTeam`           | 16                                                |
| `customers.archive`            | 13                                                |
| `customers.stopEngagement`     | 11                                                |
| `customers.resumeEngagement`   | 12                                                |
| `customers.export`             | 15                                                |
| `customers.notes.create`       | 6                                                 |
| `customers.notes.edit`         | 6                                                 |
| `customers.notes.delete`       | 6                                                 |
| `customers.messages.sendSms`   | 24                                                |
| `customers.messages.sendEmail` | 24                                                |
| `customers.calls.place`        | 23                                                |
| `customers.documents.generate` | 6                                                 |
| `customers.documents.delete`   | 6                                                 |
| `inbox.assign`                 | 16                                                |
| `archive.restore`              | 13                                                |

Keys missing from the table are granted to every role, because the old system never restricted them; every page was open to every signed-in user. This keeps each user's access exactly as it is today. The frontend applies the same translation until the backend switches over.

Review roles right after migrating. The old system didn't restrict Users, Roles or Settings, so every migrated role starts with `users.create`, `users.edit`, `roles.create`, `roles.edit` and `roles.delete`. These are marked as sensitive in the editor. Remove them from every role that shouldn't manage access.

## 5. Permission catalog

### Case Files

Customer files and the team queues they move through.

| Page            | Key                            | Allows                                                                                    | Endpoints                                                                    |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Customers**   | `customers.view`               | Open the Customers list and customer profiles, including flags and the activity timeline. | `getCustomerList`, `getCustomerDetails`, `getCustomerTimeline`, `getTagList` |
|                 | `customers.edit`               | Change a customer's contact, financial and file details.                                  | `updateCustomerDetails`                                                      |
|                 | `customers.changeStatus`       | Set a file's status, one at a time or in bulk.                                            | `updateCustomerStatus`                                                       |
|                 | `customers.manageFlags`        | Add and remove flags on a file.                                                           | `assignCustomerTag`, `deleteCustomerTag`                                     |
|                 | `customers.moveTeam`           | Transfer files to another team's Moved Files queue.                                       | `changeCustomerTeam`                                                         |
|                 | `customers.archive`            | Park a file in the Archive, out of the active workload.                                   | `archiveCustomer`                                                            |
|                 | `customers.stopEngagement`     | Pause all outreach on a file.                                                             | `stopEngagement`                                                             |
|                 | `customers.resumeEngagement`   | Restart outreach on a file where it was stopped.                                          | `startEngagement`                                                            |
|                 | `customers.export`             | Download customer files as CSV.                                                           | _frontend only_                                                              |
| **Notes**       | `customers.notes.view`         | Read a file's notes and open their attachments.                                           | `getCustomerNotes`                                                           |
|                 | `customers.notes.create`       | Add notes, with attachments, to a file.                                                   | `createCustomerNotes`                                                        |
|                 | `customers.notes.edit`         | Change any note on a file.                                                                | `updateCustomerNotes`                                                        |
|                 | `customers.notes.delete`       | Delete any note on a file. A reason is always required.                                   | `deleteCustomerNotes`                                                        |
| **SMS & email** | `customers.messages.view`      | Read the SMS and email history on a file.                                                 | `getCustomerSms`, `getCustomerEmail`                                         |
|                 | `customers.messages.sendSms`   | Text a customer from the profile or the inbox.                                            | `sendCustomerSms`                                                            |
|                 | `customers.messages.sendEmail` | Email a customer from the profile or the inbox.                                           | `sendCustomerEmail`                                                          |
| **Calls**       | `customers.calls.view`         | Play recordings and read call transcripts and summaries.                                  | `getCustomerCalls`, `getCustomerCallDetails`                                 |
|                 | `customers.calls.place`        | Call a customer from one of the tenant's caller IDs.                                      | `callCustomerNumberList`, `initiateCustomerCall`                             |
| **Documents**   | `customers.documents.view`     | See and download a file's generated documents.                                            | `getCustomerDocuments`                                                       |
|                 | `customers.documents.generate` | Generate a document for a file from one of its client's templates.                        | `getCustomerDocumentTemplateList`, `generateCustomerDocuments`               |
|                 | `customers.documents.delete`   | Delete a generated document.                                                              | `deleteCustomerDocument`                                                     |
| **Team Deck**   | `teamDeck.view`                | Browse each team's deck and the files its members are working.                            | `getTeamDeckTeamList`, `getTeamDeckDebtors`, `getCreditorList`               |
|                 | `teamDeck.assign`              | Hand deck files to a team member, or reassign them.                                       | `teamDeckAssignUser`                                                         |
| **Moved Files** | `movedFiles.view`              | See the files moved to each team.                                                         | `getMovedCustomers`                                                          |
|                 | `movedFiles.takeOn`            | Set a status on moved files and hand them to a member.                                    | `assignMovedFileStatusAndUser`                                               |
| **Archive**     | `archive.view`                 | Browse and search archived files.                                                         | `getArchivedCustomers`                                                       |
|                 | `archive.restore`              | Return an archived file to its team's active workload.                                    | `UnArchiveCustomer`                                                          |
|                 | `archive.export`               | Download the archive list as CSV.                                                         | _frontend only_                                                              |

### Inbound Inbox

Customer replies by SMS and email, in one place.

| Page              | Key            | Allows                                                    | Endpoints           |
| ----------------- | -------------- | --------------------------------------------------------- | ------------------- |
| **Inbound Inbox** | `inbox.view`   | Open the inbox and read conversations.                    | `getInboxCustomers` |
|                   | `inbox.assign` | Hand a conversation's file to another member of its team. | `inboxAssignUser`   |

### Engagement

The phone numbers and templates outreach is sent with.

| Page                 | Key                    | Allows                                                                   | Endpoints                                             |
| -------------------- | ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Phone numbers**    | `phoneNumbers.view`    | See the tenant's numbers and their status.                               | `getNumberList`                                       |
|                      | `phoneNumbers.buy`     | Search for and buy new numbers.                                          | `getTwilioCountries`, `getNumbers`, `buyNumber`       |
|                      | `phoneNumbers.edit`    | Turn numbers on or off and choose whether each one calls, texts or both. | `enableNumber`, `disableNumber`, `updateNumberConfig` |
|                      | `phoneNumbers.release` | Release a number permanently. It can't be recovered.                     | `releaseNumber`                                       |
| **Template library** | `templates.view`       | Browse every template, voice agent and prompt.                           | `getTemplateClients`, `getClientTemplate`             |
|                      | `templates.create`     | Add templates, voice agents and prompts.                                 | `createTemplate`, `createDocumentTemplate`            |
|                      | `templates.edit`       | Change existing templates, voice agents and prompts.                     | `updateTemplate`, `updateDocumentTemplate`            |
|                      | `templates.delete`     | Delete templates, voice agents and prompts.                              | `deleteTemplate`                                      |

### Data Intake

Clients, customer file imports and bulk updates.

| Page                     | Key                  | Allows                                                       | Endpoints                                                      |
| ------------------------ | -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| **Client list**          | `clients.view`       | See every client and its channel settings.                   | `getAllClients`                                                |
|                          | `clients.create`     | Add clients.                                                 | `createClient`                                                 |
|                          | `clients.edit`       | Rename clients and change which channels they allow.         | `updateClient`                                                 |
|                          | `clients.delete`     | Delete clients.                                              | `deleteClient`                                                 |
| **Upload customer data** | `imports.view`       | See past imports and the records in each one.                | `getUploadedDebtor`, `debtorFileDetails`                       |
|                          | `imports.upload`     | Validate and import a new customer file.                     | `downloadSampleTemplate`, `validateDebtorFile`, `uploadDebtor` |
|                          | `imports.edit`       | Correct records that were flagged during validation.         | `updateNewDebtor`                                              |
|                          | `imports.assignTeam` | Hand imported files to a team.                               | `assignTeam`                                                   |
| **Mass update**          | `massUpdate.view`    | Browse and filter files for a mass update.                   | `getMassUpdateDebtorList`                                      |
|                          | `massUpdate.apply`   | Upload a corrected spreadsheet and update the files in bulk. | `validateMassUpdateDebtor`, `updateMassDebtor`                 |
|                          | `massUpdate.export`  | Download the selected files as a spreadsheet.                | `downloadMassUpdateDebtorList`                                 |

### Compliance

The tenant's audit trail.

| Page                 | Key            | Allows                                  | Endpoints                      |
| -------------------- | -------------- | --------------------------------------- | ------------------------------ |
| **Activity & audit** | `audit.view`   | Search and filter the audit log.        | `getAuditLogs`, `getEventList` |
|                      | `audit.export` | Download the filtered audit log as CSV. | _frontend only_                |

### Access Control

Who can sign in, the teams they belong to, and what they can do.

| Page                    | Key                   | Allows                                                        | Endpoints                                               |
| ----------------------- | --------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| **Users**               | `users.view`          | See every user, their role, teams and numbers.                | `getUsers`                                              |
|                         | `users.create`        | Invite new users and choose their role. ⚠ sensitive           | `createUser`                                            |
|                         | `users.edit`          | Change a user's details, role, teams and numbers. ⚠ sensitive | `updateUser`                                            |
|                         | `users.resetPassword` | Generate a password reset link for a user.                    | `resetUserPassword`                                     |
|                         | `users.deactivate`    | Block a user from signing in, or let them back in.            | `activateUser`, `disableUser`                           |
| **Teams**               | `teams.view`          | See teams as cards or as an org chart.                        | `getTeamsCardView`, `getTeamsOrgView`, `getTeamDetails` |
|                         | `teams.create`        | Create teams.                                                 | `createTeam`                                            |
|                         | `teams.edit`          | Change a team's name, leader, members and numbers.            | `updateTeam`                                            |
|                         | `teams.delete`        | Delete a team. Its members and numbers are released.          | `deleteTeam`                                            |
| **Roles & permissions** | `roles.view`          | See every role and its permissions.                           | `getAllRole`                                            |
|                         | `roles.create`        | Create roles. ⚠ sensitive                                     | `createRole`                                            |
|                         | `roles.edit`          | Change a role's name and permissions. ⚠ sensitive             | `updateRole`                                            |
|                         | `roles.delete`        | Delete roles that no user is assigned to. ⚠ sensitive         | `deleteRole`                                            |

### Configuration

Workspace-wide settings.

| Page                | Key                 | Allows                                                           | Endpoints                             |
| ------------------- | ------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| **Tenant settings** | `settings.view`     | See the organization, hours and connector settings.              | `getTenantDetails`                    |
|                     | `settings.edit`     | Change the organization profile, operating hours and connectors. | `updateTenantDetails`                 |
| **Data fields**     | `dataFields.view`   | See the default and custom data fields.                          | `getDefaultFields`, `getCustomFields` |
|                     | `dataFields.create` | Add custom fields.                                               | `createCustomFields`                  |
|                     | `dataFields.edit`   | Rename custom fields or change their type.                       | `updateCustomFields`                  |
|                     | `dataFields.delete` | Delete custom fields.                                            | `deleteCustomFields`                  |

### System Configuration

The account lifecycle and what happens automatically at each step.

| Page                  | Key                     | Allows                                                             | Endpoints                                                                          |
| --------------------- | ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Statuses**          | `statuses.view`         | Open the Statuses page.                                            | _frontend only_                                                                    |
|                       | `statuses.create`       | Add statuses.                                                      | `createStatus`                                                                     |
|                       | `statuses.edit`         | Rename and recolour statuses. Changes apply to every file on them. | `updateStatus`                                                                     |
|                       | `statuses.delete`       | Delete statuses no file is on.                                     | `deleteStatus`                                                                     |
| **Status automation** | `statusAutomation.view` | See the automation configured for each team and client.            | `getClientTeamStatusList`, `getStatusAutomationList`, `getStatusAutomationDetails` |
|                       | `statusAutomation.edit` | Change initial statuses and the automation on each status.         | `checkInitialStatusUsed`, `changeInitialStatus`, `updateAutomation`                |

## 6. Frontend notes

- **Where things live.** The catalog, its dependency rules and the role presets are in `src/lib/permissions/`. Runtime checks use `usePermissions().can(key)` from `store.ts`, and page access is mapped in `routes.ts`. That one table drives the route guard in `__root.tsx`, the sidebar and the ⌘K palette.
- **Adding a permission.** Add the action to `catalog.ts`, gate the control with `can("<key>")`, and add the key to the backend's list and endpoint check. If it opens a new page, add a rule to `routes.ts`.
- **Where a user's grants come from.** `myProfile.permissions` when present; until the backend adds it, the store looks the user's `roleId` up in `getAllRole`. Every read goes through `normalizePermissions()`, which drops unknown keys and adds missing requirements, because the backend stores `permissions` exactly as sent. The legacy configId shim (`legacy.ts`) was removed on 2026-10-14.
- **Removed.** Document Automation (mock only, no backend) is gone from the sidebar and routes, along with the old `customer-permissions.ts`, `permission-modules.ts` and `role-permissions.ts`.
