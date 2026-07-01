# CodeCity AI 🏙️

> Transform multi-language GitHub repositories into interactive 3D Cyberpunk Metropolises using WebGL.

## Architecture

```
codecity-ai/
├── apps/
│   ├── frontend/        # React + R3F + Three.js (Vite)
│   └── backend/         # Fastify + tRPC + BullMQ
├── packages/
│   └── shared/          # UAMS schemas (Zod) + config
├── .github/workflows/   # CI/CD
└── docker-compose.yml   # Redis + Backend + Frontend
```

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker (for Redis)

# 1. Start Redis
docker compose up -d redis

# 2. Install dependencies
npm install

# 3. Build shared types
npm run build:shared

# 4. Start development
npm run dev:backend   # Terminal 1 — API on :3001
npm run dev:frontend  # Terminal 2 — UI on :5173
```

## Tech Stack

| Layer | Technology |
|---|---|
| 3D Engine | React Three Fiber + Three.js |
| Frontend | React 18 + TypeScript (strict) + Zustand + TailwindCSS |
| Backend | Fastify + tRPC + BullMQ |
| Parsing | web-tree-sitter (WASM) |
| Validation | Zod (end-to-end) |
| Queue | BullMQ + Redis |

## Design System: Matrix Grid

Monochrome green on true black. Every surface earns its light from emissive glow only.

---

*Built with enterprise engineering discipline.*
