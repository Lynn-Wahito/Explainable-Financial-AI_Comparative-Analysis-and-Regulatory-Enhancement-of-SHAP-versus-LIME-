# tests/test_db_core.py
import os
import sys
from sqlalchemy import inspect

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.src.db import engine, DB_PATH, Base
from backend.src.core import models as core_models  # noqa: F401

def test_db_file_and_tables_exist():
    # Ensure tables are created (idempotent)
    Base.metadata.create_all(bind=engine)

    # 1) DB file exists
    assert os.path.exists(DB_PATH), f"Database file not found at {DB_PATH}"

    # 2) Expected tables exist in DB
    inspector = inspect(engine)
    found_tables = set(inspector.get_table_names())

    expected_tables = {
        "customer",
        "credit_account",
        "payment_status",
        "bill_amount",
        "payment_amount",
        "model_results",
        "explanation_results",
    }

    missing = expected_tables - found_tables
    assert not missing, f"Missing tables: {missing}. Found: {sorted(found_tables)}"
