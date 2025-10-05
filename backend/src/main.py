# backend/src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base
from .auth import rbac_routes as rbac_routes

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
app.include_router(rbac_routes.router)

# Create DB tables at startup
Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    import os
    from .db import DB_PATH
    print(f"✅ Database created successfully at: {DB_PATH}")
