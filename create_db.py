# create_db.py
from backend.src.db import Base, engine
from backend.src.auth import models

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("✅ Database initialized successfully!")
