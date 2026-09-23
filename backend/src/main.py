from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from src.core.config import settings
from src.db.session import engine
from src.db.base import Base
# Import all models to ensure metadata registration
import src.models
from src.api.v1.router import api_router


import asyncio
from src.services.mqtt_consumer import start_mqtt_consumer
from src.services.device_watchdog import device_watchdog


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables & TimescaleDB hypertable if needed
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Attempt to create TimescaleDB hypertable for telemetries if TimescaleDB extension is active
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
            await conn.execute(
                text(
                    "SELECT create_hypertable('telemetries', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);"
                )
            )
        except Exception:
            # Fallback gracefully if standard PostgreSQL is used
            pass

    # Start background workers
    mqtt_task = asyncio.create_task(start_mqtt_consumer())
    watchdog_task = asyncio.create_task(device_watchdog.run())

    yield
    # Shutdown logic
    mqtt_task.cancel()
    watchdog_task.cancel()
    try:
        await asyncio.gather(mqtt_task, watchdog_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Healthcheck
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
    }


from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException, Request

# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


# Standardize Exception Responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "message": str(exc.detail),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg", "Validation error") if errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": {"errors": errors},
            "message": f"Validation Error: {msg}",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": f"Internal Server Error: {str(exc)}",
        },
    )

