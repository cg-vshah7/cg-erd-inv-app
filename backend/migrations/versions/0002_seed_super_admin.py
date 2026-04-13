"""seed default super admin engineer

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-13

Inserts the System Administrator engineer row that corresponds to the Keycloak
admin user pre-loaded by docker/keycloak/realm-export.json (T004).

  keycloak_user_id : 00000000-0000-0000-0000-000000000001
  username/email   : admin / admin@erd-inv.local
  password         : Admin1234!  (set in realm-export.json)

Without this row the get_current_user dependency raises 401 even after a
successful Keycloak login, because it cannot find the engineer in the DB.
ON CONFLICT ... DO NOTHING makes the migration idempotent.
"""

from alembic import op

# revision identifiers, used by Alembic
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO engineers (id, keycloak_user_id, email, full_name, is_active, is_super_admin, created_at)
        VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000001',
            'admin@erd-inv.local',
            'System Administrator',
            true,
            true,
            now()
        )
        ON CONFLICT (keycloak_user_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM engineers
        WHERE keycloak_user_id = '00000000-0000-0000-0000-000000000001';
        """
    )
