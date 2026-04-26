# Tasks: Asset Inventory System

**Input**: Design documents from `/specs/001-asset-inventory-system/`
**Prerequisites**: plan.md ✓, spec.md ✓
**Context**: MVP version — locally testable via `docker compose up` + local backend/frontend dev servers

**MVP Scope** (US1 + US2 + US3 + US6 + US4 — all P1 stories plus the two P2 prerequisites):
> Super Admin creates accounts/engineers/locations/models → Engineers check devices in and out → Audit log captures all events

**Format**: `[ID] [P?] [Story?] Description with file path`
- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Maps to user story (US1–US7) from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo scaffold, Docker infrastructure, environment configuration

- [x] T001 Create monorepo directory structure: `backend/`, `frontend/`, `docker/postgres/`, `docker/keycloak/`, `nginx/conf.d/`, `monitoring/prometheus/`, `monitoring/grafana/provisioning/datasources/`, `monitoring/grafana/dashboards/`
- [x] T002 Create `.env.example` documenting all required env vars: `DATABASE_URL`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `CORS_ORIGINS`, `SECRET_KEY`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`
- [x] T003 [P] Create `docker/postgres/init.sql` installing `pg_trgm` and `uuid-ossp` extensions
- [x] T004 [P] Create `docker/keycloak/realm-export.json` with: realm `erd-inv`, frontend client `erd-inv-frontend` (public, PKCE, redirect URIs for localhost), backend client `erd-inv-backend` (confidential), `super_admin` realm role, password policy (min 8 chars, mixed case, digit), `admin` test user pre-assigned `super_admin` role
- [x] T005 [P] Create `nginx/nginx.conf` (worker settings, include conf.d) and `nginx/conf.d/upstream.conf` (upstream blocks for backend, keycloak, frontend, grafana)
- [x] T006 [P] Create `nginx/conf.d/app.conf` with proxy rules: `/auth/` → keycloak (trailing slash preserved), `/api/` → backend (120s timeout, 10m body for CSV), `/` → frontend SPA with try_files fallback
- [x] T007 [P] Create `monitoring/prometheus/prometheus.yml` scraping backend `/metrics` every 15s
- [x] T008 [P] Create `monitoring/grafana/provisioning/datasources/prometheus.yml` and placeholder `monitoring/grafana/dashboards/backend.json`
- [x] T009 Create `docker-compose.yml` with services: `postgres` (postgres:16-alpine, volume + init.sql), `keycloak` (keycloak:24.0, imports realm-export.json, depends on postgres), `backend` (:8000, depends on postgres+keycloak), `frontend` (:80), `nginx` (ports 80:80), `prometheus`, `grafana` — all with health checks
- [x] T010 Create `docker-compose.override.yml` for dev: backend with `--reload` + source volume mount; frontend service commented out (use `npm run dev` instead)
- [x] T011 [P] Create `backend/Dockerfile` multi-stage: `base` (python:3.12-slim, system deps), `development` (all requirements), `production` (no dev deps); entrypoint script runs `alembic upgrade head` then starts uvicorn
- [x] T012 [P] Create `frontend/Dockerfile` multi-stage: `builder` (node:20-alpine, `npm ci && npm run build`), `server` (nginx:alpine, copies dist, SPA nginx config with `try_files $uri /index.html`)

---

## Phase 2: Foundational (Backend Core — blocks all user story work)

**Purpose**: Database connection, auth middleware, RBAC dependency chain — every API route depends on this

**⚠️ CRITICAL**: No user story backend work can begin until this phase is complete

- [x] T013 Create `backend/pyproject.toml` with: `[tool.ruff]` (line-length 100, select E/F/I), `[tool.mypy]` (strict=false, ignore_missing_imports), `[tool.pytest.ini_options]` (asyncio_mode=auto, testpaths=tests)
- [x] T014 Create `backend/requirements.txt`: `fastapi[standard]`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pydantic-settings`, `python-jose[cryptography]`, `httpx`, `prometheus-fastapi-instrumentator`, `python-multipart`; create `backend/requirements-dev.txt`: `pytest`, `pytest-asyncio`, `pytest-cov`, `httpx`, `ruff`, `mypy`
- [x] T015 Create `backend/app/core/config.py` using `pydantic-settings` BaseSettings: fields for `DATABASE_URL`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `CORS_ORIGINS` (list), `APP_ENV`; singleton `get_settings()` with `@lru_cache`
- [x] T016 Create `backend/app/core/exceptions.py`: custom exception classes (`NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`) and `register_exception_handlers(app)` that maps each to consistent JSON shape `{"error": {"code": str, "message": str, "details": any}}`
- [x] T017 Create `backend/app/db/base.py`: `DeclarativeBase` subclass with `naming_convention` dict for predictable FK/index constraint names (`ix_`, `uq_`, `ck_`, `fk_`, `pk_` prefixes)
- [x] T018 Create `backend/app/db/session.py`: `create_async_engine` with asyncpg URL, `async_sessionmaker`, `AsyncSession` type alias, `get_db` FastAPI dependency (yields session, commits on success, rolls back on exception)
- [x] T019 Create `backend/app/core/security.py`: `JWTValidator` class with JWKS endpoint caching; `get_jwks()` fetches from Keycloak (`/realms/{realm}/protocol/openid-connect/certs`), caches with 1-hour TTL, lazily refreshes on unknown `kid`; `decode_token(token) → dict` verifies signature + expiry + audience; `get_token_from_header(request) → str` extracts Bearer token
- [x] T020 Create `backend/app/core/keycloak.py`: `KeycloakAdmin` class wrapping Keycloak Admin REST API; methods: `create_user(email, password, full_name) → keycloak_user_id`, `reset_password_email(user_id)`, `assign_realm_role(user_id, role_name)`, `get_admin_token() → str` (client credentials grant, cached until 60s before expiry)
- [x] T021 Create `backend/app/api/deps.py` with composable Depends chain:
  - `get_current_user(token, db) → Engineer`: validates JWT via `JWTValidator`, looks up `Engineer` by `keycloak_user_id`, raises 401 if not found
  - `require_super_admin(user) → Engineer`: raises 403 if `not user.is_super_admin`
  - `require_account_access(account_id, user, db) → EngineerAccountMapping`: fetches mapping row, raises 403 if not found
  - `require_checkin_permission(mapping) → EngineerAccountMapping`: raises 403 if `not mapping.can_checkin_out`
  - `require_model_master_permission(mapping) → EngineerAccountMapping`: raises 403 if `not mapping.can_manage_models`
- [x] T022 Create `backend/app/main.py`: app factory with `lifespan` context manager (no startup side effects), CORSMiddleware (origins from settings), `register_exception_handlers(app)`, include `api_router` under `/api/v1`, `GET /health → {"status": "ok"}`, mount `prometheus-fastapi-instrumentator` at `/metrics`
- [x] T023 Create `backend/migrations/alembic.ini` and `backend/migrations/env.py`: async Alembic env that imports `backend.app.db.base.Base` and all model modules so autogenerate detects all tables; uses `asyncpg` URL from settings
- [x] T024 Initialize `backend/app/repositories/base.py`: generic `BaseRepository[T]` with async methods `get(id) → T | None`, `get_multi(skip, limit, **filters) → list[T]`, `create(obj_in) → T`, `update(id, obj_in) → T`, `delete(id) → bool`

---

## Phase 3: Frontend Foundation

**Purpose**: Keycloak auth flow, API client, routing shell — all pages depend on this

- [x] T025 Initialize frontend: `npm create vite@latest frontend -- --template react-ts` then install deps: `@mui/material @mui/x-data-grid @emotion/react @emotion/styled @mui/icons-material keycloak-js @tanstack/react-query axios zustand react-router-dom tailwindcss postcss autoprefixer`
- [x] T026 [P] Create `frontend/vite.config.ts` with dev proxy: `/api` → `http://localhost:8000`, `/auth` → `http://localhost:8080`; resolve aliases `@` → `./src`
- [x] T027 [P] Initialize Tailwind: `frontend/tailwind.config.js` (content: `./src/**/*.{ts,tsx}`) and `frontend/postcss.config.js`; add Tailwind directives to `frontend/src/index.css`
- [x] T028 Create `frontend/src/auth/keycloak.ts`: Keycloak-js instance using `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` env vars; exported singleton
- [x] T029 Create `frontend/src/auth/AuthProvider.tsx`: initializes Keycloak with `login-required` flow; sets up silent token refresh (5-min before expiry via `updateToken`); provides `AuthContext` with `{ user, token, isLoading, logout }`
- [x] T030 Create `frontend/src/auth/useAuth.ts`: hook returning `AuthContext`; includes `hasPermission(perm: string) → bool` checking token realm roles
- [x] T031 Create `frontend/src/services/api.ts`: Axios instance with `baseURL=/api/v1`; request interceptor injects `Authorization: Bearer {token}` from auth context; response interceptor handles 401 (triggers Keycloak logout) and formats error messages
- [x] T032 Create `frontend/src/store/uiStore.ts`: Zustand store with: `sidebarOpen: bool`, `activeAccountId: string | null`, `notifications: Notification[]`; actions: `setSidebarOpen`, `setActiveAccount`, `addNotification`, `dismissNotification`
- [x] T033 Create `frontend/src/routes/ProtectedRoute.tsx` (checks `isAuthenticated`) and `frontend/src/routes/SuperAdminRoute.tsx` (checks `hasPermission('super_admin')`)
- [x] T034 Create `frontend/src/components/layout/AppShell.tsx` (MUI Box layout: Sidebar + main content area), `Sidebar.tsx` (nav links, account selector, collapse toggle), `TopBar.tsx` (app title, user menu, logout button)
- [x] T035 Create `frontend/src/components/common/StatusChip.tsx`: MUI Chip that renders green "Checked In" or orange "Checked Out" based on device status prop
- [x] T036 Create `frontend/src/components/common/DataTable.tsx`: wrapper around MUI DataGrid with built-in pagination (server-side), sort, loading skeleton, empty-state message
- [x] T037 Create `frontend/src/main.tsx` wrapping app in `<AuthProvider>`, `<QueryClientProvider>`, `<BrowserRouter>`; create `frontend/src/App.tsx` with React Router routes wired to all pages (protected appropriately)

---

## Phase 4: User Story 1 — Super Admin Onboards Engineers and Customers (P1) 🎯 MVP

**Goal**: Super Admin can create customer accounts, create engineers (provisioned in Keycloak), assign engineers to accounts with per-account permissions

**Independent Test**: Super Admin logs in → creates account "MedCo" → creates engineer "jane@example.com" with Check-In/Out permission on MedCo → Jane logs in and can see MedCo devices but another account's data returns 403

- [x] T038 [P] Create `backend/app/models/customer_account.py`: `CustomerAccount` SQLAlchemy model — `id` (UUID PK default), `name` (str, UNIQUE), `is_active` (bool default True), `contact_name` (str nullable), `contact_email` (str nullable), `contact_phone` (str nullable), `created_at` (datetime)
- [x] T039 [P] Create `backend/app/models/engineer.py`: `Engineer` model — `id` (UUID PK), `keycloak_user_id` (str, UNIQUE), `email` (str, UNIQUE), `full_name` (str), `is_active` (bool), `is_super_admin` (bool default False), `created_at`
- [x] T040 [P] Create `backend/app/models/engineer_account_mapping.py`: `EngineerAccountMapping` model — `id` (UUID PK), `engineer_id` (FK → engineers), `customer_account_id` (FK → customer_accounts), `can_manage_models` (bool), `can_checkin_out` (bool), `can_view_only` (bool); UNIQUE constraint on `(engineer_id, customer_account_id)`
- [x] T041 Create `backend/migrations/versions/0001_initial_schema.py`: Alembic migration creating all 7 tables (customer_accounts, engineers, engineer_account_mappings, locations, device_models, devices, audit_logs) with all columns, constraints, and indexes from plan.md; include `pg_trgm` trigram index on `devices.serial_number`
- [x] T041b Create `backend/migrations/versions/0002_seed_super_admin.py`: Alembic data migration that inserts the default super admin engineer row — `keycloak_user_id='00000000-0000-0000-0000-000000000001'`, `email='admin@erd-inv.local'`, `full_name='System Administrator'`, `is_active=true`, `is_super_admin=true`; use `ON CONFLICT (keycloak_user_id) DO NOTHING` for idempotency; downgrade deletes by `keycloak_user_id`; depends on `0001_initial_schema`
- [x] T042 [P] Create `backend/app/schemas/customer_account.py`: Pydantic v2 `CustomerAccountCreate`, `CustomerAccountUpdate`, `CustomerAccountRead` (with `id`, `created_at`), `CustomerAccountList`
- [x] T043 [P] Create `backend/app/schemas/engineer.py`: `EngineerCreate` (email, full_name, password, is_super_admin), `EngineerUpdate`, `EngineerRead`, `EngineerList`; `backend/app/schemas/engineer_account_mapping.py`: `MappingCreate` (account_id, can_manage_models, can_checkin_out, can_view_only), `MappingRead`, `MappingUpdate`
- [x] T044 [P] Create `backend/app/schemas/common.py`: `PaginatedResponse[T]` generic (items, total, skip, limit), `ErrorResponse` (code, message, details)
- [x] T045 [P] Create `backend/app/repositories/customer_account_repo.py` extending `BaseRepository[CustomerAccount]`; add `get_by_name(name) → CustomerAccount | None`
- [x] T046 [P] Create `backend/app/repositories/engineer_repo.py` extending `BaseRepository[Engineer]`; add `get_by_keycloak_id(kc_id)`, `get_by_email(email)`, `get_with_mappings(engineer_id)`
- [x] T047 Create `backend/app/api/v1/accounts.py`: Super Admin only CRUD — `GET /accounts` (paginated), `POST /accounts`, `GET /accounts/{id}`, `PATCH /accounts/{id}`, `DELETE /accounts/{id}` (soft-delete via `is_active=False`)
- [x] T048 Create `backend/app/api/v1/engineers.py`: Super Admin only — `GET /engineers`, `POST /engineers` (creates KC user + DB row), `GET /engineers/{id}`, `PATCH /engineers/{id}`, `GET /engineers/{id}/accounts`, `POST /engineers/{id}/accounts`, `PATCH /engineers/{id}/accounts/{account_id}`, `DELETE /engineers/{id}/accounts/{account_id}`
- [x] T049 Create `backend/app/api/v1/auth.py`: `GET /auth/me` returns current engineer profile; `POST /auth/password-reset/request` triggers `KeycloakAdmin.reset_password_email()`
- [x] T050 Create `backend/app/api/v1/router.py` importing and including all sub-routers under prefix `/api/v1`; update `backend/app/main.py` to include this router
- [x] T051 [P] Create `frontend/src/hooks/useAccounts.ts`: React Query hooks `useAccounts()`, `useAccount(id)`, `useCreateAccount()`, `useUpdateAccount()` using `/api/v1/accounts`
- [x] T052 [P] Create `frontend/src/hooks/useEngineers.ts`: hooks `useEngineers()`, `useEngineer(id)`, `useCreateEngineer()`, `useUpdateEngineer()`, `useEngineerAccounts(id)`, `useAssignAccount()`, `useUpdateMapping()`, `useRemoveMapping()`
- [x] T053 [P] Create `frontend/src/pages/AccountsPage.tsx`: DataTable of customer accounts with columns (name, status, contact); Add/Edit dialogs (MUI Dialog + form); Super Admin only (wrapped in SuperAdminRoute)
- [x] T054 [P] Create `frontend/src/pages/EngineersPage.tsx`: DataTable of engineers; Create dialog (email, full_name, password, is_super_admin); account mapping panel (assign accounts + permission checkboxes); Super Admin only

**Checkpoint**: Super Admin can log in, create accounts and engineers, assign permissions. Engineer can log in and receives correct 403 for unassigned accounts.

---

## Phase 5: User Story 6 — Super Admin Manages Location Hierarchy (P2)

**⚠️ Required before check-in**: devices must be assigned to a ROOM-level location

**Goal**: Super Admin creates 4-level hierarchy; engineers can read locations for assignment during check-in

**Independent Test**: Super Admin creates Site → Building → Floor → Room; engineer can select that Room in the LocationSelector dropdown

- [x] T055 Create `backend/app/models/location.py`: `Location` model — `id` (UUID PK), `name` (str), `level` (Enum: SITE/BUILDING/FLOOR/ROOM), `parent_id` (FK → locations.id nullable), `customer_account_id` (FK → customer_accounts), `is_active` (bool); UNIQUE on `(name, parent_id, customer_account_id)`; CHECK `level=SITE → parent_id IS NULL`
- [x] T056 Create `backend/app/schemas/location.py`: `LocationCreate`, `LocationUpdate`, `LocationRead` (with `children: list[LocationRead] | None` for tree responses), `LocationList`
- [x] T057 Create `backend/app/repositories/location_repo.py`: `get_children(parent_id, account_id)`, `get_sites(account_id)`, `has_active_devices(location_id) → bool` (for deletion guard)
- [x] T058 Create `backend/app/services/location_service.py`: `delete_location(id, db)` — checks `has_active_devices`, raises `ConflictError` if true; `get_location_path(id, db) → list[Location]` (traverses parent chain for location_snapshot)
- [x] T059 Create `backend/app/api/v1/locations.py`: `GET /locations` (all, read by any authenticated engineer, filtered by account_id), `GET /locations/{id}/children` (lazy tree loading), `POST /locations` (Super Admin only), `PATCH /locations/{id}` (Super Admin only), `DELETE /locations/{id}` (Super Admin only, deletion guard enforced)
- [x] T060 Create `frontend/src/hooks/useLocations.ts`: `useLocationChildren(parentId, accountId)` (lazy loads per level), `useCreateLocation()`, `useDeleteLocation()`
- [x] T061 Create `frontend/src/components/common/LocationSelector.tsx`: 4 cascading MUI Select dropdowns (Site → Building → Floor → Room); each level loads only after parent selected; shows "No rooms available — contact admin" if Room level is empty
- [x] T062 Create `frontend/src/pages/LocationsPage.tsx`: MUI TreeView rendering 4-level hierarchy per account; Add child node buttons; Delete button (disabled with tooltip if active devices assigned); Super Admin only

**Checkpoint**: Super Admin can build full location tree. LocationSelector in check-in form shows correct rooms.

---

## Phase 6: User Story 4 — Engineer Manages Device Model Master (P2)

**⚠️ Required before check-in**: devices must reference a device model

**Goal**: Engineers with `can_manage_models` can create and edit device models for their assigned accounts

**Independent Test**: Engineer with Device Model Master permission creates model "PH-MON-500" → it appears in the model dropdown during check-in for that account

- [x] T063 Create `backend/app/models/device_model.py`: `DeviceModel` — `id` (UUID PK), `customer_account_id` (FK), `model_number` (str), `name` (str), `description` (str nullable), `manufacturer` (str nullable), `device_category` (str nullable), `is_active` (bool); UNIQUE on `(model_number, customer_account_id)`
- [x] T064 Create `backend/app/schemas/device_model.py`: `DeviceModelCreate`, `DeviceModelUpdate`, `DeviceModelRead`, `DeviceModelList`
- [x] T065 Create `backend/app/repositories/device_model_repo.py`: `get_by_account(account_id, skip, limit) → list[DeviceModel]`; `get_by_model_number(model_number, account_id) → DeviceModel | None`
- [x] T066 Create `backend/app/api/v1/device_models.py`: `GET /device-models` (scoped to engineer's accounts, any permission level), `POST /device-models` (requires `can_manage_models`), `GET /device-models/{id}`, `PATCH /device-models/{id}` (requires `can_manage_models`)
- [x] T067 Create `frontend/src/hooks/useDeviceModels.ts`: `useDeviceModels(accountId)`, `useCreateDeviceModel()`, `useUpdateDeviceModel()`
- [x] T068 Create `frontend/src/pages/DeviceModelsPage.tsx`: DataTable of device models per account; Create/Edit dialog (model_number, name, description, manufacturer, device_category); guarded by `can_manage_models` permission — shows read-only view for engineers without the permission

**Checkpoint**: Engineer with model permission can create models. Check-in model dropdown populates correctly.

---

## Phase 7: User Story 2 — Engineer Checks In a Customer Device (P1) 🎯 MVP

**Goal**: Engineer records a device arriving: serial number, model, location (ROOM level), condition, check-in date. Audit log captures the event atomically.

**Independent Test**: Engineer checks in device SN-001 to Room B3-101 → device appears in list as Checked-In with correct location → audit log shows one CHECK_IN entry with engineer name, timestamp, location snapshot

- [x] T069 Create `backend/app/models/device.py`: `Device` — `id` (UUID PK), `customer_account_id` (FK), `device_model_id` (FK), `serial_number` (str), `asset_tag` (str nullable), `condition` (Enum: GOOD/FAIR/POOR/DAMAGED, default GOOD), `status` (Enum: CHECKED_IN/CHECKED_OUT), `location_id` (FK → locations, nullable), `checked_in_by_id` (FK → engineers), `checked_out_by_id` (FK → engineers, nullable), `checked_in_at` (datetime), `checked_out_at` (datetime nullable), `comments` (str nullable); UNIQUE on `(serial_number, customer_account_id)`; CHECK `status=CHECKED_IN → location_id IS NOT NULL`
- [x] T070 Create `backend/app/models/audit_log.py`: `AuditLog` — `id` (UUID PK), `device_id` (FK), `customer_account_id` (FK), `action` (Enum: CHECK_IN/CHECK_OUT), `engineer_id` (FK), `location_id` (FK nullable), `location_snapshot` (JSON — dict with full path: site/building/floor/room names + ids), `comments` (str nullable), `event_at` (datetime, server_default=now); **no** `updated_at` (immutable)
- [x] T071 Create `backend/app/schemas/device.py`: `CheckInRequest` (account_id, serial_number, device_model_id, location_id, asset_tag, condition, checked_in_at, comments), `CheckOutRequest` (checked_out_at, comments), `DeviceRead` (all fields + model name + location path + engineer names), `DeviceUpdate` (model_id, location_id, comments), `DeviceListParams` (filters: status, account_id, model_id, serial_number, engineer_id, location_id, date range, skip, limit)
- [x] T072 Create `backend/app/schemas/audit_log.py`: `AuditLogRead` (device serial, action, engineer name, event_at, location_snapshot, comments), `AuditLogListParams` (device_id, account_id, engineer_id, action, from_date, to_date, skip, limit)
- [x] T073 Create `backend/app/repositories/device_repo.py`: `get_checked_in_by_serial(serial, account_id)` (duplicate guard), `get_scoped_devices(engineer_accounts: list[UUID], params: DeviceListParams) → (list[Device], int)` (applies all filters, trigram `serial_number` search via `serial_number ILIKE %term%` or `similarity()`)
- [x] T074 Create `backend/app/repositories/audit_log_repo.py`: `insert(log_data) → AuditLog` only — no update/delete; `get_scoped_logs(engineer_accounts, params) → (list[AuditLog], int)`
- [x] T075 Create `backend/app/services/device_service.py` with `check_in(request, engineer, db) → Device`:
  1. Verify `request.account_id` is in engineer's assigned accounts with `can_checkin_out`
  2. Verify location exists and is level=ROOM
  3. Check `device_repo.get_checked_in_by_serial` — raise `ConflictError` if duplicate
  4. Create `Device` row with `status=CHECKED_IN`
  5. Build `location_snapshot` via `location_service.get_location_path()`
  6. Insert `AuditLog` row with `action=CHECK_IN`
  7. Commit both in single transaction (satisfies SC-005)
  8. Return created device
- [x] T076 Create `backend/app/api/v1/devices.py` initial routes: `POST /devices/checkin` (calls `device_service.check_in`), `GET /devices` (paginated list, scoped to engineer's accounts), `GET /devices/{id}` (scoped)
- [x] T077 Create `frontend/src/hooks/useDevices.ts`: `useDevices(params)`, `useDevice(id)`, `useCheckIn()` mutation (invalidates devices query on success)
- [x] T078 Create `frontend/src/pages/CheckInPage.tsx`: MUI Stepper (3 steps):
  - Step 1 "Identify Device": account selector (from engineer's assigned accounts), serial number input (onBlur triggers duplicate-check GET), optional asset tag, device model selector (loads models for selected account)
  - Step 2 "Location & Condition": LocationSelector (4-level cascading), condition selector (Good/Fair/Poor/Damaged, default Good), check-in date picker (default today), optional comments
  - Step 3 "Confirm": read-only summary of all fields → Submit button → POST /devices/checkin → success snackbar + redirect to DevicesPage

**Checkpoint**: Engineer can complete end-to-end check-in. Duplicate serial shows error. Missing location shows validation error.

---

## Phase 8: User Story 3 — Engineer Checks Out a Customer Device (P1) 🎯 MVP

**Goal**: Engineer marks a device as returned — status becomes Checked-Out, location is cleared, audit log records the event

**Independent Test**: Check in a device, then check it out → status = Checked-Out, location = null in device record → audit log has CHECK_OUT entry → trying to check out again shows error

- [ ] T079 Add `check_out(device_id, request, engineer, db) → Device` to `backend/app/services/device_service.py`:
  1. Load device, verify `status=CHECKED_IN` (else raise `ConflictError`)
  2. Verify engineer has `can_checkin_out` on device's `customer_account_id`
  3. Update device: `status=CHECKED_OUT`, `location_id=NULL`, `checked_out_by_id=engineer.id`, `checked_out_at`
  4. Insert `AuditLog` with `action=CHECK_OUT` (location_id=null, location_snapshot=null)
  5. Commit atomically
- [ ] T080 Add routes to `backend/app/api/v1/devices.py`: `POST /devices/{id}/checkout` (calls `device_service.check_out`), `PATCH /devices/{id}` (edit checked-in device — model, location, comments; requires `can_checkin_out`)
- [ ] T081 Add `useCheckOut()` and `useUpdateDevice()` mutations to `frontend/src/hooks/useDevices.ts`
- [ ] T082 Create `frontend/src/pages/CheckOutPage.tsx`: device selector (search by serial in engineer's accounts, filtered to Checked-In only), check-out date picker (default today), optional comments, confirm button → POST /{id}/checkout → success snackbar
- [ ] T083 Create `frontend/src/pages/DevicesPage.tsx`: DataTable with columns (serial, model, status, location, checked-in-by, checked-in-at, account); StatusChip for status column; row action buttons (Check Out, Edit); basic account + status filter dropdowns above table

**Checkpoint**: Full device lifecycle works end-to-end. Audit log has both CHECK_IN and CHECK_OUT entries.

---

## Phase 9: User Story 5 — Engineer Searches and Filters Devices (P2)

**Goal**: Engineers can quickly locate any device using any combination of search criteria within their assigned accounts

**Independent Test**: Populate 20 devices across 2 accounts; search by partial serial number finds matching devices; status filter shows only Checked-In devices; cross-account isolation — engineer sees only their account's devices

- [ ] T084 Extend `GET /devices` query params in `backend/app/api/v1/devices.py` to fully support `DeviceListParams`: model_id, serial_number (trigram similarity search), checked_in_by_id, checked_out_by_id, checked_in_after, checked_in_before, checked_out_after, checked_out_before, account_id, location_id, status; return `PaginatedResponse[DeviceRead]`
- [ ] T085 Update `backend/app/repositories/device_repo.py` `get_scoped_devices` to apply all filters dynamically; use `func.similarity(serial_number, term) > 0.3` for trigram search when `serial_number` param is provided (requires pg_trgm)
- [ ] T086 Create `backend/app/api/v1/audit.py`: `GET /audit` returning `PaginatedResponse[AuditLogRead]` scoped to engineer's accounts; supports params: device_id, account_id, action, from_date, to_date, skip, limit
- [ ] T087 Update `frontend/src/pages/DevicesPage.tsx`: add full filter bar (serial search input, status select, account select, model select, location select, date range pickers); hook up to `useDevices(params)` query; pagination controls
- [ ] T088 Create `frontend/src/hooks/useAuditLog.ts`: `useAuditLog(params)` with React Query
- [ ] T089 Create `frontend/src/pages/AuditLogPage.tsx`: read-only DataTable (device serial, action badge, engineer, timestamp, location path); date range picker filter; account filter; export to CSV button (client-side via Blob)
- [ ] T090 Create `frontend/src/pages/DashboardPage.tsx`: summary cards per account (total devices, checked-in count, checked-out count); recent check-ins table (last 10 events from audit log); links to DevicesPage pre-filtered by account

**Checkpoint**: All FR-016 search/filter criteria work. SC-002 (locate any device in <30s) satisfied. Cross-account isolation enforced.

---

## Phase 10: User Story 7 — Bulk CSV Import (P3)

**Goal**: Super Admin imports up to 1,000 device model or device records from CSV; all rows validated before any are committed; partial imports blocked

**Independent Test**: Upload CSV with 5 valid + 1 invalid row → no records committed, per-row errors shown; upload 1,000-row valid CSV → all imported within 60s

- [ ] T091 Create `backend/app/schemas/imports.py`: `ImportJobStatus` (Enum: PENDING/VALIDATING/VALIDATED/COMMITTING/DONE/FAILED), `ImportRowError` (row: int, field: str, message: str), `ImportResult` (job_id: UUID, status, total_rows, valid_rows, errors: list[ImportRowError]), `DeviceModelImportRow` (model_number, name, description, manufacturer, device_category), `DeviceImportRow` (serial_number, model_number, asset_tag, condition, comments)
- [ ] T092 Create `backend/app/tasks/csv_processor.py`: `parse_csv_bytes(content: bytes) → list[dict]`; `validate_device_model_rows(rows, account_id, db) → ImportResult` (checks required fields, duplicates against existing); `validate_device_rows(rows, account_id, db) → ImportResult` (checks model_number exists in account catalog, no duplicate serials); in-memory job store `dict[UUID, ImportResult]`
- [ ] T093 Create `backend/app/services/import_service.py`: two-phase workflow — `start_import_job(file, account_id, import_type) → job_id` (parses CSV, validates all rows, stores `ImportResult`); `commit_import_job(job_id, db) → ImportResult` (fails if any errors exist, atomically bulk-inserts all rows using `db.execute(insert(Model).values([...]))` in chunks of 100)
- [ ] T094 Create `backend/app/api/v1/imports.py`: `POST /import/device-models` (multipart CSV upload → `start_import_job` → returns job_id + validation result), `POST /import/devices` (same flow), `GET /import/results/{job_id}` (returns stored ImportResult), `POST /import/commit/{job_id}` (commits only if zero errors)
- [ ] T095 Create `frontend/src/components/common/CsvDropzone.tsx`: drag-and-drop file input (react-dropzone or MUI); CSV column requirements shown; after upload shows validation results grid (row number, error field, message); download CSV template button
- [ ] T096 Create `frontend/src/pages/CsvImportPage.tsx`: two tabs (Device Models / Devices); account selector; CsvDropzone; validation results; "Commit Import" button (enabled only when valid_rows > 0 and errors === 0); progress indicator during processing; Super Admin only

**Checkpoint**: 1,000-row import completes in <60s. File with any error row cannot be partially committed (satisfies FR-021, SC-004).

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Consistent UX, error handling, deployment readiness

- [ ] T097 Add loading skeletons (MUI Skeleton), empty-state messages ("No devices found — check in your first device"), and error banners to all frontend pages (DevicesPage, CheckInPage, CheckOutPage, AuditLogPage, DashboardPage)
- [ ] T098 Add Nginx security headers to `nginx/conf.d/app.conf`: `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy` (allow Keycloak domain for auth)
- [ ] T099 Add `prometheus-fastapi-instrumentator` instrumentation to `backend/app/main.py` (already mounted at `/metrics`); add custom counter `device_checkins_total` and `device_checkouts_total` incremented in `device_service.py`
- [ ] T100 Create `monitoring/grafana/dashboards/backend.json`: panels for request rate, p99 latency, error rate, `device_checkins_total` + `device_checkouts_total` counters; set alert rules (>5% error rate, p99 >2s)
- [ ] T101 Create `backend/tests/conftest.py`: async test DB fixture (separate `test_erd_inv` DB), `AsyncClient` fixture using `httpx`, `mock_keycloak_token()` fixture that returns a signed JWT for a test engineer (bypasses live Keycloak in tests)
- [ ] T102 Verify end-to-end: `docker compose up -d`, confirm all services healthy, run the 10-step verification sequence from plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T003–T012 all parallelizable
- **Phase 2 (Foundational Backend)**: Depends on Phase 1 directory structure — **blocks all backend user story work**
- **Phase 3 (Frontend Foundation)**: Can run in parallel with Phase 2 — **blocks all frontend user story work**
- **Phase 4 (US1 — Accounts/Engineers)**: Depends on Phase 2 + Phase 3
- **Phase 5 (US6 — Locations)**: Depends on Phase 2 + Phase 3; T041 (migration) requires T038–T040
- **Phase 6 (US4 — Device Models)**: Depends on Phase 2 + Phase 3; can run in parallel with Phase 5
- **Phase 7 (US2 — Check-In)**: Depends on Phases 4 + 5 + 6 (needs accounts, locations, models to exist)
- **Phase 8 (US3 — Check-Out)**: Depends on Phase 7 (reuses device_service and devices router)
- **Phase 9 (US5 — Search)**: Depends on Phase 8 (extends existing devices + audit routes/pages)
- **Phase 10 (US7 — CSV Import)**: Depends on Phase 4 + 6 (needs account scoping and model/device tables)
- **Phase 11 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1 — Onboarding)**: Start after Phase 2+3 — no user story dependencies
- **US6 (P2 — Locations)**: Start after Phase 2+3 — no user story dependencies, but needed by US2
- **US4 (P2 — Device Models)**: Start after Phase 2+3 — no user story dependencies, but needed by US2
- **US2 (P1 — Check-In)**: Requires US1 + US6 + US4 complete
- **US3 (P1 — Check-Out)**: Requires US2 complete (extends same service + router)
- **US5 (P2 — Search)**: Requires US2 + US3 complete (extends devices endpoint)
- **US7 (P3 — CSV Import)**: Requires US1 + US4 complete (needs account/model tables)

### Parallel Opportunities Within Phases

```
Phase 1:  T003 ‖ T004 ‖ T005+T006 ‖ T007+T008 ‖ T011 ‖ T012
Phase 2:  T013+T014 ‖ T015+T016 ‖ T017+T018 — then T019 → T020 → T021 → T022 → T023 → T024
Phase 3:  T026 ‖ T027 — rest sequential
Phase 4:  T038 ‖ T039 ‖ T040 — then T041; T042 ‖ T043 ‖ T044; T045 ‖ T046; T051 ‖ T052; T053 ‖ T054
Phase 5+6: Can run in parallel with each other after T041 is done
```

---

## Parallel Example: US1 Models

```
# Run together (different files, no inter-dependencies):
T038: Create backend/app/models/customer_account.py
T039: Create backend/app/models/engineer.py
T040: Create backend/app/models/engineer_account_mapping.py

# Then T041 (migration) after all 3 models exist
```

---

## Implementation Strategy

### MVP Scope (Phases 1–8 only)

Delivers all 3 P1 user stories and the 2 P2 prerequisites needed to make check-in work:

1. Complete Phase 1: Setup infra (T001–T012)
2. Complete Phase 2: Backend foundation (T013–T024) — CRITICAL blocker
3. Complete Phase 3: Frontend foundation (T025–T037) — can run in parallel with Phase 2
4. Complete Phase 4: US1 Super Admin onboarding (T038–T054)
5. Complete Phases 5+6: Locations + Device Models in parallel (T055–T068)
6. Complete Phase 7: Check-in workflow (T069–T078)
7. Complete Phase 8: Check-out workflow (T079–T083)
8. **STOP and VALIDATE**: Run `docker compose up -d`, execute end-to-end test sequence
9. Demo the MVP: login → create account + engineer → create location hierarchy + device model → check in → check out → view audit log

### Extended Scope (Add after MVP validated)

- Phase 9 (US5): Search & filters + audit log + dashboard — T084–T090
- Phase 10 (US7): CSV bulk import — T091–T096
- Phase 11: Polish, monitoring, security headers — T097–T102

### Local Development Quickstart (after all tasks complete)

```bash
# 1. Copy and fill in secrets
cp .env.example .env

# 2. Start only infrastructure (PostgreSQL + Keycloak)
docker compose up postgres keycloak -d

# 3. Backend (new terminal)
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev   # Vite on http://localhost:5173, proxies /api and /auth

# 5. Open browser to http://localhost:5173
# Login with admin / (password from .env)
```

---

## Summary

| Phase | Story | Priority | Tasks | Key Deliverable |
|---|---|---|---|---|
| 1 | Setup | — | T001–T012 | Docker infra, Nginx, Keycloak realm |
| 2 | Foundation (Backend) | — | T013–T024 | JWT auth, RBAC deps, DB session, Alembic |
| 3 | Foundation (Frontend) | — | T025–T037 | Auth flow, API client, app shell |
| 4 | US1 | P1 🎯 | T038–T054 | Accounts, Engineers, Permissions |
| 5 | US6 | P2 | T055–T062 | Location hierarchy + deletion guard |
| 6 | US4 | P2 | T063–T068 | Device Model master |
| 7 | US2 | P1 🎯 | T069–T078 | Check-in (3-step stepper + atomic audit) |
| 8 | US3 | P1 🎯 | T079–T083 | Check-out + DevicesPage |
| 9 | US5 | P2 | T084–T090 | Search/filter + audit log + dashboard |
| 10 | US7 | P3 | T091–T096 | CSV bulk import (two-phase) |
| 11 | Polish | — | T097–T102 | Security headers, monitoring, smoke test |

**Total**: 102 tasks | **MVP (Phases 1–8)**: 83 tasks | **Parallel opportunities**: 34 tasks marked [P]

---

## Notes

- `[P]` tasks touch different files with no shared incomplete dependencies — safe to parallelize
- Migration `T041` must be created after all 7 models exist (T038–T040, T055, T063, T069, T070)
- Migration `T041b` must run after `T041` (depends on `engineers` table existing); seeds the default super admin so login works immediately after `alembic upgrade head`
- `device_service.check_in` and `check_out` must use a single `AsyncSession` commit for atomic audit log (SC-005)
- Keycloak realm-export.json (T004) is the most fragile config — test Keycloak import early in Phase 1
- Commit after each checkpoint to keep git history clean and reversible
