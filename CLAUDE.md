# Voice AI Call Center Dashboard - Project Context

## Project Overview

**Product**: Voice AI Call Center Dashboard for Oolix.in
**Purpose**: AI-powered voice call center platform with two primary use cases:
1. **Outbound Sales Campaigns** (like Policybazaar insurance calls)
2. **Inbound Order Taking** (like Pizza delivery)

## Tech Stack

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS for styling
- Zustand for state management
- React Query (TanStack Query) for API data
- React Router for navigation
- Location: `/frontend`

### Backend
- Node.js + Express 5 + TypeScript
- Prisma ORM 5.22.0
- SQLite (development) / PostgreSQL (production)
- JWT authentication with refresh tokens
- Location: `/backend`

### Integrations
- **Twilio**: Voice calls, SMS
- **OpenAI Realtime API**: AI conversations
- **Razorpay**: Payments (India)

## Environment Setup

### Backend (.env)
```env
DATABASE_URL=file:./dev.db
JWT_SECRET=<your-secret>
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
OPENAI_API_KEY=<your-key>
COMPANY_NAME=Oolix.in
```

### Running Locally
```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev  # Port 3000

# Frontend
cd frontend
npm install
npm run dev  # Port 5173
```

---

## Implementation Status

### Phase 1: Critical Features (COMPLETED)

#### For Outbound Sales Campaigns
| Feature | Status | Files |
|---------|--------|-------|
| Lead Scoring System | ✅ Done | `leadScoringService.ts`, `leads.ts` route, `Leads.tsx` page |
| Objection Handling | ✅ Done | `objectionService.ts`, `objections.ts` route |
| DND/Compliance | ✅ Done | `complianceService.ts`, `compliance.ts` route |
| Callback Scheduling | ✅ Done | `callbackService.ts`, `callbacks.ts` route, `Callbacks.tsx` page |

#### For Inbound Order Taking
| Feature | Status | Files |
|---------|--------|-------|
| Inventory System | ✅ Done | `inventoryService.ts`, `inventory.ts` route, `Inventory.tsx` page |
| Delivery Zones | ✅ Done | `deliveryZoneService.ts`, `store.ts` route, `StoreSettings.tsx` page |
| Store Hours | ✅ Done | Part of `deliveryZoneService.ts` |
| Customer Detection | ✅ Done | `customerDetectionService.ts`, `store.ts` route |

### Database Models Added (Prisma Schema)
```
Contact          - Extended with leadScore, leadTier, buyingSignals, etc.
CallLog          - Extended with sentimentScore, wasEscalated, objections
Product          - Extended with sku, stockQuantity, reorderLevel, etc.
CallObjection    - NEW: Objection tracking per call
ObjectionTemplate - NEW: Response templates for objections
DNDRegistry      - NEW: Do-Not-Disturb phone registry
ContactConsent   - NEW: Consent tracking per contact
ComplianceLog    - NEW: Compliance check audit log
CallbackSchedule - NEW: Scheduled callback queue
InventoryMovement - NEW: Stock movement history
StoreInfo        - NEW: Store configuration
DeliveryZone     - NEW: Delivery area definitions
```

### Backend Services Created
```
backend/src/services/
├── leadScoringService.ts      # Lead scoring, tier management, buying signals
├── objectionService.ts        # Objection detection, templates, analytics
├── complianceService.ts       # DND, consent, quiet hours, compliance logs
├── callbackService.ts         # Callback scheduling, queue processing
├── inventoryService.ts        # Stock management, movements, alerts
├── deliveryZoneService.ts     # Zones, store hours, delivery checks
└── customerDetectionService.ts # Customer lookup, reorder suggestions
```

### API Routes Added
```
/api/leads          - Lead scoring endpoints
/api/objections     - Objection handling endpoints
/api/compliance     - DND/consent/compliance endpoints
/api/callbacks      - Callback scheduling endpoints
/api/inventory      - Stock management endpoints
/api/store          - Store info, zones, customer detection
```

### Frontend Pages Added
```
frontend/src/pages/
├── Leads.tsx          # Lead management with tier filtering
├── Callbacks.tsx      # Callback queue management
├── Inventory.tsx      # Stock management
└── StoreSettings.tsx  # Store config, hours, delivery zones
```

### Frontend API Hooks Added
```
frontend/src/api/
├── leads.ts      # useHotLeads, useLeadScore, useLeadAnalytics, etc.
├── callbacks.ts  # useCallbacks, useScheduleCallback, etc.
├── inventory.ts  # useInventory, useLowStockProducts, etc.
└── store.ts      # useStoreInfo, useDeliveryZones, useCustomerInsights, etc.
```

---

## Phase 2: Important Features

### For Outbound Campaigns
| Feature | Status | Files |
|---------|--------|-------|
| Campaign Follow-up Sequences | ✅ Done | `followUpSequenceService.ts`, `webhooks.ts` route |
| WhatsApp Integration | ✅ Done | Integrated in `followUpSequenceService.ts` via Twilio |
| Multi-Language Support | ⬚ TODO | |
| Best Time to Call ML Model | ⬚ TODO | |
| Conversion Tracking (full funnel) | ⬚ TODO | |

### For Inbound Orders
| Feature | Status | Files |
|---------|--------|-------|
| Loyalty/Rewards System | ✅ Done | `loyaltyService.ts`, `rewardsService.ts`, routes |
| Complaint Management System | ✅ Done | `complaintService.ts`, `complaints.ts` route |
| Delivery Partner Integration | ⬚ TODO | |
| Menu Recommendations | ⬚ TODO | |
| Quick Reorder Flow | ⬚ TODO | |

### General
| Feature | Status | Files |
|---------|--------|-------|
| Real-time Notifications (WebSocket) | ✅ Done | `notificationService.ts`, `notifications.ts` route |
| SMS Notifications for Orders | ✅ Done | `smsService.ts`, `sms.ts` route |
| A/B Script Testing | ⬚ TODO | |
| Advanced Analytics Dashboard | ⬚ TODO | |

### Phase 2 Database Models Added
```
FollowUpSequence     - Multi-step follow-up automation
FollowUpStep         - Individual steps (SMS, Email, WhatsApp, Callback)
FollowUpExecution    - Execution tracking per step
LoyaltyProgram       - Points-based loyalty tiers
LoyaltyTransaction   - Points earn/redeem history
Reward               - Redeemable rewards catalog
RewardRedemption     - Redemption tracking
Referral             - Referral codes and bonuses
SmsTemplate          - SMS message templates per team
SmsLog               - SMS delivery tracking
Complaint            - Customer complaint tickets with SLA
ComplaintCategory    - Complaint categorization
ComplaintComment     - Internal notes on complaints
ComplaintFeedback    - Post-resolution satisfaction scores
```

### Phase 2 Backend Services Added
```
backend/src/services/
├── followUpSequenceService.ts  # Multi-step follow-ups (SMS, Email, WhatsApp, Callback)
├── loyaltyService.ts           # Points, tiers, referrals
├── rewardsService.ts           # Reward catalog, redemption
├── smsService.ts               # Twilio SMS with templates
├── complaintService.ts         # Ticket management, SLA, assignment, resolution
└── notificationService.ts      # WebSocket real-time push notifications
```

### Phase 2 API Routes Added
```
/api/sms             - SMS sending, templates, logs
/api/complaints      - Complaint CRUD, SLA, categories, feedback
/api/notifications   - WebSocket notification management
/api/webhooks        - Follow-up sequence webhooks
```

### Phase 2 Frontend API Hooks Added
```
frontend/src/api/
├── sms.ts           # useSendSms, useSmsTemplates, useSmsLogs, etc.
└── complaints.ts    # useComplaints, useCreateComplaint, useComplaintStats, etc.
```

---

## Key Files Reference

### Configuration
- `backend/prisma/schema.prisma` - Database schema
- `backend/src/app.ts` - Express app with route registration
- `frontend/src/router/index.tsx` - Frontend routing
- `frontend/src/components/Sidebar.tsx` - Navigation

### Core Services (Pre-existing)
- `campaignService.ts` - Campaign management
- `orderService.ts` - Order management
- `orderCollectionService.ts` - Voice order collection flow
- `paymentService.ts` - Razorpay integration
- `paymentLinkService.ts` - Payment link generation & SMS delivery
- `notificationService.ts` - WebSocket push notifications
- `queueService.ts` - Call queue/transfer management
- `searchService.ts` - Global full-text search
- `exportService.ts` - CSV/PDF data export
- `bulkOperationsService.ts` - Batch import/export

### Documentation
- `PROJECT_SUMMARY.md` - Complete project summary with architecture, features, deployment
- `USE_CASE_FEATURES.md` - Feature gap analysis (HAVE/NEED)
- `TTS_STT_ROADMAP.md` - Separate TTS-STT product roadmap
- `PRODUCTION_READY.md` - Production readiness checklist

---

## Common Commands

```bash
# Database
cd backend && npx prisma migrate dev --name <name>  # Create migration
cd backend && npx prisma generate                    # Regenerate client
cd backend && npx prisma studio                      # Database GUI

# Development
cd backend && npm run dev     # Start backend
cd frontend && npm run dev    # Start frontend

# Build
cd backend && npm run build
cd frontend && npm run build

# Production (Docker)
docker-compose up -d          # Start all services
docker-compose logs -f        # View logs
docker-compose down           # Stop all services

# Testing
cd backend && npm test        # Run backend tests
```

---

## Notes

1. **Prisma Generate Issue**: If you get EPERM errors during `prisma generate`, stop the running server first.

2. **Authentication**: All new API routes use `authMiddleware` for protection.

3. **SQLite vs PostgreSQL**: Development uses SQLite (`file:./dev.db`), production should use PostgreSQL.

4. **TTS-STT Features**: Language detection, emotion analysis, voice biometrics are NOT part of this product - they're in a separate TTS-STT service (see `TTS_STT_ROADMAP.md`).

5. **Demo Credentials**: Login page defaults to `demo@example.com` / `demo123`.

---

*Last Updated: February 2026*
*Phase 1 & Phase 2 Implementation Complete*
*Production-Ready: 0 TypeScript errors, Docker configured*
