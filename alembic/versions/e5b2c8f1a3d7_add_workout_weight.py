"""add weight_kg to workouts

Revision ID: e5b2c8f1a3d7
Revises: d41a7e9c2b10
Create Date: 2026-11-18 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5b2c8f1a3d7'
down_revision: Union[str, Sequence[str], None] = 'd41a7e9c2b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workouts', sa.Column('weight_kg', sa.Numeric(5, 2), nullable=True))
    op.create_check_constraint('ck_workouts_weight_non_negative', 'workouts', 'weight_kg >= 0')


def downgrade() -> None:
    op.drop_constraint('ck_workouts_weight_non_negative', 'workouts', type_='check')
    op.drop_column('workouts', 'weight_kg')
