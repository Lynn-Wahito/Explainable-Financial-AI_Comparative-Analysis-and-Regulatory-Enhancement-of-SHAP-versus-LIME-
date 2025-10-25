# backend/src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from .db import engine, Base
from .auth import routes as auth_routes
from .auth import rbac_routes as rbac_routes

# Import models so all tables are registered with Base BEFORE create_all()
from .auth import models as auth_models
from .core import models as core_models

app = FastAPI(title="Backend API")

# Allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_routes.router)
app.include_router(rbac_routes.router)

# Create DB tables once on startup (prevents duplication & ensures all models are registered)
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    print("✅ Tables registered:", insp.get_table_names())
