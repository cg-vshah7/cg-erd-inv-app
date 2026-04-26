"""initial schema — all 7 tables

Revision ID: 0001
Revises:
Create Date: 2026-04-13

Creates:
  - customer_accounts
  - engineers
  - engineer_account_mappings
  - locations
  - device_models
  - devices
  - audit_logs
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # customer_accounts
    # ------------------------------------------------------------------
    op.create_table(
        "customer_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("contact_name", sa.String(255), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_phone", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_customer_accounts_name"),
    )

    # ------------------------------------------------------------------
    # engineers
    # ------------------------------------------------------------------
    op.create_table(
        "engineers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("keycloak_user_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("keycloak_user_id", name="uq_engineers_keycloak_user_id"),
        sa.UniqueConstraint("email", name="uq_engineers_email"),
    )

    # ------------------------------------------------------------------
    # engineer_account_mappings
    # ------------------------------------------------------------------
    op.create_table(
        "engineer_account_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("engineer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("can_manage_models", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("can_checkin_out", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("can_view_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["engineer_id"], ["engineers.id"],
            name="fk_eam_engineer_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["customer_account_id"], ["customer_accounts.id"],
            name="fk_eam_customer_account_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("engineer_id", "customer_account_id", name="uq_eam_engineer_account"),
    )

    # ------------------------------------------------------------------
    # locations  (self-referential, 4-level hierarchy)
    # ------------------------------------------------------------------
    location_level_enum = postgresql.ENUM(
        "SITE", "BUILDING", "FLOOR", "ROOM",
        name="locationlevel",
        create_type=True,
    )
    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("level", location_level_enum, nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["locations.id"],
            name="fk_locations_parent_id_locations",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["customer_account_id"], ["customer_accounts.id"],
            name="fk_locations_customer_account_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "name", "parent_id", "customer_account_id",
            name="uq_locations_name_parent_account",
        ),
        sa.CheckConstraint(
            "(level = 'SITE' AND parent_id IS NULL) OR (level != 'SITE' AND parent_id IS NOT NULL)",
            name="ck_locations_site_has_no_parent",
        ),
    )
    op.create_index("idx_locations_parent_id", "locations", ["parent_id"])

    # ------------------------------------------------------------------
    # device_models
    # ------------------------------------------------------------------
    op.create_table(
        "device_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_number", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("manufacturer", sa.String(255), nullable=True),
        sa.Column("device_category", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(
            ["customer_account_id"], ["customer_accounts.id"],
            name="fk_device_models_customer_account_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "model_number", "customer_account_id",
            name="uq_device_models_model_number_account",
        ),
    )

    # ------------------------------------------------------------------
    # devices
    # ------------------------------------------------------------------
    device_condition_enum = postgresql.ENUM(
        "GOOD", "FAIR", "POOR", "DAMAGED",
        name="devicecondition",
        create_type=True,
    )
    device_status_enum = postgresql.ENUM(
        "CHECKED_IN", "CHECKED_OUT",
        name="devicestatus",
        create_type=True,
    )
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_model_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("serial_number", sa.String(255), nullable=False),
        sa.Column("asset_tag", sa.String(255), nullable=True),
        sa.Column("condition", device_condition_enum, nullable=False, server_default="GOOD"),
        sa.Column("status", device_status_enum, nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("checked_in_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("checked_out_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["customer_account_id"], ["customer_accounts.id"],
            name="fk_devices_customer_account_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["device_model_id"], ["device_models.id"],
            name="fk_devices_device_model_id_device_models",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"],
            name="fk_devices_location_id_locations",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["checked_in_by_id"], ["engineers.id"],
            name="fk_devices_checked_in_by_id_engineers",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["checked_out_by_id"], ["engineers.id"],
            name="fk_devices_checked_out_by_id_engineers",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "serial_number", "customer_account_id",
            name="uq_devices_serial_number_account",
        ),
        sa.CheckConstraint(
            "status != 'CHECKED_IN' OR location_id IS NOT NULL",
            name="ck_devices_checked_in_requires_location",
        ),
    )
    op.create_index(
        "idx_devices_account_status", "devices", ["customer_account_id", "status"]
    )
    # Trigram index on serial_number for FR-016 search
    op.execute(
        "CREATE INDEX idx_devices_serial_trgm ON devices "
        "USING GIN (serial_number gin_trgm_ops)"
    )

    # ------------------------------------------------------------------
    # audit_logs  (insert-only, no updated_at)
    # ------------------------------------------------------------------
    audit_action_enum = postgresql.ENUM(
        "CHECK_IN", "CHECK_OUT",
        name="auditaction",
        create_type=True,
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", audit_action_enum, nullable=False),
        sa.Column("engineer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("location_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(
            ["device_id"], ["devices.id"],
            name="fk_audit_logs_device_id_devices",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["customer_account_id"], ["customer_accounts.id"],
            name="fk_audit_logs_customer_account_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["engineer_id"], ["engineers.id"],
            name="fk_audit_logs_engineer_id_engineers",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"],
            name="fk_audit_logs_location_id_locations",
            ondelete="SET NULL",
        ),
    )
    op.create_index("idx_audit_event_at", "audit_logs", ["event_at"], postgresql_ops={"event_at": "DESC"})


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.execute("DROP TYPE IF EXISTS auditaction")

    op.drop_index("idx_devices_serial_trgm", table_name="devices")
    op.drop_index("idx_devices_account_status", table_name="devices")
    op.drop_table("devices")
    op.execute("DROP TYPE IF EXISTS devicestatus")
    op.execute("DROP TYPE IF EXISTS devicecondition")

    op.drop_table("device_models")

    op.drop_index("idx_locations_parent_id", table_name="locations")
    op.drop_table("locations")
    op.execute("DROP TYPE IF EXISTS locationlevel")

    op.drop_table("engineer_account_mappings")
    op.drop_table("engineers")
    op.drop_table("customer_accounts")
