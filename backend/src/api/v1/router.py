from fastapi import APIRouter
from src.api.v1.endpoints import sites, telemetry, ontology, rules, issues, ai_agent, ws

api_router = APIRouter()

api_router.include_router(sites.router, prefix="/sites", tags=["Sites"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetry"])
api_router.include_router(ontology.router, prefix="/ontology", tags=["Ontology & BrickSchema"])
api_router.include_router(rules.router, prefix="/rules", tags=["Rules"])
api_router.include_router(issues.router, prefix="/issues", tags=["Issues & Faults"])
api_router.include_router(ai_agent.router, prefix="/ai-agent", tags=["AI Agent (Rule Drafting)"])
api_router.include_router(ws.router, tags=["WebSocket"])
