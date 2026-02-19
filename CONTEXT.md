# Voice AI Dashboard — Full Project Context
*Last Updated: February 2026*

---

## 1. Product Overview

**Product**: Voice AI Call Center Dashboard for **Oolix.in**
**Purpose**: AI-powered voice call center platform with two primary use cases:
1. **Outbound Sales Campaigns** — AI agent cold-calls leads (e.g., insurance upsell)
2. **Inbound Order Taking** — AI agent answers calls and takes food orders (e.g., pizza delivery)

The AI speaks to callers over the phone using OpenAI Realtime API and Twilio Media Streams.

---

## 2. Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| ORM | Prisma 5.22.0 |
| Database (dev) | SQLite (`file:./dev.db`) |
| Database (prod) | PostgreSQL (via `DATABASE_URL` env var) |
| Auth | JWT access tokens (15 min) + refresh tokens (7 days) |
| Cache | Redis |
| Location | `/backend` |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | Zustand (`authStore`) |
| Data fetching | TanStack Query (React Query) |
| Routing | React Router |
| HTTP client | Axios at `frontend/src/api/client.ts` |
| Location | `/frontend` |

### External Integrations
| Service | Purpose |
|---------|---------|
| **Twilio** | Voice calls (inbound/outbound), SMS, Media Streams (WebSocket audio) |
| **OpenAI Realtime API** | AI voice conversations (streaming PCM16 audio, VAD) |
| **Razorpay** | Payments (India) |

---

## 3. Infrastructure & Deployment (Production)

### Server
- **Host**: `api.oolix.in` (SSL via Let's Encrypt)
- **IP**: `136.109.131.37`
- **Docker Compose** orchestrates 4 containers:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `voice_ai_backend` | custom build | 3000 | Express API + WebSocket server |
| `voice_ai_frontend` | Nginx | 80, 443 | React SPA + reverse proxy |
| `voice_ai_redis` | redis:7-alpine | 6379 | Cache |
| `voice_ai_db` | postgres | 5432 | Production database |

### Nginx Configuration
File: `nginx/default.conf` (mounted into frontend container)

Key proxy rules:
- `HTTP :80` → redirect to HTTPS
- `HTTPS :443` with Let's Encrypt certs at `/etc/letsencrypt/live/api.oolix.in/`
- `/api/*` → `http://backend:3000/api` (REST API)
- `/ws` → `http://backend:3000/ws` with WebSocket upgrade headers (live notifications)
- `/streams` → `http://backend:3000/streams` with WebSocket upgrade headers (Twilio audio)
- `/*` → serve React SPA (`try_files $uri $uri/ /index.html`)

### Environment Variables (Server `.env`)
```env
VITE_API_BASE_URL=/api          # Relative URL — goes through Nginx (NOT http://ip:3000)
ALLOWED_ORIGINS=https://api.oolix.in,https://oolix.in,https://136.109.131.37
DATABASE_URL=postgresql://...
JWT_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OPENAI_API_KEY=...
PUBLIC_SERVER_URL=https://api.oolix.in
BASE_URL=https://api.oolix.in
```

**Critical**: `VITE_API_BASE_URL` must be `/api` (relative), NOT `http://ip:3000/api`. The latter causes Mixed Content errors when served over HTTPS.

**Critical**: `ALLOWED_ORIGINS` must be a single line. Two lines = second overwrites first, causing CORS failures.

### Deployment Commands
```bash
cd ~/dashboard
git pull
docker-compose up --build -d          # Rebuild and restart all
docker-compose up --build -d frontend  # Rebuild only frontend (Nginx/config changes)
docker-compose up --build -d backend   # Rebuild only backend (code changes)
docker-compose logs -f backend         # Watch backend logs
```

---

## 4. The Full Call Pipeline

```
Phone caller
    │
    ▼ PSTN
Twilio Voice
    │  POST /api/twilio/incoming-call  (TwiML response with <Connect><Stream>)
    ▼
Nginx  :443  /streams  →  Backend :3000
    │
    ▼  WebSocket (wss://)  Twilio Media Streams (μ-law 8kHz audio)
TwilioStreamService  (backend/src/services/twilioStream.ts)
    │
    ├─► AudioNormalizer.convertToOpenAIFormat()  μ-law 8kHz → PCM16 24kHz
    │
    ▼
OpenAIRealtimeService  (backend/src/services/openaiRealtime.ts)
    │  WebSocket to wss://api.openai.com/v1/realtime
    │  Model: gpt-4o-realtime-preview
    │  Server-side VAD (AI auto-detects speech end)
    │
    ├─► AI transcribes speech + detects language + generates response
    │
    ▼  PCM16 24kHz audio delta events
TwilioStreamService.sendAudio()
    │  Resample 24kHz → 8kHz, PCM16 → μ-law, 160-byte frames
    ▼
Twilio  →  Caller hears AI voice

Parallel:
CallManager  (backend/src/services/callManager.ts)
    ├─► Creates Call record in DB (via CallRepository)
    ├─► Saves audio chunks for recording
    └─► Saves transcript segments
```

### Key Timing Optimization
`openAIService.connect()` is called **before** `callManager.startCall()` so the OpenAI WebSocket handshake happens in parallel with DB initialization. This reduces AI greeting latency from ~4s to ~2-3s.

---

## 5. AI Behavior Configuration

### Language Handling (Fixed Feb 2026)
- **Default**: Always speak English
- **Switch rule**: Only switch if caller sends a FULL sentence in another language
- **Script detection**: Unicode ranges checked — Hindi (`\u0900-\u097F`), Tamil (`\u0B80-\u0BFF`), Telugu (`\u0C00-\u0C7F`), Kannada (`\u0C80-\u0CFF`), Malayalam (`\u0D00-\u0D7F`)
- **Language reinforcement**: Uses `session.update` (NOT `conversation.item.create` with role:'system' — that is silently ignored by OpenAI Realtime API)

### Prompt System
- File: `backend/src/services/promptService.ts`
- Loads team/campaign config from DB
- Returns system prompt used in `session.update` on OpenAI connect

---

## 6. Authentication Flow

1. `POST /api/auth/login` → returns `{ user, team: { id, name }, accessToken, refreshToken }`
2. Frontend `authStore` (Zustand) stores: `user`, `teamId` (from `team.id`), `accessToken`, `refreshToken`
3. Both `user` and `teamId` are **persisted** in localStorage
4. All API calls send `Authorization: Bearer <accessToken>` header via Axios interceptor
5. WebSocket connects with `?token=<accessToken>` query param

### Auth Store Location
`frontend/src/store/authStore.ts`

On registration/login, backend auto-creates a default Team for the user if none exists.

---

## 7. Backend Routes (Complete List)

### Core Voice
| Route | File | Purpose |
|-------|------|---------|
| `POST /api/twilio/incoming-call` | `twilio.ts` | TwiML webhook — returns `<Connect><Stream>` TwiML; looks up real teamId from DB |
| `POST /api/twilio/outbound-call` | `twilio.ts` | Initiate outbound call |
| `WS /streams` | `server.ts` → `twilioStream.ts` | Twilio Media Streams audio |
| `WS /ws` | `server.ts` → `websocketService.ts` | Real-time dashboard notifications |

### Calls
| Route | File | Notes |
|-------|------|-------|
| `GET /api/calls` | `calls.ts` | Paginated list with filters |
| `GET /api/calls/search` | `calls.ts` | Search (placed BEFORE `/:id` to avoid wildcard capture) |
| `GET /api/calls/:id` | `calls.ts` | Single call with mapped `recordingUrl`, `transcript`, `sentiment` |
| `GET /api/calls/:id/recording` | `calls.ts` | Stream audio file |
| `GET /api/calls/:id/transcript` | `calls.ts` | Transcript segments |
| `POST /api/calls/:id/notes` | `calls.ts` | Add notes |
| `POST /api/calls/:id/transfer` | `calls.ts` | Queue transfer request |
| `GET /api/calls/:id/transfer-history` | `calls.ts` | Transfer history |

### Campaigns & Contacts
| Route | File | Purpose |
|-------|------|---------|
| `GET /api/campaigns` | `campaigns.ts` | List campaigns by teamId |
| `POST /api/campaigns` | `campaigns.ts` | Create campaign |
| `GET /api/campaigns/:id` | `campaigns.ts` | Campaign details |
| `PUT /api/campaigns/:id` | `campaigns.ts` | Update |
| `DELETE /api/campaigns/:id` | `campaigns.ts` | Delete |
| `POST /api/campaigns/:id/pause` | `campaigns.ts` | Pause |
| `POST /api/campaigns/:id/resume` | `campaigns.ts` | Resume |
| `GET /api/campaigns/:id/contacts` | `campaigns.ts` | List contacts |
| `POST /api/campaigns/:id/contacts` | `campaigns.ts` | Add contacts manually (array of `{name, phone, email?}`) |
| `POST /api/campaigns/:id/contacts/import` | `campaigns.ts` | Import CSV |
| `GET /api/campaigns/:id/analytics` | `campaigns.ts` | Analytics |

### Orders & Payments
| Route | File | Notes |
|-------|------|-------|
| `GET /api/orders` | `orders.ts` | Accepts both `startDate`/`endDate` and `dateFrom`/`dateTo` |
| `POST /api/orders` | `orders.ts` | Create order |
| `GET /api/orders/:id` | `orders.ts` | |
| `PUT /api/orders/:id` | `orders.ts` | |
| `PATCH /api/orders/:id` | `orders.ts` | Both PUT and PATCH registered |
| `GET /api/payments` | `payments.ts` | |
| `POST /api/payments/:id/refund` | `payments.ts` | |
| `POST /api/payments/send-sms` | `payments.ts` | Placed BEFORE `/:id` routes |

### Users & Teams
| Route | File | Notes |
|-------|------|-------|
| `POST /api/auth/login` | `auth.ts` | Returns `team.id` in response |
| `POST /api/auth/register` | `auth.ts` | Auto-creates default team |
| `POST /api/auth/refresh` | `auth.ts` | |
| `GET /api/user/profile` | `user.ts` | |
| `PUT /api/user/profile` | `user.ts` | With multer avatar upload |
| `GET /api/user/api-keys` | `user.ts` | Returns scopes |
| `GET /api/teams/:id` | `teams.ts` | |
| `POST /api/teams/:id/members` | `teams.ts` | Accepts both `email` and `userId` |
| `GET /api/team-portal/:teamId/...` | `teamPortal.ts` | Accepts both `email` and `userId` |

### Analytics
| Route | File | Notes |
|-------|------|-------|
| `GET /api/analytics/overview` | `analytics.ts` | |
| `GET /api/analytics/calls` | `analytics.ts` | |
| `GET /api/analytics/bot` | `analytics.ts` | Bot performance (placed before `/:id`) |
| `GET /api/analytics/payment` | `analytics.ts` | Payment analytics |
| `GET /api/analytics/export` | `analytics.ts` | Export data |

### Live Calls
| Route | File | Notes |
|-------|------|-------|
| `GET /api/live-calls` | `liveCalls.ts` | Returns active calls for teamId |
| `GET /api/live-calls/stats` | `liveCalls.ts` | Placed BEFORE `/:id` |
| `POST /api/live-calls/:id/intervene` | `liveCalls.ts` | Agent intervention |

### Agents
| Route | File | Notes |
|-------|------|-------|
| `GET /api/agents` | `agents.ts` | ~26 sub-routes including stats, schedule, skills, etc. |
| `GET /api/agents/available` | `agents.ts` | Placed BEFORE `/:id` |

### Phase 1 & 2 Features
| Route | File | Purpose |
|-------|------|---------|
| `/api/leads` | `leads.ts` | Lead scoring, tiers, buying signals |
| `/api/objections` | `objections.ts` | Objection detection & templates |
| `/api/compliance` | `compliance.ts` | DND registry, consent, quiet hours |
| `/api/callbacks` | `callbacks.ts` | Callback scheduling & queue |
| `/api/inventory` | `inventory.ts` | Stock management, movements, alerts |
| `/api/store` | `store.ts` | Store info, delivery zones, customer detection |
| `/api/sms` | `sms.ts` | SMS templates, sending, logs |
| `/api/complaints` | `complaints.ts` | Ticket management, SLA, categories |
| `/api/notifications` | `notifications.ts` | WebSocket notification management |
| `/api/loyalty` | `loyalty.ts` | Points, tiers, referrals, rewards |
| `/api/search` | `search.ts` | Global full-text search |
| `/api/export` | `export.ts` | CSV/PDF data export |
| `/api/bulk` | `bulk.ts` | Batch import/export operations |
| `/api/webhooks` | `webhooks.ts` | Follow-up sequence webhooks |

---

## 8. Frontend Pages

| Page | Route | File |
|------|-------|------|
| Login | `/login` | `Login.tsx` |
| Register | `/register` | `Register.tsx` |
| Dashboard | `/dashboard` | `Dashboard.tsx` |
| Live Calls | `/dashboard/live-calls` | `LiveCalls.tsx` |
| Call Monitor | `/dashboard/call-monitor` | `CallMonitor.tsx` |
| Analytics | `/dashboard/analytics` | `Analytics.tsx` |
| Campaigns | `/dashboard/campaigns` | `Campaigns.tsx` |
| Campaign Detail | `/dashboard/campaigns/:id` | `CampaignDetail.tsx` |
| Orders | `/dashboard/orders` | `Orders.tsx` |
| Payments | `/dashboard/payments` | `Payments.tsx` |
| Payment Detail | `/dashboard/payments/:id` | `PaymentDetail.tsx` |
| Agents | `/dashboard/agents` | `Agents.tsx` |
| Agent Detail | `/dashboard/agents/:id` | `AgentDetail.tsx` |
| Knowledge Base | `/dashboard/knowledge` | `KnowledgeBase.tsx` |
| Leads | `/dashboard/leads` | `Leads.tsx` |
| Callbacks | `/dashboard/callbacks` | `Callbacks.tsx` |
| Inventory | `/dashboard/inventory` | `Inventory.tsx` |
| Store Settings | `/dashboard/store` | `StoreSettings.tsx` |
| Team | `/dashboard/team` | `Team.tsx` |
| Team Members | `/dashboard/team/members` | `TeamMembers.tsx` |
| Team Settings | `/dashboard/team/settings` | `TeamSettings.tsx` |
| Team Audit | `/dashboard/team/audit` | `TeamAudit.tsx` |
| Users | `/dashboard/users` | `Users.tsx` |
| User Profile | `/dashboard/profile` | `UserProfile.tsx` |
| Invoices | `/dashboard/invoices` | `Invoices.tsx` |
| Settings | `/dashboard/settings` | `Settings.tsx` |

---

## 9. Key Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/store/authStore.ts` | Zustand auth store — holds `user`, `teamId`, `accessToken`, `refreshToken` |
| `frontend/src/api/client.ts` | Axios instance — does NOT unwrap `.data`; returns raw AxiosResponse |
| `frontend/src/services/api.ts` | All API call functions |
| `frontend/src/types/index.ts` | All TypeScript types |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket hook — connects to `wss://host/ws?token=JWT` |
| `frontend/src/components/WebSocketProvider.tsx` | Global WebSocket context |
| `frontend/src/router/index.tsx` | All routes |
| `frontend/src/components/Sidebar.tsx` | Navigation sidebar |

---

## 10. Key Backend Files

| File | Purpose |
|------|---------|
| `backend/src/app.ts` | Express app — all route registration |
| `backend/src/server.ts` | HTTP server + WebSocket upgrade handler |
| `backend/src/services/openaiRealtime.ts` | OpenAI Realtime API WebSocket client |
| `backend/src/services/twilioStream.ts` | Twilio Media Streams handler |
| `backend/src/services/callManager.ts` | Call session lifecycle (create, audio, end) |
| `backend/src/services/promptService.ts` | AI system prompt builder |
| `backend/src/services/websocketService.ts` | Dashboard notification WebSocket server |
| `backend/src/db/repositories/callRepository.ts` | Call DB queries |
| `backend/src/utils/audioNormalizer.ts` | μ-law ↔ PCM16, 8kHz ↔ 24kHz conversion |
| `backend/prisma/schema.prisma` | Full database schema |
| `nginx/default.conf` | Production Nginx config (SSL + WebSocket proxy) |

---

## 11. Database Models

### Core
- `User` — accounts
- `Team` — organization unit; auto-created on register/first login
- `TeamMember` — user↔team membership with role
- `Call` — call records (`teamId` is nullable FK; never pass empty string — causes P2003)
- `CallRecording` — audio file path + format
- `CallTranscript` — individual speech segments (speaker, text, timestamps)
- `CallAnalytics` — sentiment, scores per call
- `Agent` — AI agent configurations
- `Campaign` — outbound/inbound campaign config
- `CampaignContact` — contacts for a campaign with call status

### Phase 1 Models
- `Contact` — extended with leadScore, leadTier, buyingSignals
- `CallObjection` / `ObjectionTemplate` — objection tracking & responses
- `DNDRegistry` / `ContactConsent` / `ComplianceLog` — DND & compliance
- `CallbackSchedule` — callback queue
- `Product` — inventory items with SKU, stock levels
- `InventoryMovement` — stock movement history
- `StoreInfo` / `DeliveryZone` — store config & delivery areas

### Phase 2 Models
- `FollowUpSequence` / `FollowUpStep` / `FollowUpExecution` — multi-step follow-ups
- `LoyaltyProgram` / `LoyaltyTransaction` / `Reward` / `RewardRedemption` / `Referral` — loyalty system
- `SmsTemplate` / `SmsLog` — SMS templates & delivery tracking
- `Complaint` / `ComplaintCategory` / `ComplaintComment` / `ComplaintFeedback` — complaint tickets

---

## 12. Bugs Fixed (Audit — Feb 2026)

### Route Ordering Fixes
Express `/:id` wildcard was catching named sub-routes. Fixed by placing specific routes BEFORE parameterized ones in:
`callbacks.ts`, `inventory.ts`, `complaints.ts`, `orders.ts`, `payments.ts`, `agents.ts`, `liveCalls.ts`, `analytics.ts`

### Field Name Mismatches
| File | Issue | Fix |
|------|-------|-----|
| `teams.ts`, `teamPortal.ts` | Frontend sends `email`, backend expected `userId` | Accept both |
| `orders.ts` | Frontend sends `dateFrom`/`dateTo`, backend expected `startDate`/`endDate` | Accept both |
| `orders.ts` | Frontend uses `PUT`, backend only registered `PATCH` | Register both |
| `payments.ts` | `send-sms` route placed after `/:id` | Moved before `/:id` |

### Missing Routes Added
- `orders.ts`: ~5 missing endpoints (search, bulk, stats)
- `payments.ts`: refund path fix, send-sms
- `agents.ts`: ~26 stubs (available, stats, schedule, skills, certifications, queue, etc.)
- `liveCalls.ts`: stats endpoint
- `analytics.ts`: bot, payment, export endpoints

### Other Fixes
- `user.ts`: multer avatar upload middleware, API key scopes field, parsed sessions
- `app.ts`: all new routes registered correctly

---

## 13. Production Bugs Fixed (Feb 2026)

### 1. FK Constraint Crash (`Call_teamId_fkey`)
**Symptom**: All incoming calls crashed with Prisma P2003 error. No AI voice.
**Root cause**: `'default-team'` hardcoded string passed as `teamId` — not a real UUID in the Team table.
**Fix**:
- `twilio.ts` → `incoming-call` handler now looks up first real team: `prisma.team.findFirst()`
- `callRepository.ts` → guards: `data.teamId || undefined` (empty string → undefined → no FK reference)

### 2. AI Responds in Wrong Language (Hindi/Malayalam instead of English)
**Symptom**: AI greeted in English but then responded to English in Hindi/Malayalam.
**Root causes**:
1. `reinforceLanguageContext()` used `conversation.item.create` with `role: 'system'` — **invalid** in OpenAI Realtime API, silently ignored.
2. System prompt said "match whatever language" instead of defaulting to English.
3. Server-side VAD sends response before transcription arrives, so language detection happened on partial text.
**Fixes**:
- `openaiRealtime.ts` → Changed `reinforceLanguageContext()` to use `session.update` (the correct approach)
- `promptService.ts` → Language section now says "DEFAULT LANGUAGE: English. Only switch on full sentence in another language."
- `openaiRealtime.ts` → Added Tamil/Telugu/Kannada/Malayalam Unicode ranges to `detectLanguage()`

### 3. AI Greeting Delay (~4 seconds)
**Root cause**: `openAIService.connect()` was called after 2 seconds of DB + AI agent initialization.
**Fix**: `twilioStream.ts` → `openAIService.connect()` moved to the very start of the `'start'` handler, runs **in parallel** with `callManager.startCall()`. Saves ~1.5-2s.

### 4. Mixed Content Error (HTTP API from HTTPS page)
**Root cause**: `VITE_API_BASE_URL=http://136.109.131.37:3000/api` was baked into the frontend build.
**Fix**: Changed to `VITE_API_BASE_URL=/api` (relative URL goes through Nginx). Rebuilt frontend container.

### 5. CORS Failures
**Root cause**: Two `ALLOWED_ORIGINS=...` lines in `.env` — Node reads only the last one.
**Fix**: Merged into single line: `ALLOWED_ORIGINS=https://api.oolix.in,https://oolix.in,https://136.109.131.37`

### 6. Recording / Transcript Not Showing in Dashboard
**Root cause**: Frontend `Call` interface expects flat fields (`recordingUrl: string`, `transcript: string`) but backend returned raw Prisma relations (`recordings[]`, `transcripts[]`, `analytics[]`).
**Fix**: `calls.ts` → Added `mapCallToFrontend()` helper:
- Maps `recordings[0].filePath` → `recordingUrl` (downloadable URL)
- Maps `transcripts[]` → joined `"Speaker: text\n..."` string
- Maps `analytics[0].sentiment` → `sentiment` string
- Applied to all GET endpoints: `/`, `/search`, `/:id`

### 7. Campaigns Not Loading (`teamId` hardcoded as `'team-1'`)
**Root cause**: `Campaigns.tsx` had `const teamId = 'team-1'` hardcoded.
**Fix**: `authStore.ts` now saves `teamId` from `team.id` in login response; `Campaigns.tsx` reads it from store.

### 8. Live Calls Wrong `teamId` (using user UUID instead of team UUID)
**Root cause**: `LiveCallsList.tsx` had `const teamId = user?.id || ''` — using the user's UUID as the team UUID.
**Fix**: Changed to `const { teamId } = useAuthStore()`.

### 9. Live Calls WebSocket Not Working
**Root cause**: `nginx/default.conf` was missing from the repository (the file the docker-compose volume-mounts). Without it, Nginx couldn't proxy WebSocket upgrades to `/ws`.
**Fix**: Created `nginx/default.conf` with proper WebSocket upgrade headers for `/ws` and `/streams`.

---

## 14. Campaign Contacts — Manual Phone Number Entry

Added in latest session. Users can now add phone numbers directly in the UI without uploading a CSV.

**UI**: Campaign Detail page → Contacts tab → "Add Contact" button
- Opens modal with rows of Name / Phone / Email fields
- Can add multiple rows with "+ Add another row"
- Submits to `POST /api/campaigns/:id/contacts` with array of contacts

**API function**: `addContacts(campaignId, contacts[])` in `frontend/src/services/api.ts`

**Backend endpoint** (pre-existing): `POST /api/campaigns/:id/contacts` accepts `{ contacts: [{ name, phone, email? }] }`

---

## 15. Common Patterns & Pitfalls

### Route Ordering (CRITICAL)
Always place specific routes BEFORE parameterized `/:id` routes:
```typescript
router.get('/search', handler);   // ✅ Before /:id
router.get('/stats', handler);    // ✅ Before /:id
router.get('/:id', handler);      // ⚠️ Wildcard — catches everything above if placed first
```

### TeamId (CRITICAL)
- `Call.teamId` in Prisma is `String?` (nullable FK)
- **Never** pass an empty string — it violates the FK constraint with Prisma error P2003
- Always guard: `data.teamId || undefined`
- Frontend gets real `teamId` from `useAuthStore().teamId` (not `user.id`)

### Axios Client Does NOT Unwrap
`frontend/src/api/client.ts` returns raw `AxiosResponse`. To get data: `response.data` (not `response`).

### OpenAI Realtime API Rules
- `conversation.item.create` with `role: 'system'` is **invalid** — silently ignored
- Use `session.update` to change instructions mid-call
- Server-side VAD responds before transcription is complete — don't rely on transcription for real-time decisions

### WebSocket URL
Frontend builds: `wss://host/ws?token=JWT` (uses `window.location.protocol` to pick `wss:` vs `ws:`)

---

## 16. Common Commands

```bash
# Development
cd backend && npm run dev      # Port 3000
cd frontend && npm run dev     # Port 5173

# Database
cd backend && npx prisma migrate dev --name <name>
cd backend && npx prisma generate
cd backend && npx prisma studio

# Production
git pull && docker-compose up --build -d
docker-compose logs -f backend
docker-compose logs -f frontend

# Check health
curl https://api.oolix.in/health
```

---

## 17. Demo Credentials
- Email: `demo@example.com`
- Password: `demo123`

---

*Phase 1 & Phase 2 complete. 0 TypeScript errors. Docker + SSL configured.*
