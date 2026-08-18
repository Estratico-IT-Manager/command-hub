# Command Hub

**Offline-first internal management system for teams.**

Command Hub is Estratico's internal operations platform. It brings project tracking, subscription management, team collaboration, and role-based access control into one place — and it keeps working when the internet doesn't. Every change is written locally to IndexedDB and synced to the server automatically when you're back online.

## Features

- **Offline-first sync** — Changes are saved to a local IndexedDB (Dexie) database and queued for background sync. Online/offline status and a pending-changes badge are shown in the sidebar; the queue flushes automatically every 10 seconds.
- **Projects & Kanban board** — Team projects with a 5-column drag-and-drop board (Backlog → Done), priorities, assignees, due dates, and position-based ordering.
- **Subscription management** — Track services, providers, billing frequencies, costs, and payment history. Next billing dates are computed automatically and upcoming renewals surface on the dashboard.
- **Team collaboration** — Teams with OWNER/MEMBER roles, domain-restricted email invitations (1-day expiry), accept-invitation flow, and member management.
- **Role-based access control** — Four roles (System Admin, Admin, Employee, Intern) backed by a catalog of ~35 granular permissions, enforced on every API route and embedded in the auth session.
- **Audit logging** — Every create/update/delete across teams, projects, tasks, and subscriptions records old/new values, filterable by entity, user, and action.
- **Email automation** — Resend-powered transactional emails (team invitations, contact/enquiry templates) built with React Email.
- **Auth** — Better Auth email/password authentication with domain-restricted sign-up, 7-day sessions, and automatic role assignment.
- **Dashboard** — Live stats (projects, tasks, subscriptions, monthly spend, team members), recent activity, and upcoming renewals within 30 days.
- **CMS (content management)** — A generic, schema-driven CMS that powers any website. Register sites, define content types visually (text, markdown, image, select, relation, repeater fields), manage draft/published entries with JSON payloads, and consume them over a keyed public REST API. Media uploads are stored in Google Drive.
- **Theming** — Light, dark, and system themes.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI, tw-animate-css |
| Database | PostgreSQL (Neon-compatible via `@prisma/adapter-pg`), Prisma 7 ORM |
| Auth | Better Auth (email/password, Prisma adapter) |
| Data fetching | TanStack Query |
| Offline layer | Dexie (IndexedDB) + custom sync engine |
| Email | Resend, React Email |
| Forms | react-hook-form + Zod |
| Misc | date-fns, recharts, @hello-pangea/dnd, sonner, Vercel Analytics |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for local Postgres)

### 1. Clone and install

```bash
pnpm install
```

### 2. Set up the database

Start the local Postgres instance:

```bash
docker compose up -d
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection URL (Prisma) |
| `DIRECT_URL` | Direct (non-pooled) Postgres connection URL |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 characters) |
| `BETTER_AUTH_URL` | Base URL of the app |
| `RESEND_API_KEY` | Resend API key for transactional email |

Environment variables are validated at boot with Zod — the app will refuse to start on invalid config.

### 4. Migrate and seed

```bash
npx prisma migrate dev
pnpm seed
```

The seed creates the permission catalog and the four roles (System Admin, Admin, Employee, Intern). No demo users or teams are created.

### 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). New accounts must use an `@estratico.org.zw` email address; the super admin (`itmanagement@estratico.org.zw`) is granted the System Admin role automatically.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Deploy migrations, backfill RBAC, and build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm seed` | Seed the RBAC permission catalog and roles |

## Project Structure

```
app/
  (auth)/              # Login / register pages
  (dashboard)/         # Dashboard, projects, subscriptions, team, settings
  api/                 # Route handlers (teams, projects, subscriptions, sync, ...)
  invite/[id]/         # Team invitation acceptance page
components/
  ui/                  # shadcn/ui primitives
  dashboard/           # Dashboard widgets
  projects/            # Project lists, kanban board
  subscriptions/       # Subscription forms, tables, dialogs
  team/                # Team cards, members, invite dialogs
  invite/              # Accept-invitation client
  email-template.tsx   # React Email templates
hooks/
  use-mutations/       # Offline-first mutation hooks (write local, queue sync)
  use-*.ts             # TanStack Query data hooks, sync status, toasts
lib/
  auth.ts              # Better Auth configuration
  rbac/                # Permission catalog, role matrix, route guards
  offline-db.ts        # Dexie schema (IndexedDB)
  sync-engine.ts       # Sync queue, push/pull, retry logic
  env.ts               # Zod-validated environment
prisma/
  schema.prisma        # Data model
  seed.ts              # RBAC seeding
providers/
  syncProvider.tsx     # 10s sync-loop provider
```

## Architecture Overview

### Offline sync

Mutations never block on the network. Each write:

1. Persists to IndexedDB with a `pendingSync` flag and a temporary `offline_*` ID.
2. Enqueues a change in the sync queue.
3. Syncs immediately if online, otherwise on reconnect (or via the 10-second provider loop).

The `/api/sync` endpoint processes the queue (max 20 retries per item), remaps offline IDs to server IDs, and returns fresh records so the local database and React Query cache stay consistent.

### Access control

Two tiers of authorization:

- **Global RBAC** — `Role` / `Permission` / `RoleAssignment` tables define what a user may do (e.g. `task.delete`, `audit_log.view`). The user's permission summary is attached to their session and enforced server-side by `requirePermission` guards on API routes.
- **Team-level roles** — `TeamRole` (OWNER / MEMBER) governs operations within a team, such as inviting members or removing them.

### Audit logging

Mutating API routes write `audit_log` entries containing the actor, entity, action, and old/new values. The audit trail is queryable via `/api/audit-log` — global for users with `audit_log.view`, otherwise scoped to team owners' entities.

### API routes

| Route | Purpose |
| --- | --- |
| `/api/auth/[...all]` | Better Auth handler (sign-in, sign-up, sessions) |
| `/api/dashboard` | Aggregate stats for the dashboard |
| `/api/projects`, `/api/projects/[id]` | Project list and detail (with tasks and members) |
| `/api/subscriptions`, `/api/subscriptions/[id]` | Subscription list/stats and detail; soft delete |
| `/api/subscription-history` | Payment history CRUD |
| `/api/teams`, `/api/teams/[id]` | Team list and detail |
| `/api/teams/[id]/members/[memberId]` | Member role update / removal (owner only) |
| `/api/teams/invite`, `/api/teams/invite/[id]` | Create and accept invitations |
| `/api/sync` | Offline queue push and pull |
| `/api/audit-log` | Filterable audit trail |
| `/api/send` | Generic email sender (`email.send` permission) |
| `/api/cms/sites`, `/api/cms/sites/[siteId]` | CMS site CRUD + API key regeneration |
| `/api/cms/sites/[siteId]/types/...` | Content type and field schema management |
| `/api/cms/sites/[siteId]/types/[typeId]/entries/...` | Content entry CRUD (draft/publish) |
| `/api/cms/sites/[siteId]/media` | Media library + Google Drive uploads |
| `/api/public/[siteSlug]/[typeName]` | Public read API: list entries (published only) |
| `/api/public/[siteSlug]/[typeName]/[slug]` | Public read API: single entry |
| `/api/public/[siteSlug]/media` | Public read API: asset metadata |

## CMS (Content Management System)

Command Hub includes a generic CMS for powering websites.

### Concepts

- **Site** — a website the CMS manages (e.g. "estratico-profile"). Each site
  has its own API key (`x-api-key` header) for the public API.
- **Content Type** — a collection with a schema, e.g. `posts`, `services`,
  `projects`. Built visually in the admin UI ("Content → Websites").
- **Field** — a schema entry. Supported types: `TEXT`, `TEXTAREA`, `MARKDOWN`,
  `IMAGE`, `NUMBER`, `BOOLEAN`, `SELECT`, `MULTISELECT`, `DATE`, `DATETIME`,
  `RELATION` (points at another type's entry slug), `REPEATER` (list of block
  sub-fields).
- **Entry** — one record of a content type: slug, title (from the marked
  title field), JSON payload, `DRAFT`/`PUBLISHED` status, version, audit trail.
- **Media** — uploads stored in Google Drive (service account + shared folder),
  served as public URLs.

### Public API

```
GET /api/public/{siteSlug}/{typeName}?status=&page=&limit=&sort=&order=&slug=
GET /api/public/{siteSlug}/{typeName}/{slug}
GET /api/public/{siteSlug}/media
```

Auth: `x-api-key: <site API key>` (generated per site in the admin UI; stored
hashed). Only published, non-deleted entries are returned. Responses are
cacheable (`s-maxage=60`).

### Google Drive setup (media uploads)

1. Create a Google Cloud service account and download its JSON key.
2. Create a folder in Drive and share it with the service account email
   (Editor).
3. Set `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`
   in the environment (validated in `lib/env.ts`).

### Seeding content

```bash
pnpm seed:estratico    # creates the estratico-profile site, types, and content
pnpm migrate:posts     # migrates BaseHub posts into the CMS (needs BASEHUB_TOKEN)
```

Consumers (e.g. the profile website) fetch content over the public API; see
`CMS-INTEGRATION.md` in the estratico-profile repo for the integration guide.

## Contributing

See [GITRULES.md](GITRULES.md) for branching and commit conventions. In short:

- Long-lived branches: `main` (protected) and `ceo-development`.
- Feature work on short-lived `feature/<name>` branches, merged via squash PRs.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, ...), lowercase imperative subjects, no emojis.
- Run lint and typecheck before committing; never commit secrets or real `.env` files.

## License

Private / proprietary. Command Hub is an internal tool owned by **Estratico Technologies** (Gweru, Midlands, Zimbabwe). Unauthorized use, reproduction, or distribution is prohibited.