"""seed_data

Revision ID: 6ece4eff2fa1
Revises: 1462de30704b
Create Date: 2026-04-02 18:46:54.171306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ece4eff2fa1'
down_revision: Union[str, Sequence[str], None] = '1462de30704b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        INSERT INTO workspaces (id, name, slug)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default')
        ON CONFLICT DO NOTHING;
    """)
    op.execute("""
        INSERT INTO users (id, workspace_id, email, password_hash, display_name, role)
        VALUES (
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000001',
            'admin@meetmind.local',
            '$2b$12$4O6jD8R7jX0I4iO1q14MTe2z1S2n2S6S6n6n2z2z1S2n2S2z1', 
            'System Admin',
            'admin'
        )
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM users WHERE email='admin@meetmind.local';")
    op.execute("DELETE FROM workspaces WHERE slug='default';")
