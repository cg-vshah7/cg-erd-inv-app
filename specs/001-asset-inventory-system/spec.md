# Feature Specification: Asset Inventory System

**Feature Branch**: `001-asset-inventory-system`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: Asset tracking web application for an IT service provider managing MedDevice/MedTech customer equipment

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Super Admin Onboards Engineers and Customers (Priority: P1)

A Super Admin sets up the system for a new client engagement: creates a customer account for the MedDevice company, adds engineers as users, maps engineers to the customer account, and assigns each engineer the appropriate permission levels. This is the foundation that enables all other usage.

**Why this priority**: Without accounts and permissions in place, no other workflow can proceed. This is the prerequisite to all other stories.

**Independent Test**: Can be fully tested by a Super Admin logging in, creating a customer account, creating two engineer users, assigning them to the account with different permission levels, and verifying each engineer can only access what their permissions allow.

**Acceptance Scenarios**:

1. **Given** I am logged in as a Super Admin, **When** I create a new customer account with a name, **Then** the account appears in the customer list and engineers can be mapped to it.
2. **Given** I am a Super Admin, **When** I create a new engineer user with email and password and assign them to a customer account with View Only permission, **Then** the engineer can log in and view device data for that account but cannot check in, check out, or edit device models.
3. **Given** I am a Super Admin, **When** I assign an engineer Check-In/Check-Out permission, **Then** that engineer can check in and check out devices but cannot create device models.
4. **Given** an engineer attempts to access a customer account they are not assigned to, **When** they try to view or act on that account's data, **Then** the system denies access and shows an appropriate message.

---

### User Story 2 - Engineer Checks In a Customer Device (Priority: P1)

An engineer with Check-In/Check-Out permission receives a physical device from a customer and records its arrival in the system: selecting the customer account, identifying the device by serial number, selecting its model, assigning it to a room in the location hierarchy, noting the check-in date, and saving.

**Why this priority**: Check-in is the primary data entry workflow; all tracking and reporting depends on devices being accurately registered in the system.

**Independent Test**: Can be fully tested by logging in as an engineer with Check-In/Check-Out permission, checking in a device with all required fields, and verifying it appears as Checked-In with the correct location.

**Acceptance Scenarios**:

1. **Given** I am an engineer with Check-In/Check-Out permission for a customer account, **When** I enter a new serial number, select a model, assign a room location, set the check-in date, and save, **Then** the device appears in the inventory as Checked-In with the correct details and location.
2. **Given** I attempt to check in a device with a serial number already recorded as Checked-In for the same customer account, **When** I try to save, **Then** the system shows an error and prevents the duplicate check-in.
3. **Given** I attempt to save a check-in without assigning a room location, **When** I try to save, **Then** the system shows a validation error requiring location assignment before saving.
4. **Given** a check-in is completed, **When** the audit log is reviewed, **Then** an entry exists recording the device, the engineer who checked it in, and the timestamp.

---

### User Story 3 - Engineer Checks Out a Customer Device (Priority: P1)

An engineer with Check-In/Check-Out permission returns a device to a customer. They locate the checked-in device, record the check-out date and any comments, and confirm the check-out. The device status changes to Checked-Out and the location assignment is cleared.

**Why this priority**: Check-out closes the device's active lifecycle in the system and is essential for maintaining accurate inventory status.

**Independent Test**: Can be fully tested by checking in a device and then checking it out, verifying status changes to Checked-Out and the location field is cleared.

**Acceptance Scenarios**:

1. **Given** a device is Checked-In, **When** an engineer with Check-In/Check-Out permission selects it, records a check-out date, and confirms, **Then** the device status changes to Checked-Out, the location is cleared, and the checked-out-by engineer is recorded.
2. **Given** a device is already Checked-Out, **When** an engineer attempts to check it out again, **Then** the system prevents the action and shows an appropriate message.
3. **Given** a check-out is completed, **When** the audit log is reviewed, **Then** an entry exists recording the device, the engineer who checked it out, and the timestamp.

---

### User Story 4 - Engineer Manages Device Model Master (Priority: P2)

An engineer with Device Model Master permission maintains the catalog of device types for their assigned customer accounts by creating and editing device models (model number, name, description). These models are then available for selection during device check-in.

**Why this priority**: The model catalog is a prerequisite for check-in, but initial data load via CSV can bootstrap this. Manual management is needed for ongoing maintenance.

**Independent Test**: Can be fully tested by logging in as an engineer with Device Model Master permission, creating a new device model, and verifying it is selectable when checking in a device for that customer account.

**Acceptance Scenarios**:

1. **Given** I have Device Model Master permission for a customer account, **When** I create a device model with model number, name, and description, **Then** the model appears in the catalog and is available for selection during device check-in.
2. **Given** I have Device Model Master permission, **When** I edit an existing device model's name or description, **Then** the updated details are reflected throughout the system.
3. **Given** I have only View Only permission, **When** I attempt to create or edit a device model, **Then** the system denies the action.

---

### User Story 5 - Engineer Searches and Filters Devices (Priority: P2)

An engineer needs to locate specific devices or understand the current state of inventory. They use the search and filter capabilities to narrow down devices by model, serial number, engineer name, check-in/check-out dates, customer account, location, or status.

**Why this priority**: Search is essential for day-to-day operations but depends on devices already being in the system.

**Independent Test**: Can be fully tested by populating the system with test devices and verifying search by each filter type returns only the expected results.

**Acceptance Scenarios**:

1. **Given** devices exist in the system, **When** I search by serial number, **Then** only devices matching that serial number (or partial match) are shown.
2. **Given** devices exist across multiple statuses and locations, **When** I filter by status (Checked-In or Checked-Out) and location, **Then** only matching devices are shown.
3. **Given** I am assigned to multiple customer accounts, **When** I search without filtering by account, **Then** results include devices from all my assigned accounts only (not other customers' devices).

---

### User Story 6 - Super Admin Manages Location Hierarchy (Priority: P2)

A Super Admin sets up and maintains the physical location hierarchy (Company Site → Building → Floor → Room) that engineers use when checking in devices. Locations are available system-wide for assignment.

**Why this priority**: Location data must exist before engineers can check in devices, but it can be set up once and rarely changes.

**Independent Test**: Can be fully tested by a Super Admin creating a site, building, floor, and room, then verifying an engineer can select that room when checking in a device.

**Acceptance Scenarios**:

1. **Given** I am a Super Admin, **When** I create a location hierarchy (site → building → floor → room), **Then** engineers can select that room when checking in a device.
2. **Given** I attempt to check in a device without any rooms existing in the system, **When** I reach the location assignment step, **Then** the system prompts me to contact the admin to set up locations.

---

### User Story 7 - Bulk CSV Import of Devices and Models (Priority: P3)

A Super Admin imports existing device inventory and device model catalog data from CSV files to populate the system at go-live, avoiding the need for manual entry of hundreds or thousands of records.

**Why this priority**: This is a one-time data migration activity. The system is usable without it, but it significantly reduces initial setup effort.

**Independent Test**: Can be fully tested by uploading a CSV with valid rows and a second CSV with intentional errors, verifying that the valid import commits all rows and the invalid import shows per-row errors without committing any data.

**Acceptance Scenarios**:

1. **Given** a CSV file with valid Device Model Master records for a customer account, **When** I upload it, **Then** all records are imported and appear in that customer's model catalog.
2. **Given** a CSV file with valid device records for a customer account, **When** I upload it, **Then** all devices are imported with correct status and details.
3. **Given** a CSV file containing some invalid or duplicate rows, **When** I upload it, **Then** the system shows specific validation errors for each problematic row and does not commit any records from that file.
4. **Given** a CSV file with 1,000 records, **When** I upload it, **Then** the import completes and all results (success or error) are displayed.

---

### Edge Cases

- What happens when a serial number being checked in already exists as Checked-In for the same customer account? (Blocked with error — duplicate check-in is not allowed.)
- What happens when an engineer tries to check in a device but no device models exist yet for that customer? (System prompts to add a model or contact an admin with Device Model Master permission.)
- What happens when a CSV import row references a device model that does not exist in the customer's model catalog? (That row is flagged as invalid; the rest of the file is not committed.)
- What happens when a device is checked out — is its previous location retained in history? (The location is cleared from the active record but preserved in the audit log entry for the check-in event.)
- What happens when an engineer is removed from a customer account — can they still see historical data? (Access is revoked immediately; they can no longer view that account's data.)
- What happens when a location (room) that has checked-in devices is deleted? (Deletion is blocked if active checked-in devices are assigned to it.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow Super Admins to create, view, and manage customer accounts representing MedDevice/MedTech client companies.
- **FR-002**: System MUST allow Super Admins to create engineer user accounts using email and a set initial password; engineers cannot self-register.
- **FR-003**: System MUST allow Super Admins to assign engineers to one or more customer accounts.
- **FR-004**: System MUST support three independently assignable permission levels per engineer: Device Model Master, Check-In/Check-Out, and View Only.
- **FR-005**: System MUST allow Super Admins to update or revoke engineer permissions and customer account assignments at any time.
- **FR-006**: System MUST provide a password reset workflow for all users via a link sent to their registered email address.
- **FR-007**: System MUST allow engineers with Device Model Master permission to create and edit device models (model number, name, description) for their assigned customer accounts.
- **FR-008**: System MUST allow engineers with Check-In/Check-Out permission to check in a device by recording: serial number, device model (selected from the model master), location (site/building/floor/room), check-in date, and optional comments.
- **FR-009**: System MUST record the engineer performing a check-in as the "Checked-In By" field automatically.
- **FR-010**: System MUST prevent check-in if the serial number already has a Checked-In record for the same customer account.
- **FR-011**: System MUST require a room-level location assignment for every check-in; saving without a location is not permitted.
- **FR-012**: System MUST support a four-level physical location hierarchy: Company Site → Building → Floor → Room, managed by Super Admins.
- **FR-013**: System MUST allow engineers with Check-In/Check-Out permission to check out a Checked-In device by recording: check-out date and optional comments; system automatically records the engineer as "Checked-Out By."
- **FR-014**: System MUST update device status to Checked-Out and clear the location assignment upon successful check-out.
- **FR-015**: System MUST allow engineers with Check-In/Check-Out permission to edit the details (model, location, comments) of a Checked-In device.
- **FR-016**: System MUST allow all engineers to search and filter devices by: model, serial number, engineer name, check-in date, check-out date, customer account, location, and status — within their assigned customer accounts only.
- **FR-017**: System MUST restrict all data visibility and actions to the customer accounts an engineer is explicitly assigned to.
- **FR-018**: System MUST automatically log every check-in and check-out event with: device identifier, action type, engineer, timestamp, and location at time of action.
- **FR-019**: System MUST allow Super Admins to import Device Model Master records for a specific customer account via CSV file.
- **FR-020**: System MUST allow Super Admins to import device records for a specific customer account via CSV file.
- **FR-021**: System MUST validate all rows in a CSV import and display per-row errors before committing any records; partial imports are not permitted.
- **FR-022**: System MUST prevent deletion of a location (room) that has active Checked-In devices assigned to it.

### Key Entities

- **Customer Account**: Represents a MedDevice/MedTech client company; all device models and devices are scoped to a customer account.
- **Engineer**: A user of the system with one or more permission levels, mapped to one or more customer accounts; created and managed by Super Admins.
- **Super Admin**: A system-wide administrator with full access to all accounts, users, and settings.
- **Device Model**: A catalog entry defining a type of physical device (model number, name, description) within a customer account; used when checking in devices.
- **Device**: A physical asset identified by serial number, linked to a device model and customer account; has a Checked-In or Checked-Out status and a room location when checked in.
- **Location**: A node in the four-level physical hierarchy (Company Site → Building → Floor → Room) where devices reside while checked in.
- **Audit Log Entry**: An immutable record of a check-in or check-out event, capturing the device, engineer, action type, timestamp, and location at time of action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Engineers can complete a full device check-in workflow (from login to confirmation) in under 2 minutes.
- **SC-002**: Engineers can locate any specific device using search or filters in under 30 seconds.
- **SC-003**: Super Admins can create a new engineer, assign them to a customer account, and set permissions in under 5 minutes.
- **SC-004**: CSV imports of up to 1,000 records complete processing and display all validation results within 60 seconds.
- **SC-005**: 100% of check-in and check-out events are captured in the audit log — no events are missed or lost.
- **SC-006**: Zero unauthorized cross-account data access incidents — engineers can only see and act on their assigned customer accounts.
- **SC-007**: 90% of engineers successfully complete their first check-in or check-out without requiring support or guidance.
- **SC-008**: All inventory data remains consistent — no device is recorded as Checked-In in two locations simultaneously.

## Assumptions

- Engineers are internal staff of the IT service provider, not employees of the MedDevice/MedTech customer companies.
- The initial target scale is up to approximately 100 engineers and 50 customer accounts; the system should handle this comfortably without performance concerns.
- Location hierarchy data (sites, buildings, floors, rooms) is created and maintained by Super Admins; engineers cannot create or modify locations.
- An engineer may hold multiple permission levels simultaneously for the same customer account (e.g., both Device Model Master and Check-In/Check-Out).
- A device can only be checked in at one location at a time; concurrent check-in at multiple locations is not supported.
- Historical check-in/check-out records are retained permanently; devices cannot be deleted from the system, only checked out.
- The system is primarily accessed via web browser on desktop and tablet devices; dedicated mobile phone optimization is out of scope for the initial release.
- CSV bulk import is available to Super Admins only and is intended for initial data load; ongoing bulk imports by engineers are out of scope for v1.
- Password complexity rules follow standard industry practices (minimum length, mix of character types).
- Each customer account and its data are fully isolated from all other customer accounts in the system.
