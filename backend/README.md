# Multi-Site AFDD Platform

A scalable Automated Fault Detection and Diagnostics (AFDD) platform designed with Clean / Layered Architecture, supporting BrickSchema building ontologies, time-series telemetry ingestion (TimescaleDB / PostgreSQL), continuous fault evaluation windows, Human-in-the-loop AI Agent rule drafting, and an independent multi-site IoT device simulator service.

---

## 🏗 Directory Architecture

```
multi_site_afdd/
├── src/                              # FastAPI Core Application
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── telemetry.py      # Current values & historical time-series queries
│   │       │   ├── ontology.py       # BrickSchema entities, relationships & impact graph
│   │       │   ├── rules.py          # Manage Rule schemas & targeting
│   │       │   ├── issues.py         # Track detected issues, evidence & affected rooms
│   │       │   └── ai_agent.py       # LLM rule drafting (Human-in-the-loop)
│   │       └── router.py             # Root v1 router
│   ├── core/
│   │   ├── config.py                 # Pydantic-settings environment configuration
│   │   └── security.py               # Authentication & JWT helpers
│   ├── db/
│   │   ├── base.py                   # SQLAlchemy Declarative Base
│   │   └── session.py                # Async session maker & database pool
│   ├── models/                       # SQLAlchemy ORM Models
│   │   ├── entity.py                 # BrickSchema entities (AHU, Zone, Room, Meter, IAQ)
│   │   ├── telemetry.py              # Time-series metrics table (TimescaleDB hypertable ready)
│   │   ├── rule.py                   # AFDD Rules (separates Target Scope from Fault Logic)
│   │   └── issue.py                  # Detected issues, evidence, affected rooms
│   ├── schemas/                      # Pydantic DTOs (Request / Response validation)
│   │   ├── ontology_schema.py
│   │   ├── telemetry_schema.py
│   │   ├── rule_schema.py
│   │   └── issue_schema.py
│   ├── crud/                         # Data Access Layer (Repository Pattern)
│   │   ├── crud_ontology.py
│   │   ├── crud_telemetry.py
│   │   ├── crud_rule.py
│   │   └── crud_issue.py
│   ├── services/                     # Business Logic & Workers
│   │   ├── ingestion_service.py      # Telemetry validation & deduplication
│   │   ├── afdd_evaluator.py         # 15-minute continuous fault evaluation + BrickSchema impact
│   │   └── llm_orchestrator.py       # AI Agent harness (Draft-only bounded rules)
│   └── main.py                       # FastAPI Application Entrypoint
├── simulator/                        # Mock Device Simulator Service
│   ├── Dockerfile                    # Container definition for simulator
│   ├── requirements.txt              # Simulator dependencies
│   ├── simulator.py                  # Streams AHU (15s) and Meter/IAQ (60s) metrics
│   └── fixtures/                     # Initial entities & relations (Buildings A-C)
│       └── buildings.json
├── alembic/                          # Database Migrations
├── docker-compose.yml                # Full stack orchestrator (TimescaleDB, API, Simulator)
├── requirements.txt                  # Python dependencies
└── .env.example                      # Sample environment variables
```

---

## 🚀 Quick Start with Docker Compose

Run the entire platform (TimescaleDB, FastAPI Core, and Device Simulator) with a single command:

```bash
docker compose up --build
```

### Services & Endpoints:
- **FastAPI Core API & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck:** [http://localhost:8000/health](http://localhost:8000/health)
- **TimescaleDB / PostgreSQL:** `localhost:5432` (User: `postgres`, Password: `postgres`, DB: `afdd_db`)
- **Simulator Service:** Automatically bootstraps Buildings A–C ontology and continuously streams mock telemetry.

---

## 🛠 Local Development Setup

1. **Create Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Setup Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start FastAPI Application**:
   ```bash
   uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Run Device Simulator**:
   ```bash
   python simulator/simulator.py
   ```
