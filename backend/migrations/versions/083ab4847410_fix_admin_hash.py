"""fix_admin_hash

Revision ID: 083ab4847410
Revises: 6ece4eff2fa1
Create Date: 2026-06-27 17:40:25.712502

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '083ab4847410'
down_revision: Union[str, Sequence[str], None] = '6ece4eff2fa1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        UPDATE users
        SET password_hash = '$2b$12$wloXQO198ZmS5PecvGMKYeJBkgLBCI2j15osV4HUa8fb28eNMWXgG'
        WHERE email = 'admin@meetmind.local';
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        UPDATE users
        SET password_hash = '$2b$12$4O6jD8R7jX0I4iO1q14MTe2z1S2n2S6S6n6n2z2z1S2n2S2z1'
        WHERE email = 'admin@meetmind.local';
    """)
