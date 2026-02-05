# Voice AI Call Center Dashboard - Project Summary

## Executive Summary

**Project Name:** Voice AI Call Center Dashboard
**Company:** Oolix.in
**Purpose:** Enterprise-grade, AI-powered voice call center platform that automates both outbound sales campaigns and inbound order-taking operations using real-time AI conversation capabilities.

**Target Audience:**
- Businesses running outbound sales/insurance campaigns (Policybazaar model)
- Restaurants and food delivery services needing voice-based order taking (Pizza delivery model)
- Any organization managing high-volume voice interactions

**Key Value Proposition:**
Replaces expensive human call center agents with an AI system that handles calls end-to-end, including customer detection, objection handling, order processing, payment collection, and intelligent follow-up sequences -- while providing real-time monitoring, analytics, and human escalation when needed.

---

## Complete Features List

### Core Platform

| Feature | Description |
|---------|-------------|
| JWT Authentication | Secure login/registration with access + refresh tokens, 2FA support |
| Team Management | Multi-tenant team system with roles (admin, manager, member) |
| Role-Based Access | RBAC middleware controlling access per team and role |
| Audit Logging | Complete audit trail of all system actions |
| Input Sanitization | XSS/injection prevention on all inputs |
| Rate Limiting | Configurable per-endpoint rate limiting |

### Voice Call Management

| Feature | Description |
|---------|-------------|
| Twilio Voice Integration | Inbound/outbound call handling via Twilio |
| OpenAI Realtime AI | Real-time AI conversation using GPT-4o Realtime |
| Live Call Monitoring | Real-time dashboard showing active calls with sentiment |
| Call Recordings | Automatic recording with storage and playback |
| Call Transcription | Real-time speech-to-text transcription |
| Call Analytics | Sentiment analysis, talk time, silence time, interruptions |
| Call Queue & Transfer | Transfer calls to human agents with full context handoff |
| Audio Normalization | Audio processing and format standardization |

### AI Agent Intelligence (8 Features)

| Feature | Description |
|---------|-------------|
| Customer Memory | Persistent memory of customer facts across conversations |
| Zero Repetition | Tracks collected fields to never ask the same question twice |
| Loop Detection | Detects and breaks conversational loops automatically |
| Emotion Detection | Real-time emotion analysis adapting AI tone accordingly |
| Apology Intelligence | Context-aware, specific apologies (not generic) |
| Fact Verification | Verifies customer claims against database before responding |
| Warm Transfer Context | Full context package (summary, emotion, solutions tried) for human agents |
| Progress Tracking | Tracks conversation stage and completion percentage |

### Outbound Sales Campaign Features

| Feature | Description |
|---------|-------------|
| Campaign Management | Create, schedule, and manage call campaigns |
| Lead Scoring | AI-powered lead scoring with tier classification (Hot/Warm/Cold) |
| Buying Signal Detection | Automatic detection of purchase intent from conversation |
| Objection Handling | Template-based objection detection with suggested responses |
| DND/Compliance | Do-Not-Disturb registry, quiet hours, consent tracking |
| Callback Scheduling | Queue-based callback management with priority |
| Campaign Follow-Up Sequences | Automated multi-step follow-ups (SMS, Email, WhatsApp, Callback) |
| Contact CSV Import | Bulk contact upload with validation |

### Inbound Order Taking Features

| Feature | Description |
|---------|-------------|
| Voice Order Collection | AI-driven order collection with item confirmation |
| Customer Detection | Automatic customer identification by phone/email |
| Inventory Management | Stock tracking, movements, low-stock alerts |
| Delivery Zone Management | Zone-based delivery with fees and estimated times |
| Store Hours | Operating hours by day with holiday support |
| Quick Reorder | Suggest previous orders for fast reordering |

### Payment & Commerce

| Feature | Description |
|---------|-------------|
| Razorpay Integration | Full payment processing (UPI, cards, netbanking) |
| Payment Links | Generate and send payment links via SMS |
| Invoice Generation | Automatic PDF invoice creation |
| Payment Analytics | Revenue tracking, success rates, method breakdown |
| Order Management | Full lifecycle: pending > confirmed > preparing > delivered |

### Customer Engagement

| Feature | Description |
|---------|-------------|
| Loyalty & Rewards | Points system with tiers (Bronze/Silver/Gold/Platinum) |
| Reward Redemption | Customers redeem points for discounts, free items, delivery |
| Referral System | Referral codes with bonus points for both parties |
| SMS Notifications | Twilio-powered SMS for order updates, reminders |
| Complaint Management | Ticket system with SLA tracking, assignment, resolution |
| Customer Feedback | Post-resolution satisfaction scoring |

### Real-Time Features

| Feature | Description |
|---------|-------------|
| WebSocket Notifications | Real-time push for calls, orders, alerts |
| Live Call Dashboard | Active calls with sentiment indicators |
| Agent Availability | Real-time agent status tracking |
| Sentiment Alerts | Instant alerts when call sentiment drops |

### Data & Analytics

| Feature | Description |
|---------|-------------|
| Analytics Dashboard | Charts for calls, sentiment, performance |
| Order Analytics | Revenue, order frequency, top products |
| Campaign Analytics | Success rates, ROI, cost per conversion |
| Export System | CSV/PDF export of any data set |
| Global Search | Full-text search across all entities |
| Bulk Operations | Batch import/export with progress tracking |

### Knowledge & Content

| Feature | Description |
|---------|-------------|
| Knowledge Base | Searchable articles for AI agent context |
| Product Catalog | Product information with FAQs |
| Dynamic Prompt System | AI prompts enhanced with context from all services |
| Problem-Solving Engine | Proactive issue detection and root cause analysis |

---

## Technical Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | Latest | Build tool & dev server |
| Tailwind CSS | 3.x | Styling |
| Zustand | Latest | State management |
| TanStack Query | Latest | Server state & caching |
| React Router | 6.x | Client-side routing |
| Lucide React | Latest | Icon library |
| Recharts | Latest | Data visualization |
| Axios | 1.13 | HTTP client |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 | Runtime |
| Express | 5.2 | HTTP framework |
| TypeScript | 5.9 | Type safety |
| Prisma | 5.22 | ORM |
| SQLite | Latest | Development database |
| PostgreSQL | 15 | Production database |
| Winston | 3.x | Logging |
| Zod | 4.x | Runtime validation |
| Jest | 30.x | Testing |
| ws | 8.18 | WebSocket server |

### Third-Party Services
| Service | Purpose |
|---------|---------|
| Twilio | Voice calls, SMS, WhatsApp |
| OpenAI Realtime API | AI conversation engine |
| Razorpay | Payment processing (India) |
| Nodemailer | Email delivery |
| Redis (optional) | Caching & rate limiting |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| Docker Compose | Multi-service orchestration |
| Nginx | Reverse proxy, static serving |
| PostgreSQL | Production database |

---

## Architecture Overview

### System Design

```
                    +------------------+
                    |   Nginx (Port 80)|
                    |   Static Files   |
                    |   API Proxy      |
                    |   WS Proxy       |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+         +----------v---------+
     | Frontend (React) |         | Backend (Express)   |
     | Vite Build       |         | Port 3000           |
     | SPA Router       |         |                     |
     +---------+--------+         | +--- Routes (50+)   |
               |                  | +--- Services (52)  |
               | API Calls        | +--- Middleware (8)  |
               +--------->        | +--- WebSocket /ws  |
                                  | +--- Twilio /streams|
                                  +---+--------+--------+
                                      |        |
                              +-------v--+  +--v--------+
                              |PostgreSQL |  | Twilio    |
                              | (Prisma)  |  | OpenAI    |
                              | 80+ Models|  | Razorpay  |
                              +-----------+  +-----------+
```

### Key Technical Decisions

1. **Express 5**: Latest stable version with native async error handling
2. **Prisma ORM**: Type-safe database access with automatic migrations
3. **SQLite dev / PostgreSQL prod**: Zero-config development, scalable production
4. **WebSocket for real-time**: Native ws library for low-overhead push notifications
5. **Service-oriented backend**: Each business domain has a dedicated service class
6. **Repository pattern**: Database operations abstracted through repository classes
7. **React Query for server state**: Automatic caching, refetching, and cache invalidation
8. **JWT + Refresh tokens**: Secure stateless authentication with token rotation

### Scalability Considerations

- **Stateless backend**: Can run multiple instances behind a load balancer
- **Redis support**: Optional Redis for distributed rate limiting and caching
- **PostgreSQL**: Supports millions of rows with proper indexing
- **Docker deployment**: Easy horizontal scaling with Docker Swarm or Kubernetes
- **WebSocket channels**: Pub/sub pattern allows selective notification routing
- **Bulk operations**: Background processing for large data operations

---

## Security & Performance

### Security Measures

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT with 15-minute access tokens + 7-day refresh tokens |
| Password Hashing | bcrypt with configurable rounds (default 12) |
| Input Sanitization | DOMPurify-based sanitization on all inputs |
| CORS | Strict origin whitelist with credential support |
| Helmet | Security headers (CSP, HSTS, X-Frame-Options) |
| Rate Limiting | Per-endpoint limits (100 req/min general, 10/min auth) |
| RBAC | Role-based access control per team |
| Webhook Validation | Twilio signature verification |
| SQL Injection Prevention | Prisma parameterized queries |
| XSS Prevention | Input sanitization + Content Security Policy |
| Account Lockout | 5 failed attempts triggers 15-minute lockout |
| Audit Trail | Every significant action logged with IP and user agent |

### Performance Optimizations

| Optimization | Details |
|-------------|---------|
| Nginx gzip | Compression for JS, CSS, JSON responses |
| Static asset caching | 1-year immutable cache for versioned assets |
| Database indexing | Strategic indexes on 80+ columns |
| React Query caching | Client-side data caching with smart invalidation |
| Lazy loading | Route-level code splitting |
| Docker multi-stage builds | Minimal production images |
| Connection pooling | Prisma connection pooling for PostgreSQL |
| Redis caching | Optional in-memory cache layer |

### Data Protection

- All passwords hashed with bcrypt
- JWT secrets minimum 32 characters, auto-generated in development
- API keys encrypted at rest
- Recording files stored server-side with access control
- PII accessible only within team scope
- GDPR-compatible consent tracking for contact data

---

## Deployment Status

### Current State: **Production-Ready**

- TypeScript: 0 errors (backend + frontend)
- Frontend build: Successful (466 KB gzipped)
- Backend build: Successful
- Database: SQLite (dev), PostgreSQL (production via Docker)
- Docker: Configured and ready

### Deployment Options

**Option 1: Docker Compose (Recommended)**
```bash
# Set environment variables
cp .env.example .env
# Edit .env with production values

# Start all services
docker-compose up -d
```

**Option 2: Manual Deployment**
```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npm run build
npm start

# Frontend
cd frontend
npm install
npm run build
# Serve dist/ with nginx or any static host
```

### Access URLs
- Frontend: `http://localhost:80` (Docker) or `http://localhost:5173` (dev)
- Backend API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000/ws`
- Health Check: `http://localhost:3000/health`
- Database UI: `npx prisma studio` (dev only)
- Demo Login: `demo@example.com` / `demo123`

### Deployment Requirements

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| Node.js | 18+ | 20 LTS |
| RAM | 512 MB | 2 GB |
| Storage | 5 GB | 20 GB |
| CPU | 1 core | 2+ cores |
| Database | SQLite | PostgreSQL 15+ |

### Environment Variables Required

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Database connection string |
| JWT_SECRET | Yes | 64+ char secret for tokens |
| TWILIO_ACCOUNT_SID | Yes | Twilio credentials |
| TWILIO_AUTH_TOKEN | Yes | Twilio credentials |
| TWILIO_PHONE_NUMBER | Yes | Twilio phone number |
| OPENAI_API_KEY | Yes | OpenAI API key |
| RAZORPAY_KEY_ID | Optional | For payment processing |
| SMTP_HOST | Optional | For email notifications |
| REDIS_URL | Optional | For caching & rate limiting |

---

## Database Schema

**Total Models: 80+**

Core entities: User, Team, Agent, Campaign, Contact, Call, Order, Customer, Payment
AI features: CustomerMemory, ConversationState, TransferContext, EmotionTemplate, FactVerification
Engagement: LoyaltyProgram, Reward, Complaint, SmsTemplate, FollowUpSequence
Compliance: DNDRegistry, ContactConsent, ComplianceLog

**Migrations:** Managed via Prisma Migrate with full history

---

## API Surface

**67 route groups** with 200+ individual endpoints covering:
- Authentication & user management
- Team & agent operations
- Call management & monitoring
- Campaign & lead operations
- Order & payment processing
- Knowledge base & search
- Analytics & reporting
- Real-time notifications
- AI agent configuration
- Compliance & audit

---

## Testing

**20 test files** covering:
- Service unit tests (call analytics, order service, payment service, storage)
- Route integration tests (analytics, calls, orders, payments, health, status)
- Repository tests (call, order, payment repositories)
- Utility tests (audio normalizer)

Framework: Jest with TypeScript (ts-jest)

---

## Future Enhancement Opportunities

### Near-Term
- Multi-language support for AI conversations (Hindi, Tamil, etc.)
- Best time to call ML model based on historical contact data
- A/B script testing for campaigns
- Advanced analytics dashboards with custom date ranges
- Delivery partner integration (Dunzo, Swiggy delivery APIs)

### Medium-Term
- Menu recommendation engine based on customer history
- Voice biometric authentication
- Predictive call routing based on customer profile
- WhatsApp Business API full integration
- Mobile app for agents

### Long-Term
- Multi-channel unified inbox (voice + chat + email + WhatsApp)
- Self-learning AI that improves from successful calls
- Custom voice cloning for brand-specific AI agents
- Real-time translation for cross-language calls
- Marketplace for AI agent templates

---

## File Structure

```
dashboard/
+-- backend/
|   +-- prisma/
|   |   +-- schema.prisma          # 1700+ line database schema
|   |   +-- migrations/            # Database migration history
|   +-- src/
|   |   +-- config/env.ts          # Zod-validated environment config
|   |   +-- db/                    # Prisma client + 10 repositories
|   |   +-- middleware/             # 8 middleware (auth, RBAC, sanitizer, etc.)
|   |   +-- routes/                # 50 route files
|   |   +-- services/              # 52 service files
|   |   +-- utils/                 # Logger, audio normalizer
|   |   +-- scripts/               # Seed, test scripts
|   |   +-- app.ts                 # Express app configuration
|   |   +-- server.ts              # HTTP + WebSocket server
|   +-- Dockerfile                 # Multi-stage production build
|   +-- package.json
+-- frontend/
|   +-- src/
|   |   +-- api/                   # 18 API hook files (React Query)
|   |   +-- components/            # Reusable UI components
|   |   +-- hooks/                 # WebSocket, custom hooks
|   |   +-- pages/                 # 27 page components
|   |   +-- router/                # Protected route configuration
|   |   +-- store/                 # Zustand auth store
|   |   +-- services/              # API service functions
|   +-- Dockerfile                 # Nginx production build
|   +-- nginx.conf                 # Nginx configuration
|   +-- package.json
+-- docker-compose.yml             # Full stack orchestration
+-- CLAUDE.md                      # Development context
+-- PROJECT_SUMMARY.md             # This document
```

---

*Document generated: February 2026*
*Platform Status: Production-Ready*
