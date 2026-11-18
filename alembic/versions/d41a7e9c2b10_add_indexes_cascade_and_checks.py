"""add user_id indexes, ON DELETE CASCADE and CHECK constraints

Revision ID: d41a7e9c2b10
Revises: 3b242502c834
Create Date: 2026-11-17 12:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd41a7e9c2b10'
down_revision: Union[str, Sequence[str], None] = '3b242502c834'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHILD_TABLES = ("workouts", "nutrition", "sleep")

CHECKS = [
    ("workouts", "ck_workouts_reps_positive", "reps > 0"),
    ("workouts", "ck_workouts_sets_positive", "sets > 0"),
    ("workouts", "ck_workouts_time_positive", "workout_time > 0"),
    ("workouts", "ck_workouts_rest_non_negative", "time_between_sets >= 0"),
    ("nutrition", "ck_nutrition_values_non_negative", "calories >= 0 AND protein >= 0 AND fats >= 0 AND carbs >= 0"),
    ("sleep", "ck_sleep_wake_after_bed", "wake_up_at > go_to_bed_at"),
    ("sleep", "ck_sleep_hours_range", "hours_of_sleep BETWEEN 0 AND 24"),
    ("sleep", "ck_sleep_hours_non_negative", "nap_hours_before_bed >= 0 AND hours_since_last_meal >= 0"),
]


def upgrade() -> None:
    for table, _name, condition in CHECKS:
        op.execute(f"DELETE FROM {table} WHERE NOT ({condition})")

    for table in CHILD_TABLES:
        op.drop_constraint(f"{table}_user_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_user_id_fkey", table, "users", ["user_id"], ["id"], ondelete="CASCADE"
        )

    for table in CHILD_TABLES:
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])

    for table, name, condition in CHECKS:
        op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    for table, name, _condition in CHECKS:
        op.drop_constraint(name, table, type_="check")

    for table in CHILD_TABLES:
        op.drop_index(f"ix_{table}_user_id", table_name=table)

    for table in CHILD_TABLES:
        op.drop_constraint(f"{table}_user_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(f"{table}_user_id_fkey", table, "users", ["user_id"], ["id"])
