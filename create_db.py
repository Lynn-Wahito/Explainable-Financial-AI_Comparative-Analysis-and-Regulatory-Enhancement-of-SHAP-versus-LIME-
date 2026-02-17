# create_db.py
from backend.src.db import Base, engine
from backend.src.auth import models as auth_models
from backend.src.core import models as core_models

print("Creating all database tables...")
Base.metadata.create_all(bind=engine)
print("✅ Database initialized successfully with auth + core tables!")
