# backend/src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from .db import engine, Base

# Ensure models are registered BEFORE create_all()
from .auth import models as auth_models      # noqa: F401
from .core import models as core_models      # noqa: F401

# Routers
from .auth import routes as auth_routes
from .auth import rbac_routes as admin_routes
from .ml import predict_api as ml_api        # /ml/info, /ml/reload, /ml/predict
from .ml import routes as ml_misc            # /ml/health

app = FastAPI(title="Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers ONCE
app.include_router(auth_routes.router)
app.include_router(admin_routes.router)
app.include_router(ml_api.router)   # <- this gives /ml/info, /ml/reload, /ml/predict
app.include_router(ml_misc.router)  # <- /ml/health

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    print("✅ Tables:", insp.get_table_names())
    # PRINT ROUTES to confirm /ml/info is mounted
    print("✅ Routes:")
    for r in app.routes:
        try:
            print("   ", r.path, getattr(r, "methods", None))
        except Exception:
            pass

@app.get("/")
def root():
    return {"msg": "Backend API running. See /docs"}
