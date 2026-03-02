# Oolix Voice AI — Product & Competitive Document

**Platform:** AI-Powered Voice Call Center Dashboard
**Version:** 2.0 | March 2026
**Audience:** Sales, Product, and Leadership Teams

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Complete Feature List](#2-complete-feature-list)
   - 2.1 Voice AI & Call Engine
   - 2.2 Outbound Sales Campaigns
   - 2.3 Inbound Order Taking
   - 2.4 Customer Intelligence
   - 2.5 Loyalty & Rewards
   - 2.6 Compliance & Safety
   - 2.7 Payments & Billing
   - 2.8 Customer Support
   - 2.9 Analytics & Reporting
   - 2.10 Automation & Workflows
   - 2.11 Team & User Management
   - 2.12 Integrations & APIs
3. [What Makes Us Unique](#3-what-makes-us-unique)
4. [Why Choose Oolix Over Competitors](#4-why-choose-oolix-over-competitors)

---

## 1. Product Overview

Oolix is an **AI-powered voice call center platform** built for businesses in India that run phone-based operations — from outbound insurance and financial product sales to inbound food delivery order taking.

The platform replaces or augments human call center agents with a voice AI that:
- Speaks and listens in real time over standard phone calls
- Knows your products, menu, and policies before the call starts
- Remembers every customer and learns their preferences over time
- Handles objections, qualifies leads, collects orders, and processes payments
- Operates 24 × 7 without fatigue, inconsistency, or staffing costs

**Two core use cases, one platform:**

| Use Case | Example | What the AI does |
|---|---|---|
| **Outbound Sales** | Insurance, loans, SaaS | Calls leads, pitches products, handles objections, books callbacks |
| **Inbound Orders** | Food delivery, retail | Takes orders, upsells, manages loyalty points, confirms delivery |

---

## 2. Complete Feature List

---

### 2.1 Voice AI & Call Engine

The real-time voice pipeline is the core of Oolix. Every call passes through:

**Speech-to-Text (STT)**
- Silero VAD (Voice Activity Detection) — detects when the caller stops speaking with 400 ms silence threshold
- Whisper (local) or Groq Whisper API (cloud, sub-200 ms) for transcription
- Handles Indian English accents and code-switching (Hindi + English)
- 16 kHz PCM audio, μ-law encoding for Twilio compatibility

**Large Language Model (LLM)**
- Qwen / GPT-4o class models via any OpenAI-compatible endpoint (Groq, vLLM, OpenAI)
- Single LLM call detects caller emotion AND generates reply simultaneously — zero extra latency
- Receives a rich, DB-built system prompt before every call: store info, menu, campaign script, full customer history
- Qwen3 thinking-mode support (`<think>` blocks stripped before speaking)
- Keeps full conversation history for natural multi-turn dialogue

**Text-to-Speech (TTS)**
- Cartesia Sonic 3 — ultra-low-latency neural TTS
- Emotion-aware voice: when the caller is angry, Oolix responds calmly; when they're happy, it matches the energy
- μ-law 8 kHz output formatted in 20 ms Twilio frames for smooth audio
- Voice tone controlled per-turn via `__experimental_controls` emotion tags

**Auto-Greeting**
- AI speaks first the moment the call connects — no awkward silence
- Greeting is personalised using the caller's name and history if they're a returning customer

**Call Recording & Transcription**
- Every turn (user + AI) saved to the Transcript table in real time
- Full call recording stored for quality and compliance review
- Speaker identification: user vs. assistant clearly labelled

**Emotion Detection**
- Detected per turn in the same LLM call — price is zero extra API cost
- Emotions tracked: neutral, happy, excited, sad, frustrated, angry, fearful, confused, surprised
- Emotion history stored per call for post-call review and analytics
- Emotion-triggered response strategies: de-escalation, empathy, encouragement

**Conversation Intelligence**
- Loop detection: identifies and breaks repetitive conversation cycles
- Stage tracking: greeting → information collection → confirmation → closing
- Promises made during the call are stored for accountability
- Apology templates triggered by negative emotion history

**Post-Call Memory Extraction**
- After every call, an LLM scans the transcript and extracts structured customer facts
- Facts saved: name, dietary restrictions, allergies, favourite items, delivery preferences, and more
- Confidence-scored and tagged with source (`call_transcript`)
- Available immediately in the system prompt for the customer's next call

**Auto-Customer Creation**
- If a caller's number is not in the database, a `Customer` record is created automatically at call end
- Next call from the same number is treated as a returning customer

---

### 2.2 Outbound Sales Campaigns

**Campaign Management**
- Create campaigns with name, description, target audience, script, and goal
- Set start/end dates, daily call limits, and retry logic (attempt count + delay)
- Assign contact lists to campaigns
- Activate, pause, or stop campaigns in real time

**Lead Scoring & Qualification**
- Automatic lead score (0–100) calculated from call behaviour:
  - Questions asked, objections raised, time spent, sentiment
  - Recency of last contact, engagement history
- Lead tiers: Hot, Warm, Cold, Unknown
- Buying signal detection: high intent, medium intent, low intent, negative
- Preferred call time and timezone tracking

**Objection Handling**
- Objection detected in real time during the call
- Categorised and matched to pre-built response templates
- Success rate tracked per objection type
- Analytics: which objections are most common, which templates win

**Callback Scheduling**
- AI offers callbacks when callers are not ready
- Callbacks scheduled with timezone awareness and preferred time
- Callback queue processed automatically
- Max retry attempts, completion, and failure tracking

**DND & Compliance**
- Do-Not-Call (DNC) registry checked before every outbound call
- Quiet hours enforced by timezone
- Consent recorded with method, timestamp, and expiry
- Full compliance audit log for regulatory review

**Follow-Up Sequences**
- Multi-step automation: SMS → WhatsApp → Callback → Email
- Triggers: campaign completion, missed call, qualified lead
- Configurable delays between steps
- Skip-if-already-contacted logic, cooldown periods, max execution limits

**Campaign Analytics**
- Success rate, conversion rate, cost per lead
- ROI calculation
- Lead source analysis
- Campaign performance over time

---

### 2.3 Inbound Order Taking

**Order Collection Flow**
- AI takes the full order over the phone: items, quantity, special instructions
- Upsells and cross-sells based on menu and customer history
- Confirms full order (items, address, payment method) before ending call
- Handles reorders: "Same as last time?" with confirmation

**Menu Intelligence**
- Full product catalogue loaded into AI's context before every call
- Products grouped by category, with prices and descriptions
- Out-of-stock items excluded automatically
- Dietary restrictions and allergies respected — AI never suggests restricted items

**Store Configuration**
- Store name, address, phone, operating hours, timezone
- Delivery enabled/disabled toggle
- Minimum order amount, average prep time
- Multiple delivery zones: fee, estimated time, postal code mapping

**Customer Detection**
- Caller's phone number looked up in real time
- Returning customers greeted by name with their history ready
- New callers auto-registered for future personalisation
- VIP / loyalty tier status surfaced during the call

**Order Management**
- Status tracking: pending → confirmed → preparing → ready → delivered → cancelled
- Notes and special instructions per order
- Linked to the call, customer, and campaign for full traceability
- Cancellation reason tracked

**Inventory Management**
- Real-time stock quantity per product
- Low-stock and out-of-stock alerts
- Reorder level configuration
- Stock movement history: sales, returns, manual adjustments
- Inventory value and statistics dashboard

---

### 2.4 Customer Intelligence

**Customer Profiles**
- Phone, email, address, name
- Full order history with items, amounts, dates, and delivery addresses
- Complaint history, payment history, loyalty status
- AI-learned memories (dietary preferences, favourite items, delivery notes)

**Customer Memory System**
- Facts extracted from every call transcript by an LLM
- Stored with confidence score and source label
- Expires or updates as new information arrives
- Surfaced in Qwen's system prompt on the customer's next call — automatically

**Customer Preferences**
- Favourite items, dietary restrictions, allergies, delivery notes
- Set manually by agents or learned automatically from conversations

**Order History**
- Last 5 orders shown in AI's context for reorder suggestions
- Order dates, items, amounts, delivery addresses, and status
- One-click reorder capability

**Customer Insights & Analytics**
- VIP and repeat customer identification
- Lifetime value tracking
- Preferred product categories
- Order frequency and recency

---

### 2.5 Loyalty & Rewards

**Loyalty Programme**
- Tiered programme (e.g. Silver, Gold, Platinum) with configurable benefits
- Points earned per ₹ spent, with multipliers per tier
- Points expiry policies
- Benefits per tier: free delivery, priority support, birthday bonuses, early access

**Rewards Catalogue**
- Rewards: discount %, flat discount, free item, free delivery, bonus points
- Constraints: minimum order, max redemptions, date validity, max discount cap
- Redemption tracking and history

**Referral System**
- Unique referral codes per customer
- Referral bonus points for referrer and referee
- Referral count and analytics

**Loyalty Analytics**
- Points earned/redeemed/outstanding
- Tier distribution
- Lifetime value by tier
- Next-tier progression tracking

---

### 2.6 Compliance & Safety

**DNC / DND Registry**
- Full Do-Not-Call database management
- Number lookup before every outbound call
- Import from regulatory lists
- Manual additions by agents

**Consent Management**
- Consent recorded per contact: method, timestamp, expiry, consent text
- Consent revocation handling
- Consent audit log

**Quiet Hours**
- Configurable by timezone and geography
- Enforced automatically — no calls outside permitted hours

**Compliance Audit Log**
- Every compliance check logged: check type, result, action taken
- Regulatory-ready export

---

### 2.7 Payments & Billing

**Razorpay Integration**
- Card, UPI, net banking, wallet, and Cash on Delivery
- Payment links sent via SMS during or after the call
- QR code generation for in-store payments

**Payment Management**
- Status: initiated, completed, failed, refunded
- Partial and full refunds
- Transaction ID and gateway response stored
- Payment metadata per order

**Invoice Generation**
- Auto-generated PDF invoices per order
- Unique invoice numbers
- Email and SMS delivery
- Invoice status tracking

**Fraud Detection**
- Risk score (0–100) per transaction
- Signals: payment method validation, IP address, device fingerprint, velocity checks, unusual amounts
- Risk levels: Low / Medium / High with explanations

**Payment Analytics**
- Revenue by period, method, and campaign
- Success and failure rates
- Average order value
- Refund rate and reasons

---

### 2.8 Customer Support

**Complaint Management**
- Complaint tickets with unique ticket numbers
- Priority levels: Low, Medium, High, Critical
- Status: Open → In Progress → Resolved → Closed
- SLA deadlines with breach detection and alerts
- Assignment to agents
- Compensation tracking
- Customer satisfaction rating post-resolution
- Internal notes and comment threads
- Attachment support

**Complaint Analytics**
- Open/closed counts and resolution times
- SLA compliance rate
- Category breakdown
- Agent performance on complaints

**SMS Notifications**
- Order confirmed, payment received, delivery update, callback scheduled
- Template-based with variable personalisation
- Delivery status tracking via Twilio
- Bulk and scheduled SMS

**Real-Time Notifications**
- WebSocket push to dashboards: new call, sentiment alert, transfer, order update, payment event
- User-configurable notification preferences

---

### 2.9 Analytics & Reporting

**Call Analytics**
- Total calls, completed, failed, average duration, total talk time
- Talk time %, silence %, interruptions, latency
- Hourly, daily, weekly timeseries views
- Sentiment trends over time
- Emotion history per call

**Campaign Analytics**
- Conversion rates, ROI, cost per lead
- A/B comparison between scripts
- Lead tier distribution per campaign

**Revenue Dashboard**
- Revenue by period, product category, and delivery zone
- Payment method distribution
- Order volume trends

**Inventory Reports**
- Low stock alerts
- Stock movement history
- Inventory value by product and category

**Agent Performance**
- Call volume per agent
- Resolution rates, escalation rates
- Sentiment handled
- Activity logs

**Data Export**
- CSV and PDF export for all major data types
- Filter-based custom exports
- Bulk export jobs with progress tracking

---

### 2.10 Automation & Workflows

**Follow-Up Sequences** — automated multi-channel outreach after a call:
- SMS → WhatsApp → Callback → Email chains
- Configurable delays, skip conditions, cooldown periods

**Callback Queue Automation** — scheduled callbacks processed without human intervention

**Auto-Memory Extraction** — post-call LLM analysis of transcripts to learn customer facts

**Auto-Customer Registration** — new callers saved automatically at call end

**Inventory Alerts** — low-stock triggers for restocking workflows

**SLA Alerts** — complaint breach notifications to supervisors

**Webhook Events** — 10+ event types pushed to external systems on call, order, payment, and customer events

---

### 2.11 Team & User Management

**Multi-Team Architecture**
- Full data isolation between teams
- Team-scoped products, agents, customers, campaigns, and analytics

**Role-Based Access Control**
- Roles: Admin, Manager, Agent, Viewer
- Granular permissions per role

**User Management**
- Registration, login, profile, avatar
- Password reset, session management, multi-device login

**Two-Factor Authentication (2FA)**
- TOTP-based (Google Authenticator compatible)
- QR code setup, backup codes

**API Key Management**
- Generate API keys with custom scopes and rate limits
- Key revocation and expiry

**Audit Logs**
- Every create, update, delete action logged with user, IP, timestamp
- Exportable for security review

---

### 2.12 Integrations & APIs

| Integration | Purpose |
|---|---|
| **Twilio** | Voice calls, SMS, call recording, media streaming |
| **Groq / OpenAI / vLLM** | LLM inference (any OpenAI-compatible endpoint) |
| **Cartesia Sonic 3** | Ultra-low-latency neural TTS |
| **Razorpay** | Payments, refunds, payment links |
| **WhatsApp (via Twilio)** | Follow-up messages |
| **SMTP** | Email notifications and invoices |
| **REST API** | 65+ endpoints for all platform features |
| **WebSocket API** | Real-time call streaming and dashboard notifications |
| **Webhooks (outbound)** | Push events to external CRMs, ERPs, and automation tools |

---

## 3. What Makes Us Unique

### 3.1 — The System Prompt Is Built From Your Live Database

Most voice AI platforms give the AI a static, generic script. Oolix is fundamentally different.

Before every single call, Oolix queries your database and builds a **bespoke, information-rich system prompt** in under 3 seconds. That prompt contains:

- The caller's name, order history (last 5 orders with items), loyalty tier, and points balance
- Their dietary restrictions, allergies, and learned preferences from past calls
- Your full menu or campaign script — live from the database, not a static file
- Store hours, delivery zones, and operating policies

The AI does not guess or hallucinate your product details. It reads real data.

### 3.2 — The AI Gets Smarter With Every Call

After each call, an LLM analyses the transcript and extracts structured facts:
- Customer said their name? Saved.
- Mentioned a peanut allergy? Saved.
- Said they prefer evening deliveries? Saved.

These facts are stored in a `CustomerMemory` table with a confidence score and surfaced in the system prompt on the customer's next call. **Oolix learns your customers the same way a great human agent does — one conversation at a time.**

No other product in this market does this automatically.

### 3.3 — Emotion-Aware Voice, Not Robotic Monotone

Oolix detects the caller's emotional state on every single turn — angry, frustrated, sad, happy, confused — and adjusts both what it says and how it says it.

- Caller is angry? AI switches to a calm, de-escalating tone with Cartesia's `positivity:low` voice control.
- Caller is happy? AI matches their energy.
- This is done in the **same LLM call that generates the reply** — zero extra latency, zero extra cost.

### 3.4 — Proactive AI: It Speaks First

Most voice bots wait for the human to speak. Oolix greets the caller the moment the call connects — automatically, using their name and context if they're a returning customer.

This eliminates the awkward silence that causes callers to hang up in the first 3 seconds.

### 3.5 — Provider-Agnostic By Design

Oolix is not locked into any single AI vendor. The platform supports:
- **Any OpenAI-compatible LLM endpoint** — Groq, OpenAI, vLLM, local models
- **Two voice architectures** — OpenAI Realtime API (ultra-low latency) or the custom Silero → Whisper → Qwen → Cartesia pipeline (full control, lower cost)
- **Switch without code changes** — just update an environment variable

This means you can move from Groq to OpenAI to a private vLLM deployment as your needs change.

### 3.6 — India-First: Built for the Indian Market

- **Razorpay** for payments — covers UPI, cards, net banking, wallets, COD
- **₹ currency** throughout pricing and analytics
- **Indian English and Hindi code-switching** handled by Whisper
- **Timezone-aware** quiet hours and callback scheduling for Indian business hours
- Pricing and minimum order amounts in INR

### 3.7 — Two Use Cases, One Platform

Competitors typically serve either outbound sales OR inbound service. Oolix serves both:

- **Outbound**: Lead scoring, objection handling, DNC compliance, follow-up sequences, campaign analytics
- **Inbound**: Order collection, menu knowledge, reorder flow, loyalty, delivery zone management

A food delivery business can run lunch promotions outbound at 11 AM and handle inbound orders from 12 PM — on the same platform.

### 3.8 — Real-Time Transparency for Managers

Live dashboards give supervisors complete visibility:
- Every word spoken during a call, streamed to the dashboard in real time
- Emotion state of the caller at every turn
- Instant alerts when sentiment turns negative
- Live call monitoring without interrupting the AI

### 3.9 — Production-Grade Architecture

- **3-second DB timeout** on system prompt builds — a DB hang never stalls a live call
- **asyncio.Lock** prevents concurrent speech processing that would garble audio
- **Utterance lock guard** drops audio if the pipeline is still processing — no queue buildup
- **Parallel initialisation** — DB calls and AI connection happen simultaneously to minimise call setup latency

---

## 4. Why Choose Oolix Over Competitors

### 4.1 Versus Generic Voice Bot Platforms (Bland AI, Retell AI, Vapi)

| Factor | Oolix | Generic Platforms |
|---|---|---|
| Business data in AI context | Live DB query before every call | Static script only |
| Customer memory | Learned and stored after every call | Not available |
| Emotion-adaptive voice | Yes — per turn, zero extra cost | No |
| Proactive greeting | Yes — AI speaks first | Caller must speak first |
| India payments | Razorpay (UPI, COD) | Stripe only (no UPI) |
| Loyalty programme | Built-in | Not available |
| Complaint management | Built-in ticketing with SLA | Not available |
| Multi-use case | Outbound + Inbound in one platform | Typically one use case |
| Vendor lock-in | Provider-agnostic | Locked to their LLM/TTS |

### 4.2 Versus Human Call Centers

| Factor | Oolix | Human Agents |
|---|---|---|
| Cost per call | ₹2–8 (API costs only) | ₹25–80 (agent salary + overhead) |
| Availability | 24 × 7, 365 days | Business hours only |
| Consistency | 100% — same quality every call | Varies by agent mood and experience |
| Scalability | 1,000 simultaneous calls instantly | Weeks of hiring and training |
| Customer memory | Perfect recall of all past calls | Agent notes, if remembered |
| Language consistency | Same every time | Accent and language drift |
| Compliance | Automatic DNC check before every call | Manual and error-prone |
| Ramp-up time | Minutes (update system prompt) | Weeks (training new product) |

### 4.3 Versus Building Your Own

| Factor | Oolix | DIY Build |
|---|---|---|
| Time to first call | Hours (configure + deploy) | 6–18 months |
| Voice pipeline | Production-ready, battle-tested | Must build from scratch |
| Business logic | 50+ services pre-built | Must build every feature |
| Compliance tools | DNC, consent, quiet hours included | Legal research + build |
| Ongoing maintenance | Handled by Oolix | Your engineering team |
| LLM upgrade path | Change one env variable | Refactor integration |

### 4.4 Versus Indian BPO / Call Center Services

| Factor | Oolix | BPO Services |
|---|---|---|
| Data security | Your data stays in your DB | Shared with BPO agents |
| Script control | Full, instant, in your dashboard | Requires SOP updates + training |
| Call quality consistency | 100% consistent | Varies per agent shift |
| Off-hours coverage | Free (no extra cost) | Premium rate or unavailable |
| Real-time analytics | Live, per-turn | Weekly/monthly reports |
| Personalisation | Per-customer, automated | Generic scripts |
| Customer memory | Auto-learned | Agent notes (if taken) |

---

### Key Reasons to Choose Oolix — Summary

1. **Your AI knows your business** — real product data, real customer history, before every call
2. **Your AI knows your customers** — names, preferences, restrictions, order history — learned automatically
3. **It sounds human** — emotion-aware voice, proactive greeting, natural multi-turn conversation
4. **One platform for everything** — outbound campaigns, inbound orders, payments, loyalty, complaints
5. **India-first** — UPI payments, INR pricing, Indian English, Razorpay, Indian timezone compliance
6. **No vendor lock-in** — switch LLM or TTS provider in one config change
7. **10× cheaper than human agents** — at a fraction of the cost with better consistency
8. **Live 24 × 7** — no shifts, no sick days, no training time for new products
9. **Production-grade reliability** — timeout guards, concurrency locks, fallback prompts
10. **Gets smarter over time** — every call teaches the system something new about your customers

---

*Document prepared by the Oolix Product Team — March 2026*
*For sales enquiries: Oolix.in*
