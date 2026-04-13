# Architecture Plan: CG ERD Inventory App

## Context

Greenfield IT Asset Inventory System for a MedDevice/MedTech service provider. Engineers check in/out customer equipment. The spec (`specs/001-asset-inventory-system/spec.md`) defines 7 user stories, 22 functional requirements, and 8 measurable success criteria. No source code exists yet — this plan establishes the full project scaffold before implementation begins.

**Stack decisions confirmed:**
- Backend: FastAPI (async) + PostgreSQL + SQLAlchemy async + Alembic
- Frontend: React + Material UI + TailwindCSS + Vite
- Auth: Keycloak (self-hosted Docker container, OIDC + RBAC)
- Dev workflow: Local dev first (PostgreSQL + Keycloak in Docker, backend/frontend run locally)
- Production: Full Docker Compose stack (Nginx, Prometheus, Grafana)

---

## Monorepo Root Structure

```
cg-erd-inv-app/
├── backend/
├── frontend/
├── docker/
│   ├── postgres/init.sql          # pg_trgm + uuid-ossp extensions
│   └── keycloak/realm-export.json # Pre-configured realm (clients, roles, password policy)
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── app.conf               # Proxy rules: /api → backend, /auth → keycloak, / → frontend
│       └── upstream.conf
├── monitoring/
│   ├── prometheus/prometheus.yml
│   └── grafana/
│       ├── provisioning/datasources/prometheus.yml
│       └── dashboards/*.json
├── specs/                         # Existing spec files (untouched)
├── .env.example                   # All env vars documented
├── docker-compose.yml             # Production-like: postgres, keycloak, backend, frontend, nginx, prometheus, grafana
└── docker-compose.override.yml    # Dev overrides: backend hot-reload, skip frontend container
```

---

## Backend Structure

```
backend/
├── app/
│   ├── main.py                    # App factory: CORS, middleware, routers, /metrics, lifespan
│   ├── api/
│   │   ├── deps.py                # FastAPI Depends: get_current_user, require_super_admin, require_account_access, require_checkin_permission, require_model_master_permission
│   │   └── v1/
│   │       ├── router.py          # Aggregates all sub-routers under /api/v1
│   │       ├── auth.py            # GET /me, POST /password-reset/request
│   │       ├── accounts.py        # CRUD customer accounts (Super Admin only)
│   │       ├── engineers.py       # CRUD engineers + account mappings
│   │       ├── devices.py         # check-in, check-out, edit, search/filter
│   │       ├── device_models.py   # Device model master CRUD
│   │       ├── locations.py       # 4-level hierarchy CRUD
│   │       ├── audit.py           # GET audit log (read-only)
│   │       └── imports.py         # CSV upload → validate → commit
│   ├── core/
│   │   ├── config.py              # pydantic-settings BaseSettings (DATABASE_URL, KEYCLOAK_*, CORS_ORIGINS, etc.)
│   │   ├── security.py            # JWKS-cached Keycloak JWT validation (lazy refresh on unknown kid)
│   │   ├── keycloak.py            # KeycloakAdmin client wrapper (user provisioning via KC Admin REST API)
│   │   └── exceptions.py          # Custom HTTP exceptions + global handler
│   ├── db/
│   │   ├── base.py                # DeclarativeBase with naming_convention (predictable FK constraint names)
│   │   └── session.py             # create_async_engine (asyncpg), async_sessionmaker, get_db dependency
│   ├── models/
│   │   ├── customer_account.py
│   │   ├── engineer.py            # keycloak_user_id (KC subject), is_super_admin flag
│   │   ├── engineer_account_mapping.py  # can_manage_models, can_checkin_out, can_view_only per account
│   │   ├── device_model.py
│   │   ├── device.py              # status ENUM(CHECKED_IN/CHECKED_OUT), DB CHECK constraints enforce location_id rules
│   │   ├── location.py            # Single self-referential table, level ENUM(SITE/BUILDING/FLOOR/ROOM), parent_id FK
│   │   └── audit_log.py           # Insert-only (no updated_at), location_snapshot JSONB preserves path at event time
│   ├── schemas/                   # Pydantic v2 schemas (one file per entity + common.py, imports.py)
│   ├── services/
│   │   ├── device_service.py      # check_in / check_out: atomic device+audit_log write in one transaction
│   │   ├── location_service.py    # Deletion guard: blocked if active devices assigned
│   │   └── import_service.py      # Parse CSV → validate all rows → store job → atomic commit
│   ├── repositories/
│   │   ├── base.py                # Generic async CRUD (get, get_multi, create, update, delete)
│   │   ├── device_repo.py         # Scoped queries filtered by engineer's assigned accounts; trigram search on serial_number
│   │   └── audit_log_repo.py      # Insert-only; no update/delete exposed
│   └── tasks/
│       └── csv_processor.py       # Async chunked DB inserts for large CSV files
├── migrations/
│   ├── env.py                     # Alembic async env — imports all models, uses asyncpg URL
│   └── versions/0001_initial_schema.py
├── tests/
│   ├── conftest.py                # Test DB, test client, mock Keycloak token fixture
│   ├── unit/                      # device_service, import_service, location_service tests
│   └── integration/               # devices API, auth middleware, CSV import API tests
├── Dockerfile                     # Multi-stage: base → development → production; entrypoint runs alembic upgrade head
├── pyproject.toml                 # ruff, mypy, pytest config
└── requirements.txt / requirements-dev.txt
```

### API Routes Summary

```
/api/v1/auth            → GET /me, POST /password-reset/request
/api/v1/accounts        → CRUD (Super Admin only)
/api/v1/engineers       → CRUD + GET|POST|PATCH|DELETE /{id}/accounts
/api/v1/devices         → GET (search/filter, scoped), POST /checkin, GET|PATCH /{id}, POST /{id}/checkout
/api/v1/device-models   → CRUD (scoped to account, guarded by can_manage_models)
/api/v1/locations       → CRUD (Super Admin writes, engineers read; deletion blocked if active devices)
/api/v1/audit           → GET (read-only, scoped)
/api/v1/import          → POST /device-models, POST /devices, GET /results/{job_id}
```

### Key Patterns

**RBAC (deps.py) — composable FastAPI Depends chain:**
```
get_current_user → validates JWT, fetches Engineer from DB by keycloak_user_id
  └→ require_super_admin          → is_super_admin must be True
  └→ require_account_access       → checks engineer_account_mappings for the target account_id
       └→ require_checkin_permission      → mapping.can_checkin_out
       └→ require_model_master_permission → mapping.can_manage_models
```

**Atomic audit log:** `device_service.py` opens one `AsyncSession`, updates the `Device` row, inserts the `AuditLog` row, commits together → satisfies SC-005 (100% audit capture).

**Two-phase CSV import:** Validate all rows first (no DB writes), return `ImportResult{total_rows, valid_rows, errors[{row,field,message}]}` with a `job_id`. Commit endpoint uses `job_id` to atomically insert all rows only if zero errors → satisfies FR-021.

---

## Database Schema

### Core Tables

| Table | Key Columns | Key Constraints |
|---|---|---|
| `customer_accounts` | id UUID PK, name, is_active, contact_name (nullable), contact_email (nullable), contact_phone (nullable) | UNIQUE(name) |
| `engineers` | id UUID PK, keycloak_user_id, email, full_name, is_active, is_super_admin | UNIQUE(keycloak_user_id), UNIQUE(email) |
| `engineer_account_mappings` | id, engineer_id FK, customer_account_id FK, can_manage_models, can_checkin_out, can_view_only | UNIQUE(engineer_id, customer_account_id) |
| `locations` | id UUID PK, name, level ENUM(SITE/BUILDING/FLOOR/ROOM), parent_id FK(self), customer_account_id FK, is_active | UNIQUE(name, parent_id, account_id); CHECK SITE→parent IS NULL |
| `device_models` | id UUID PK, customer_account_id FK, model_number, name, description, manufacturer (nullable), device_category (nullable), is_active | UNIQUE(model_number, account_id) |
| `devices` | id UUID PK, customer_account_id FK, device_model_id FK, serial_number, asset_tag (nullable), condition ENUM(GOOD/FAIR/POOR/DAMAGED) DEFAULT GOOD, status ENUM(CHECKED_IN/CHECKED_OUT), location_id FK (nullable), checked_in_by_id FK, checked_out_by_id FK, checked_in_at, checked_out_at, comments | UNIQUE(serial_number, account_id); UNIQUE(asset_tag, account_id) where not null; CHECK status=CHECKED_IN→location IS NOT NULL |
| `audit_logs` | id UUID PK, device_id FK, customer_account_id FK, action ENUM(CHECK_IN/CHECK_OUT), engineer_id FK, location_id FK, location_snapshot JSONB, comments, event_at | No updated_at (immutable) |

**Rationale for additions:**
- `customer_accounts.contact_*`: A service provider managing 50 accounts needs contact details on record.
- `device_models.manufacturer`: Standard in MedDevice/MedTech (Medtronic, Philips, GE Healthcare, Siemens). Supports filtering by manufacturer.
- `device_models.device_category`: Type of medical device (Patient Monitor, Infusion Pump, Ventilator, Imaging System). Helps engineers find the right model during check-in.
- `devices.asset_tag`: Internal barcode/label assigned by the service provider, separate from manufacturer serial number. Nullable, unique per account when present.
- `devices.condition`: Records device condition at check-in (GOOD/FAIR/POOR/DAMAGED) — essential for a service provider to document arriving damaged equipment.

**Not added (v2 scope):** warranty dates, purchase dates, firmware/software versions, maintenance schedules.

### Critical Indexes

```sql
-- Tenant isolation (every list query)
CREATE INDEX idx_devices_account_status ON devices (customer_account_id, status);
-- Duplicate check-in prevention
CREATE UNIQUE INDEX uq_devices_serial_account ON devices (serial_number, customer_account_id);
-- Trigram search on serial number (FR-016)
CREATE INDEX idx_devices_serial_trgm ON devices USING GIN (serial_number gin_trgm_ops);
-- Location tree traversal
CREATE INDEX idx_locations_parent_id ON locations (parent_id);
-- Audit time-range queries
CREATE INDEX idx_audit_event_at ON audit_logs (event_at DESC);
-- Per-request RBAC check
CREATE UNIQUE INDEX uq_eam_engineer_account ON engineer_account_mappings (engineer_id, customer_account_id);
```

---

## Frontend Structure

```
frontend/
├── src/
│   ├── auth/
│   │   ├── keycloak.ts            # Keycloak-js instance (VITE_ env vars)
│   │   ├── AuthProvider.tsx       # login-required init, silent token refresh, user context
│   │   └── useAuth.ts             # { user, token, logout, hasPermission }
│   ├── components/
│   │   ├── layout/                # AppShell (sidebar + topbar), Sidebar, TopBar
│   │   └── common/
│   │       ├── DataTable.tsx      # MUI DataGrid wrapper with pagination + sort
│   │       ├── LocationSelector.tsx  # 4-level cascading dropdowns (loads lazily per level)
│   │       ├── CsvDropzone.tsx    # Drag-drop upload + per-row validation results table
│   │       └── StatusChip.tsx     # Checked-In/Checked-Out colored badge
│   ├── pages/
│   │   ├── DashboardPage.tsx      # Summary counts per account
│   │   ├── DevicesPage.tsx        # DataTable + filters
│   │   ├── CheckInPage.tsx        # 3-step MUI Stepper (identify → location → confirm)
│   │   ├── CheckOutPage.tsx       # Select device → date + comments → confirm
│   │   ├── DeviceModelsPage.tsx   # (guarded: can_manage_models)
│   │   ├── LocationsPage.tsx      # MUI TreeView (Super Admin only)
│   │   ├── EngineersPage.tsx      # (Super Admin only)
│   │   ├── AccountsPage.tsx       # (Super Admin only)
│   │   ├── AuditLogPage.tsx       # Read-only, date-range filter
│   │   └── CsvImportPage.tsx      # Upload → validation grid → commit (Super Admin only)
│   ├── hooks/                     # React Query hooks (useDevices, useLocations, etc.)
│   ├── services/
│   │   └── api.ts                 # Axios instance: auto-injects Bearer token via interceptor
│   ├── store/
│   │   └── uiStore.ts             # Zustand: sidebar state, active account, notification queue
│   └── routes/
│       ├── ProtectedRoute.tsx     # Checks auth + optional permission prop
│       └── SuperAdminRoute.tsx    # Restricts to is_super_admin
├── vite.config.ts                 # Dev proxy: /api → localhost:8000, /auth → localhost:8080
├── tailwind.config.js
└── Dockerfile                     # Multi-stage: node builder → nginx:alpine SPA server
```

**Check-in form fields** (`CheckInPage.tsx` 3-step stepper):
- Step 1 — Identify Device: account selector, serial number input (blur→duplicate check), optional asset tag, device model selector
- Step 2 — Assign Location + Condition: 4-level cascading LocationSelector (Site→Building→Floor→Room), condition selector (Good/Fair/Poor/Damaged, defaults to Good), check-in date, optional comments
- Step 3 — Confirm: read-only summary → POST /checkin

**State management split:** React Query owns all server state (caching, refetch, invalidation). Zustand owns only cross-component UI state (sidebar, active account, toasts).

---

## Docker Compose Services

| Service | Image | Exposes | Notes |
|---|---|---|---|
| `postgres` | postgres:16-alpine | (internal only) | `init.sql` installs pg_trgm + uuid-ossp |
| `keycloak` | quay.io/keycloak/keycloak:24.0 | (internal only) | Shares same PostgreSQL DB; imports `realm-export.json` on first boot |
| `backend` | ./backend Dockerfile | :8000 (internal) | Entrypoint runs `alembic upgrade head` before uvicorn |
| `frontend` | ./frontend Dockerfile | :80 (internal) | nginx-spa.conf serves React build; try_files for client-side routing |
| `nginx` | nginx:1.25-alpine | 80, 443 (external) | Routes /api→backend, /auth→keycloak, /grafana→grafana, /→frontend |
| `prometheus` | prom/prometheus:v2.51.0 | (internal) | Scrapes backend /metrics |
| `grafana` | grafana/grafana:10.4.0 | (internal) | Dashboards: backend request rates, business metrics, PG stats |

**Dev override** (`docker-compose.override.yml`): backend runs with `--reload` + volume mount; frontend container skipped (use `npm run dev` instead).

---

## Nginx Routing (Critical Details)

```nginx
location /auth/ { proxy_pass http://keycloak/auth/; }  # trailing slash required for KC relative URLs
location /api/  { proxy_pass http://backend; proxy_read_timeout 120s; client_max_body_size 10m; }  # CSV uploads
location /      { proxy_pass http://frontend; }        # SPA: try_files in frontend container handles routes
```

---

## Development Setup

```bash
# 1. Start only infrastructure
docker compose up postgres keycloak -d

# 2. Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev   # Vite on :3000, proxies /api and /auth

# 4. Run tests
cd backend && pytest tests/ -v --cov=app
cd frontend && npx tsc --noEmit && npm run test
```

---

## Implementation Phases

### Phase 1 — Foundation (Sprint 1)
Goal: End-to-end auth flow working. A Super Admin can log in and hit a protected endpoint.
- Monorepo scaffold + `.env.example`
- `docker/keycloak/realm-export.json`: realm, frontend client (public/PKCE), backend client (confidential), `super_admin` role, password policy
- `docker/postgres/init.sql`: pg_trgm + uuid-ossp extensions
- `backend/app/core/security.py`: JWKS-cached JWT validation (unit-tested with mock token)
- `backend/app/main.py`: health endpoint, Keycloak middleware wired
- `frontend/src/auth/AuthProvider.tsx`: Keycloak-js login flow, token refresh
- Nginx basic proxy config
- **Exit gate:** Browser → Nginx → Keycloak login → token → `GET /api/v1/health` returns 200

### Phase 2 — Core Data Models + Admin APIs (Sprint 2)
Goal: Super Admin can create all reference data needed for check-in.
- All SQLAlchemy models + Alembic migration `0001_initial_schema`
- Repository base class + all repo implementations
- APIs: accounts, engineers (with KC user provisioning), engineer-account mappings, locations (with deletion guard), device-models
- Frontend: Accounts, Engineers, Locations, DeviceModels pages (Super Admin flows)
- **Exit gate:** Super Admin can create a customer account, engineer, location hierarchy, and device model

### Phase 3 — Check-In / Check-Out Workflow (Sprint 3)
Goal: Engineers complete full device lifecycle.
- `device_service.py`: check_in (duplicate serial guard, ROOM-level location check, atomic audit log), check_out (status guard, clears location, atomic audit log)
- `GET /api/v1/devices`: paginated, filterable, account-scoped
- Frontend: `CheckInPage.tsx` (3-step stepper), `CheckOutPage.tsx`, `DevicesPage.tsx` with filters
- **Exit gate:** Engineer checks in a device and checks it out; audit log records both events

### Phase 4 — Search, Audit Log, Permissions Hardening (Sprint 4)
Goal: All 22 FRs implemented except CSV import.
- Enhance device search with trigram serial search, all filter fields
- `AuditLogPage.tsx` (read-only), `DashboardPage.tsx` (summary counts)
- Integration tests: all 4 permission levels enforce correctly; cross-account isolation (SC-006)

### Phase 5 — CSV Bulk Import (Sprint 5)
Goal: Super Admin can bulk import 1,000 records within 60 seconds (SC-004).
- `import_service.py`: validate-all-then-commit pattern; batch UNIQUE checks; async chunked DB inserts
- `job_id` pattern for two-phase commit (validate → get results → commit)
- **CSV column schemas:**
  - Device Models: `model_number, name, description, manufacturer, device_category`
  - Devices: `serial_number, model_number, asset_tag, condition, comments`
- Frontend: `CsvImportPage.tsx`, `CsvDropzone.tsx`, validation error grid, CSV template downloads
- **Exit gate:** 1,000-row import completes in <60s; file with any error row cannot be partially committed

### Phase 6 — Password Reset + Polish (Sprint 6)
- Password reset via Keycloak `execute-actions-email` Admin API (no custom reset UI needed)
- Consistent error response shape across all endpoints
- Loading/empty/error states on all frontend pages
- Responsive layout verification (desktop + tablet)

### Phase 7 — Monitoring + Deployment Hardening (Sprint 7)
- `prometheus-fastapi-instrumentator` on backend `/metrics`
- Grafana dashboards: backend request rates, p99 latency, business metrics (check-ins/day)
- Grafana alerts: >5% error rate, p99 latency >2s
- Nginx security headers (HSTS, X-Frame-Options)
- End-to-end smoke tests against full Docker Compose stack

---

## Critical Files (First to Implement)

| File | Why Critical |
|---|---|
| `backend/app/core/security.py` | Security foundation gating every route; must be tested before any business logic |
| `backend/app/api/deps.py` | RBAC depends chain; every router depends on these for permission scoping |
| `backend/app/services/device_service.py` | Core check-in/check-out business rules + atomic audit log |
| `backend/migrations/env.py` | Alembic async env; must import all models or schema drift becomes undetectable |
| `docker/keycloak/realm-export.json` | Auth misconfiguration in Phase 1 propagates to all later phases |

---

## Verification

End-to-end test sequence (can be executed after Phase 3):
1. `docker compose up -d` → all services healthy
2. Browser navigates to `https://localhost` → redirected to Keycloak login
3. Super Admin logs in → reaches Dashboard
4. Create customer account, engineer (permissions: can_checkin_out), location hierarchy, device model
5. Log in as engineer → navigate to Devices → Check In
6. Complete 3-step check-in form → device appears in list with status Checked-In
7. Select device → Check Out → device status changes to Checked-Out
8. Navigate to Audit Log → both events appear with timestamps, engineer name, location snapshot
9. Navigate to CSV Import → upload 1,000-row device CSV → validation passes → commit → all records visible
10. Attempt to access another customer's devices as engineer → 403 Forbidden
