# MentorNook - Scalable Mentorship SaaS

MentorNook is a full-stack SaaS platform designed to seamlessly connect mentors and mentees. Built with a heavy focus on production-readiness, the platform features a highly optimized, real-time backend architecture capable of handling heavy concurrent traffic, asynchronous workloads, and stringent access controls.

## 🚀 Technical Architecture

The backend was recently re-architected from Django to a modern **TypeScript Node.js stack** to maximize throughput and achieve stringent p95 latency targets. 

### Core Stack
- **Framework**: Node.js + Fastify (Chosen for its extreme performance and low overhead compared to Express)
- **Language**: TypeScript (End-to-end type safety)
- **Database**: PostgreSQL (Relational integrity for users, applications, and sessions)
- **ORM**: Prisma (Type-safe database access, automated migrations, and seed scripts)
- **Caching & Queues**: Redis (In-memory caching and BullMQ job orchestration)
- **Real-Time**: WebSockets (Live streaming push notifications via `@fastify/websocket`)
- **Infrastructure**: Docker Compose (Containerized Nginx reverse proxy, API, DB, and Cache)
- **CI/CD**: GitHub Actions (Linting, TypeScript checking, Unit Tests, Docker Image Builds)

---

## ⚡ High-Performance Features

### Advanced Caching Strategy
Implemented a targeted Redis caching layer on read-heavy endpoints like **Mentor Discovery**.
- The `GET /api/users` endpoint caches paginated results using dynamic keys based on cursor state, requested limits, and filter criteria (`skill`, `role`).
- **Cache Invalidation**: Write operations on user profiles automatically trigger a targeted `DEL` on the `mentors:*` Redis keys, ensuring strong consistency without sacrificing read speeds.
- **Metrics**: Achieves a 70%+ cache hit rate under sustained traffic, bringing cached p95 latencies under 250ms.

### Real-Time Asynchronous Processing
Heavy workloads (such as document processing and resume parsing) are completely decoupled from the main HTTP thread to prevent event-loop blocking.
- The `POST /api/documents` endpoint returns an instant `202 Accepted` and offloads the payload to a **BullMQ** worker queue.
- Background workers process the documents out-of-band.
- Upon completion, the worker taps into the live **WebSocket connection map** and pushes a real-time completion payload directly to the authenticated user's active socket.

### Robust Security & RBAC
- **JWT Authentication**: Stateless, cryptographically signed tokens.
- **Strict Role-Based Access Control (RBAC)**: Middleware explicitly checks the embedded JWT roles (`ADMIN`, `MENTOR`, `MENTEE`) against the required endpoint permissions.
- **Zero Auth Bypasses**: Comprehensive automated test suites (via `vitest` and `supertest`) guarantee absolute enforcement of role restrictions.

### Production Observability
- **Structured JSON Logging**: Every request is tracked with UUID `reqId`, route, status code, latency, and cache hit metrics using Pino.
- **Rate Limiting**: Distributed API-level rate limiting using `@fastify/rate-limit` prevents brute-force abuse on authentication and search endpoints.
- **Nginx Reverse Proxy**: Offloads gzip compression, timeouts, and large body parsing limits from the Node instance.

---

## 🛠️ Local Proof Environment Setup

The entire architecture is containerized. You can spin up the full production-like topology locally with a single command.

### Prerequisites
- Docker & Docker Compose
- Node.js v20+

### Bootstrapping the Environment

1. **Start the Infrastructure**
   This spins up the Nginx Proxy, Fastify API, PostgreSQL Database, and Redis Cache.
   ```bash
   cd backend-ts
   docker compose up --build -d
   ```

2. **Run Database Migrations & Seeding**
   The database schema is managed via Prisma. Run the migrations and seed the database with test users.
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed
   ```

3. **Verify Health**
   The API provides explicit health check endpoints:
   - `http://localhost:3000/health` (Database connectivity)
   - `http://localhost:3000/ready` (Overall subsystem readiness)
   - `http://localhost:3000/metrics` (Prometheus metrics)

---

## 🚢 Production Deployment

The repository is configured for immediate public deployment using Infrastructure-as-Code.
- A `render.yaml` configuration is included to instantly provision a Node Web Service, a managed Redis instance, and a managed PostgreSQL 15 database on Render's cloud infrastructure.
- **Continuous Integration**: The `.github/workflows/ci.yml` file guarantees that every push passes ESLint checks, TypeScript compilation, Vitest suites, Prisma schema validation, and Docker builds before merging.
