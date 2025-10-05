# backend/src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base

# import models so all tables register
from .auth import models as auth_models
from .core import models as core_models
from .auth import routes as auth_routes

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

# Create all tables
Base.metadata.create_all(bind=engine)
print("✅ Database created successfully at:", engine.url)
