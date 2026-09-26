"""add profile fields to user

Revision ID: 3b242502c834
Revises: b006b2f7cc5f
Create Date: 2026-09-19 08:48:12.348737

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3b242502c834'
down_revision: Union[str, Sequence[str], None] = 'b006b2f7cc5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('nutrition', 'nutrition_goal')

    gender_enum = postgresql.ENUM('male', 'female', name='gender')
    gender_enum.create(op.get_bind(), checkfirst=True)

    activity_level_enum = postgresql.ENUM(
        'sedentary', 'light', 'moderate', 'active', 'very_active', name='activitylevel'
    )
    activity_level_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('users', sa.Column('gender', gender_enum, nullable=True))
    op.add_column('users', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('activity_level', activity_level_enum, nullable=True))
    op.add_column(
        'users',
        sa.Column(
            'current_goal',
            postgresql.ENUM('bulking', 'maintenance', 'cutting', name='nutrition_goal', create_type=False),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'current_goal')
    op.drop_column('users', 'activity_level')
    op.drop_column('users', 'birth_date')
    op.drop_column('users', 'gender')

    postgresql.ENUM(name='activitylevel').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='gender').drop(op.get_bind(), checkfirst=True)

    op.add_column(
        'nutrition',
        sa.Column(
            'nutrition_goal',
            postgresql.ENUM('bulking', 'maintenance', 'cutting', name='nutrition_goal', create_type=False),
            autoincrement=False,
            nullable=False,
        ),
    )