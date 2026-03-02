# Oolix — Voice AI Platform
## Comprehensive Business & Product Document

**Confidential | March 2026**
**For: Sales, Partnerships, Investment, and Enterprise Clients**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem We Solve](#2-the-problem-we-solve)
3. [Our Solution](#3-our-solution)
4. [Core Features](#4-core-features)
5. [Unique Differentiators](#5-unique-differentiators)
6. [Competitive Advantages](#6-competitive-advantages)
7. [Value Proposition](#7-value-proposition)
8. [Business Impact & ROI](#8-business-impact--roi)
9. [Who Should Use Oolix](#9-who-should-use-oolix)

---

## 1. Executive Summary

**Oolix is India's first context-aware, emotion-intelligent Voice AI platform** built specifically for businesses that run phone-based operations — outbound sales teams and inbound customer service desks.

Unlike generic voice bots that read from static scripts, Oolix queries your live database before every call and arms the AI with your real products, real pricing, and the full history of every customer it speaks to. The result is a voice agent that sounds informed, remembers people, handles objections, collects orders, processes payments, and gets smarter with every call.

**In numbers:**
- 10× cheaper per call than a human agent
- Available 24 × 7 with zero staffing overhead
- Handles 1,000 simultaneous calls from Day 1
- Learns every customer's preferences automatically over time
- Built for India — UPI payments, Indian English, Razorpay, INR pricing

**Two platforms, one product:**

| | Outbound Sales | Inbound Service |
|---|---|---|
| **Typical client** | Insurance, loans, EdTech, SaaS | Food delivery, retail, healthcare |
| **What the AI does** | Calls leads, pitches, handles objections, books callbacks | Takes orders, upsells, manages loyalty, confirms delivery |
| **Revenue impact** | Higher conversion, lower cost-per-lead | Higher average order value, zero missed calls |

---

## 2. The Problem We Solve

### The Human Call Center Crisis

Indian businesses that depend on phone-based sales and support face a set of compounding, expensive problems:

---

### Problem 1 — Cost is Unsustainable

A single call center agent in India costs ₹18,000–35,000 per month in salary alone, before adding:
- Training (4–8 weeks, ₹10,000–25,000 per agent)
- Infrastructure (seats, headsets, CRM licences)
- Attrition (Indian BPO turnover is 35–50% annually, meaning constant re-hiring and re-training)
- Supervisory overhead (1 supervisor per 10–15 agents)
- Night shift premiums and holiday pay

A 50-seat call center burns ₹15–25 lakh per month before a single rupee of revenue is made.

---

### Problem 2 — Human Agents Are Inconsistent

The same product, two different agents, two completely different customer experiences:
- One agent knows the menu; another doesn't
- One handles objections professionally; another gets flustered
- One follows DNC compliance; another doesn't
- Quality depends on the agent's mood, training recency, and whether it's Monday morning or Friday evening

Every inconsistency is a lost sale, a customer complaint, or a compliance violation.

---

### Problem 3 — Scale Is Impossible Without Proportional Cost

Need to handle a 3× surge in calls during a campaign? You need 3× the agents — hired weeks in advance, trained, and managed. If the campaign underperforms, those agents are still on payroll.

Human call centers cannot scale up or down in real time. Businesses either over-staff (wasting money) or under-staff (losing calls and customers).

---

### Problem 4 — Agents Forget, Customers Notice

A returning customer who called three months ago mentioned they are vegetarian. The agent who handled that call is gone. The new agent recommends a chicken dish. The customer is annoyed.

Human memory is ephemeral. Customer loyalty is not.

---

### Problem 5 — After-Hours Calls Go Unanswered

A customer calls at 11 PM to place a food order or ask about a policy. The call center is closed. That customer orders from a competitor. That competitor is open because they use an AI.

---

### Problem 6 — Existing Voice Bots Are Embarrassingly Bad

Businesses that have tried to solve this with IVR systems or first-generation chatbots know the outcome:
- Rigid menu-driven flows ("Press 1 for billing…")
- Cannot handle natural conversation
- Know nothing about the caller's history
- Sound robotic, frustrate customers, and damage brand reputation

The choice has been: expensive humans or bad bots. **Oolix is the third option.**

---

## 3. Our Solution

Oolix replaces the expensive, inconsistent, limited human call center with a **real-time voice AI** that:

1. **Speaks and listens like a person** — natural conversation, no menus, no "Press 1"
2. **Knows your business before the call starts** — product catalogue, pricing, policies, all loaded from your live database
3. **Knows your customer before the call starts** — name, order history, preferences, loyalty status, dietary restrictions
4. **Detects emotion and responds accordingly** — calm when the customer is angry, warm when they are sad, energetic when they are happy
5. **Handles the full transaction** — takes the order, confirms details, sends a payment link, confirms payment
6. **Learns after every call** — extracts customer facts from transcripts and remembers them for next time
7. **Operates 24 × 7** at zero marginal cost per additional call

### How a Call Works — End to End

```
Customer's phone rings (outbound) or customer calls in (inbound)
        ↓
Oolix queries your database in < 3 seconds:
  → Loads customer name, order history, loyalty points
  → Loads your full menu / campaign script
  → Loads dietary restrictions, preferences, learned memories
        ↓
AI greets the caller by name before they say a word
        ↓
Real-time conversation:
  → Customer speech → Whisper STT (transcription)
  → Transcript + history → Qwen LLM (reasoning + reply)
  → Emotion detected simultaneously, zero extra cost
  → Reply → Cartesia Sonic 3 TTS (natural voice)
  → Voice sent back to Twilio → Customer hears it
        ↓
Order placed / objection handled / callback scheduled
        ↓
Payment link sent via SMS → Customer pays via UPI/card/COD
        ↓
Invoice generated → SMS confirmation sent
        ↓
After call: LLM reads transcript → extracts new customer facts
  → Saved to CustomerMemory → Available on next call
```

---

## 4. Core Features

---

### 4.1 Voice AI Engine

**Speech-to-Text (STT)**
Oolix listens using Whisper, either running locally or via Groq's cloud API for sub-200ms transcription. Silero VAD (Voice Activity Detection) precisely identifies when the caller finishes speaking — 400ms silence threshold means the AI responds quickly without cutting the caller off.

**Large Language Model (LLM)**
The AI's brain. Powered by Qwen, GPT-4o, or any OpenAI-compatible endpoint. The LLM receives a rich system prompt containing everything about your business and this specific customer, then generates a reply that is:
- Contextually appropriate (knows what was said earlier in the conversation)
- Factually accurate (real menu prices, real policy details)
- Personally relevant (knows the customer's name, past orders, restrictions)
- Emotionally calibrated (detects caller mood in the same API call)

**Text-to-Speech (TTS)**
Cartesia Sonic 3 converts the reply into natural-sounding speech in under 200ms. The voice tone is dynamically adjusted based on detected emotion — the AI does not speak in a robotic monotone regardless of whether the caller is crying or laughing.

**Auto-Greeting**
The AI speaks the moment the call connects. Returning customers are greeted by name. New callers get a warm, professional introduction. No one waits in silence wondering if anyone is there.

---

### 4.2 Outbound Campaign Features

| Feature | Description |
|---|---|
| **Campaign Management** | Create campaigns with scripts, schedules, daily call limits, retry logic |
| **Lead Scoring** | Automatic 0–100 score based on call behaviour, engagement, and recency |
| **Lead Tiers** | Hot / Warm / Cold / Unknown — AI pitches differently per tier |
| **Buying Signal Detection** | Identifies high, medium, low intent and negative signals in real time |
| **Objection Handling** | Detects objections, matches response templates, tracks resolution rates |
| **DNC Compliance** | Do-Not-Call registry checked before every single outbound call |
| **Quiet Hours** | Enforced by timezone — no calls outside permitted hours |
| **Callback Scheduling** | AI offers preferred time slots; callbacks processed automatically |
| **Follow-Up Sequences** | Multi-step chains: SMS → WhatsApp → Callback → Email |
| **Campaign Analytics** | Conversion rate, ROI, cost per lead, script performance |

---

### 4.3 Inbound Order Taking Features

| Feature | Description |
|---|---|
| **Conversational Order Flow** | AI walks through items → address → contact → confirmation naturally |
| **Menu Intelligence** | Full catalogue loaded from DB — real prices, real availability |
| **Reorder Flow** | "Same as last time?" — AI suggests based on order history |
| **Upselling** | Suggests complementary items based on menu and past preferences |
| **Dietary Compliance** | Never suggests items that violate known restrictions or allergies |
| **Delivery Zone Validation** | Checks if address falls within an active delivery zone |
| **Store Hours Awareness** | Will not take orders outside operating hours |
| **Payment Link** | Sends Razorpay link via SMS during/after the call |

---

### 4.4 Customer Intelligence

| Feature | Description |
|---|---|
| **Customer Recognition** | Phone number looked up before every call — instant profile loading |
| **Order History** | Last 5 orders with items, amounts, dates, and delivery addresses |
| **Loyalty Status** | Points balance, tier name and benefits — surfaced during the call |
| **Preference Memory** | Dietary restrictions, allergies, favourite items, delivery notes |
| **AI-Learned Facts** | Extracted from call transcripts — name, preferences, habits |
| **Returning vs New** | Different greeting and conversation style for each |
| **Auto-Registration** | New callers automatically registered as customers after first call |

---

### 4.5 Payment Flow

The complete payment cycle without a single human touch:

```
Call ends with confirmed order
    ↓
Order saved to DB
    ↓
Razorpay payment record created
    ↓
Unique payment link generated (full + short URL)
    ↓
AI reads link to customer before hanging up
    ↓
SMS sent: "Pay ₹450 → https://oolix.in/p/aB3xQw9k"
    ↓
Customer opens link → Razorpay checkout
    ↓
UPI / Card / Net Banking / Wallet / COD
    ↓
Webhook → Payment confirmed → Status updated
    ↓
PDF Invoice generated and sent
    ↓
Order moves to kitchen / fulfilment queue
```

**Supported payment methods:** UPI, debit/credit cards, net banking, digital wallets, Cash on Delivery
**Fraud detection:** Every transaction scored 0–100 for risk before processing
**Link lifecycle:** pending → clicked → paid | expired | cancelled

---

### 4.6 Loyalty & Rewards

| Feature | Description |
|---|---|
| **Tiered Programme** | Silver, Gold, Platinum tiers with configurable benefits |
| **Points Earning** | Points per ₹ spent, with tier-based multipliers |
| **Points Redemption** | Discounts, free items, free delivery, bonus points |
| **Birthday Bonuses** | Automatic bonus on customer's birthday |
| **Referral System** | Unique codes, referral tracking, bonus for both parties |
| **Benefits per Tier** | Priority support, exclusive offers, early access |

---

### 4.7 Complaint Management

| Feature | Description |
|---|---|
| **Ticket System** | Every complaint gets a unique ticket number |
| **Priority Levels** | Low, Medium, High, Critical |
| **SLA Management** | Deadlines set per category; breach alerts to supervisors |
| **Agent Assignment** | Tickets routed to appropriate team members |
| **Resolution Tracking** | Compensation logged, customer satisfaction scored post-resolution |
| **Analytics** | Resolution time, SLA compliance, category breakdown |

---

### 4.8 Analytics & Reporting

| Dashboard | Key Metrics |
|---|---|
| **Call Analytics** | Volume, duration, completion rate, sentiment trends, emotion history |
| **Campaign Analytics** | Conversion rate, ROI, cost per lead, objection win rate |
| **Revenue Dashboard** | Revenue by period, product, zone, payment method |
| **Customer Analytics** | Lifetime value, retention, loyalty tier distribution |
| **Agent Performance** | Call volume, resolution rate, escalation rate |
| **Inventory Reports** | Stock levels, movement history, low-stock alerts |
| **Payment Analytics** | Success rate, average order value, fraud incidents, refund rate |

---

### 4.9 Compliance & Security

| Feature | Description |
|---|---|
| **DNC Registry** | Full Do-Not-Call database, checked before every outbound call |
| **Consent Management** | Recorded with method, timestamp, and expiry per contact |
| **Quiet Hours** | Timezone-aware enforcement of permitted calling windows |
| **Audit Log** | Every action logged: user, IP, timestamp, resource |
| **2FA** | TOTP-based two-factor authentication for all accounts |
| **Role-Based Access** | Admin, Manager, Agent, Viewer — granular permissions |
| **Data Isolation** | Complete separation of data between teams |

---

### 4.10 Automation & Integrations

**Automation**
- Follow-up sequences (SMS → WhatsApp → Callback → Email) triggered automatically
- Post-call transcript analysis and memory extraction
- Invoice generation and delivery
- Callback queue processing
- SLA breach alerts

**Integrations**
- **Twilio** — voice calls, SMS, call recording, media streaming
- **Razorpay** — payments, refunds, payment links, QR codes
- **Groq / OpenAI / vLLM** — any OpenAI-compatible LLM endpoint
- **Cartesia** — neural TTS
- **WhatsApp via Twilio** — follow-up messages
- **SMTP** — email notifications and invoices
- **REST API** — 65+ endpoints for full platform access
- **Webhooks** — push events to external CRMs, ERPs, or automation tools

---

## 5. Unique Differentiators

These are the capabilities that no other platform in the market offers in combination.

---

### Differentiator 1 — The System Prompt Is Built From Your Live Database

**What others do:**
Every voice AI platform on the market — Bland AI, Retell AI, Vapi, Synthflow — gives the AI a static script written once and uploaded manually. When your menu changes, someone has to update the script. When a price changes, someone has to remember to edit the bot's knowledge. When a new product launches, the bot doesn't know about it until someone updates the file.

**What Oolix does:**
Before every single call, Oolix runs a live query against your database and constructs a custom system prompt containing:
- Your current, live product catalogue with real prices
- Your delivery zones and fees as they exist right now
- Your store hours for today
- This specific customer's complete history
- The exact campaign script assigned to this contact

The AI never works from stale information. It always knows exactly what you sell, what it costs, and who it's talking to.

**Why it matters:**
An AI that gives wrong prices destroys customer trust. An AI that recommends a discontinued product is embarrassing. Oolix eliminates both problems permanently.

---

### Differentiator 2 — AI Memory That Grows With Every Call

**What others do:**
Treat every call as isolated. The AI has no memory of previous conversations. A customer who called last week to complain about peanuts in their food gets the same generic treatment this week.

**What Oolix does:**
After every call, a background LLM reads the full transcript and extracts structured facts:

```
Customer said: "My name is Priya, I'm allergic to peanuts and I prefer evening deliveries"

Saved to CustomerMemory:
  personal  | name            | Priya           | confidence: 0.98
  dietary   | allergies       | peanuts         | confidence: 0.99
  preference| delivery_timing | evening (6–9pm) | confidence: 0.85
```

On Priya's next call — whether it's tomorrow or three months later — these facts are in the AI's system prompt before the call even connects. The AI greets her by name, never suggests anything with peanuts, and offers evening delivery slots first.

**Why it matters:**
This is what great human agents do. They remember. Oolix does it automatically, at scale, for every customer, with perfect recall.

---

### Differentiator 3 — Emotion Intelligence Baked Into the Core

**What others do:**
Analyse sentiment as a separate, post-call analytics feature. Useful for reporting, useless for the live conversation.

**What Oolix does:**
Detect the caller's emotion on every single turn — in the **same LLM call that generates the reply** — at zero extra cost and zero extra latency.

Emotions detected: neutral, happy, excited, sad, frustrated, angry, fearful, confused, surprised.

The AI then adjusts **both what it says and how it sounds:**

| Caller Emotion | AI Response Strategy | Voice Tone |
|---|---|---|
| Angry | Calm, de-escalating, solution-focused | Low positivity, measured pace |
| Frustrated | Patient, empathetic, actionable | Warm, steady |
| Sad | Gentle, supportive, reassuring | Soft positivity, slower |
| Happy | Matches energy, positive, engaged | High positivity |
| Confused | Clear, patient, step-by-step | Helpful, clear |

**Why it matters:**
A caller threatening to cancel their subscription needs a different response than a happy customer adding items to their order. Oolix knows the difference and adjusts in real time.

---

### Differentiator 4 — Proactive AI: It Speaks First

**What others do:**
Wait for the caller to speak. In practice, this means 3–5 seconds of silence at the start of every call while the bot "initialises." A significant percentage of callers hang up in this window.

**What Oolix does:**
The AI begins connecting to the LLM and loading the system prompt **simultaneously** with the Twilio connection being established. By the time the call connects, the AI is ready. It speaks first — greeting the caller by name if they are a returning customer, or with a warm introduction if they are new.

**Why it matters:**
First impressions happen in the first 3 seconds. An AI that greets you by name before you say a word feels personal and competent. An AI that makes you wait in silence feels broken.

---

### Differentiator 5 — Complete Provider Independence

**What others do:**
Lock you into their proprietary LLM and TTS stack. If their model quality degrades, their costs rise, or their service has an outage, you have no alternative.

**What Oolix does:**
Support any OpenAI-compatible LLM endpoint via a single environment variable:

```
LLM_BASE_URL = https://api.groq.com/openai/v1   # Groq — fast, cheap
LLM_BASE_URL = https://api.openai.com/v1          # OpenAI — powerful
LLM_BASE_URL = http://your-server:8000/v1          # Your private vLLM
```

Switching takes 30 seconds. No code changes. No redeployment.

Two complete voice architectures supported:
- **OpenAI Realtime API** — ultra-low latency, single WebSocket
- **Custom pipeline** — Silero VAD → Whisper → Qwen → Cartesia (full control, lower cost)

**Why it matters:**
As LLM costs fall and new models emerge monthly in 2026, you want the freedom to use the best model for your needs — not the one your vendor has locked you into.

---

### Differentiator 6 — India-First, Not India-Adapted

**What others do:**
Build for the US/European market and add India as an afterthought. Stripe for payments (no UPI), dollar pricing, no understanding of Indian business contexts, no handling of Hindi code-switching.

**What Oolix does:**
Build for India from Day 1:

| Feature | India-First Implementation |
|---|---|
| **Payments** | Razorpay — UPI, PhonePe, GPay, Paytm, COD, net banking |
| **Currency** | ₹ (INR) throughout — pricing, analytics, invoices |
| **Language** | Whisper handles Indian English and Hindi code-switching |
| **Compliance** | TRAI DNC regulations, Indian quiet hours (9 AM – 9 PM) |
| **Timezone** | IST-aware scheduling throughout |
| **SMS** | Twilio India numbers, transactional SMS templates |

**Why it matters:**
A platform designed for India works in India. An American platform adapted for India has friction everywhere it matters most — payments, language, regulation, culture.

---

### Differentiator 7 — Dual Use Case: Outbound + Inbound in One Platform

**What others do:**
Specialise in either outbound (dialler bots, sales AI) or inbound (order taking, customer support). Businesses with both needs pay for two separate platforms, maintain two integrations, and deal with two vendor relationships.

**What Oolix does:**
Handle both on one platform, one dashboard, one database, one team:

- **9 AM to 12 PM:** AI calls insurance leads, qualifies them, books callbacks
- **12 PM to 10 PM:** Same AI takes inbound food orders, manages loyalty, confirms payments
- **10 PM to 9 AM:** AI handles inbound queries, escalates urgent complaints

One subscription. One set of integrations. One team managing both.

---

### Differentiator 8 — Real-Time Transcript Persistence

**What others do:**
Offer post-call transcripts as a separate, asynchronous process — available hours after the call.

**What Oolix does:**
Save every word of every conversation to the database **as it is spoken.** Every turn — user and AI — is a `Transcript` record linked to the `Call`, `Customer`, and `Team`. Available instantly in the dashboard the moment it is said.

Managers can read a live call transcript in real time, watch the emotion change turn by turn, and intervene if needed — without the AI or caller knowing.

---

## 6. Competitive Advantages

### 6.1 Versus Global Voice AI Platforms

*Bland AI, Retell AI, Vapi, Synthflow, ElevenLabs Conversational AI*

| Capability | Oolix | Global Competitors |
|---|---|---|
| Live DB context before every call | Yes | No — static knowledge only |
| Customer memory from transcripts | Yes | No |
| Emotion-adaptive voice per turn | Yes | No |
| Proactive greeting (AI speaks first) | Yes | Rare |
| India payments (UPI, Razorpay) | Yes | No — Stripe only |
| Loyalty & rewards system | Yes | No |
| Complaint management | Yes | No |
| Inventory management | Yes | No |
| Outbound + Inbound in one platform | Yes | Usually one or the other |
| Provider-agnostic LLM | Yes | No — locked to their model |
| INR pricing and Indian compliance | Yes | No |
| Post-call memory extraction | Yes | No |
| Real-time transcript to DB | Yes | Post-call only |

**Verdict:** Oolix is not a voice AI with some business features bolted on. It is a complete business operating platform with a voice AI at its core.

---

### 6.2 Versus Human Call Centers and BPOs

| Factor | Oolix | Human Agents |
|---|---|---|
| **Cost per call** | ₹2–8 | ₹25–80 |
| **Monthly cost (100 calls/day)** | ₹6,000–24,000 | ₹75,000–2,40,000+ |
| **Availability** | 24 × 7 × 365 | Business hours only |
| **Simultaneous calls** | Unlimited | Proportional to headcount |
| **Consistency** | 100% — identical quality every call | Varies per agent, per day |
| **Ramp-up time** | Minutes — update the system prompt | 4–8 weeks training |
| **Language** | Consistent | Varies by agent |
| **Customer memory** | Perfect — all calls recorded, extracted | Ephemeral — agent notes if remembered |
| **DNC compliance** | Automatic before every call | Manual — human error possible |
| **Scalability** | Instant | Weeks of hiring and training |
| **Attrition cost** | Zero | 35–50% annual turnover |
| **Data privacy** | Your data stays in your system | Shared with BPO agents |

**Verdict:** At 10–30× lower cost per call with superior consistency, memory, and availability, there is no financial case for an equivalent human call center over Oolix.

---

### 6.3 Versus Building Your Own

| Factor | Oolix | DIY Voice AI |
|---|---|---|
| **Time to first call** | Hours | 6–18 months |
| **Voice pipeline** | Production-ready | Must build from scratch |
| **Business logic** | 50+ services included | Must architect and build every feature |
| **LLM integration** | Done | Must integrate and maintain |
| **Compliance tools** | Included | Legal research + engineering |
| **Payment integration** | Razorpay done | Must build |
| **Analytics** | Full dashboard included | Must build |
| **Ongoing maintenance** | Managed by Oolix | Your engineering team, forever |
| **LLM upgrades** | One environment variable | Refactor integration |
| **Engineering cost** | Zero | ₹80–150L initial + ₹30–50L/year |

**Verdict:** A custom-built solution takes 12–18 months and ₹1–2 crore before the first call is made. Oolix is live in hours.

---

### 6.4 Versus Indian BPO Services

| Factor | Oolix | Indian BPO |
|---|---|---|
| **Data security** | Caller data stays in your DB | Shared with BPO agents |
| **Script control** | Instant update from dashboard | SOP revision + retraining cycle |
| **Off-hours** | Free — AI runs 24/7 | Premium rate or not available |
| **Quality consistency** | 100% | Depends on agent, shift, trainer |
| **Real-time analytics** | Live per-turn emotion and transcript | Weekly reports |
| **Personalisation** | Per-customer, automated | Generic scripts |
| **Setup time** | Hours | Weeks of onboarding |
| **Scalability** | Instant | 2–4 week hiring cycle |
| **Customer memory** | Permanent, automatic | Agent notes if they bother |
| **Compliance** | Built-in, automatic | Policy-based, human-enforced |

**Verdict:** Oolix gives you better results, faster, with more control, better data security, and at a fraction of the cost.

---

## 7. Value Proposition

### The One-Line Promise

> **Oolix makes every phone call smarter, cheaper, and more personal than any human agent — starting from the first day, and improving with every call.**

---

### For Outbound Sales Teams

**Before Oolix:**
- 50 agents calling leads, each with slightly different training
- 30% of calls go to DNC numbers (regulatory risk)
- When a lead says "I'm not interested right now" the agent forgets and calls again in two weeks
- Campaign analytics available three days after the campaign ends
- New product launch? Retrain all 50 agents over two weeks

**After Oolix:**
- Every call made exactly on script, with zero DNC violations
- Lead scored in real time — hot leads escalated, cold leads deprioritised automatically
- Objection logged, matched to a response template, tracked for effectiveness
- Callback scheduled at the lead's preferred time and called automatically
- New product launch? Update the campaign script in the dashboard. Live in minutes.
- Analytics updated turn-by-turn, live

---

### For Inbound Order-Taking Businesses

**Before Oolix:**
- Agents miss calls during peak hours; customers call competitors
- New staff don't know the menu; wrong prices quoted
- Customer says they're vegetarian; next order, different agent suggests meat
- Customer calls at 11 PM; no one answers
- Payment collected in cash at door; fraud and shrinkage are constant problems

**After Oolix:**
- Zero missed calls — AI answers simultaneously on every line
- AI knows the exact current menu, current prices, and current availability
- Customer's dietary restriction is in the AI's memory; it never suggests a wrong item again
- 24/7 operation — orders taken at 2 AM as professionally as 2 PM
- Payment link sent via SMS; customer pays by UPI before food is even prepared

---

### The Compounding Advantage

Most business tools deliver the same value on Day 1 as they do on Day 365. Oolix compounds:

- **Day 1:** AI knows your products and handles calls professionally
- **Month 1:** AI has learned the names, preferences, and restrictions of your regular customers
- **Month 6:** AI has identified your top 20% customers by loyalty score, suggests upsells personalised to their history, and handles objections with templates proven by 6 months of effectiveness data
- **Year 1:** AI has a richer customer profile than any human agent could build in 5 years

Every call makes the next call better. **Oolix is a business asset that appreciates.**

---

## 8. Business Impact & ROI

### Cost Comparison — 100 Calls per Day

| Cost Item | Human Call Center | Oolix |
|---|---|---|
| Agent salaries (8 agents) | ₹1,60,000/month | ₹0 |
| Training & onboarding | ₹20,000/month amortised | ₹0 |
| Infrastructure & tools | ₹30,000/month | ₹0 |
| Supervision | ₹25,000/month | ₹0 |
| **API costs (LLM + TTS + STT)** | ₹0 | ₹18,000–25,000/month |
| **Oolix platform** | ₹0 | Contact for pricing |
| **Total** | **₹2,35,000+/month** | **~₹25,000–35,000/month** |
| **Savings** | — | **₹2,00,000+/month** |
| **Annual savings** | — | **₹24 lakh+** |

*API cost estimates based on Groq LLM + Cartesia TTS at 100 calls/day, avg 5 minutes each.*

---

### Revenue Impact

**Inbound businesses:**
- Zero missed calls = higher order capture rate. If 10% of calls currently go unanswered and each order is worth ₹400, 100 calls/day = ₹4,000/day in recovered revenue = ₹1.4 lakh/month
- AI upsells consistently on every call. Human agents upsell inconsistently. A 5% increase in average order value on 100 orders/day at ₹400 average = ₹2,000/day = ₹72,000/month

**Outbound businesses:**
- Consistent, trained AI on every call improves conversion rate over inconsistent human agents
- DNC compliance eliminates regulatory fines (TRAI penalties: ₹25,000–2 lakh per violation)
- Callback automation captures leads that would otherwise go cold

---

### Payback Timeline

For a business replacing a 10-agent call center:

| Month | Action | Impact |
|---|---|---|
| Month 1 | Deploy Oolix, reduce to 3 human agents (for escalations) | Save ₹1.4 lakh |
| Month 2 | AI has learned top 200 customers' preferences | AOV increases |
| Month 3 | Follow-up sequences capturing 15% more leads | Conversion up |
| Month 6 | Full customer memory across 1,000+ callers | Loyalty scores rise |
| Month 12 | Complete ROI realised | ₹20–25 lakh saved, revenue up |

---

## 9. Who Should Use Oolix

### Ideal Customer Profile

**Size:** 10 to 500 employees. Large enough to have meaningful call volume; focused enough to feel the cost and quality impact immediately.

**Industry:**
- Food delivery and restaurants (inbound orders)
- Insurance and financial products (outbound sales)
- EdTech and online courses (outbound lead qualification)
- Healthcare — clinics, diagnostics, pharmacy (appointment booking, inbound queries)
- Real estate (outbound lead nurturing, appointment scheduling)
- E-commerce and retail (inbound order support, returns, reorders)
- NBFCs and lending (outbound collections, inbound queries)

**Current situation (any one of these):**
- Running a call center with 5+ agents and feeling the staffing cost
- Losing calls after business hours
- Running outbound campaigns and unhappy with conversion consistency
- Paying a BPO and not satisfied with quality or data security
- Building a voice bot and realising the engineering effort is massive

**What they want:**
- Lower cost per call
- 24/7 coverage
- Better customer experience
- Consistent quality on every call
- Real-time visibility into what's happening on calls

---

### Oolix is NOT for:

- Businesses with zero call volume (they need a chatbot, not a voice AI)
- Highly regulated industries requiring a licensed human agent by law (banking, legal advice where regulation mandates human interaction)
- Businesses with extremely complex, unpredictable call types that cannot be modelled with a system prompt

---

### Getting Started

**Day 1:**
1. Connect your Twilio number
2. Load your product catalogue or campaign script
3. Configure your system prompt defaults
4. Go live — the AI handles calls

**Week 1:**
- Customer memory begins accumulating
- Analytics dashboard shows call patterns
- Lead scoring identifies your best prospects

**Month 1:**
- Follow-up sequences running automatically
- Payment flow reducing cash-on-delivery dependency
- Loyalty programme increasing repeat purchase rate

---

## Summary: 10 Reasons to Choose Oolix

| # | Reason | Benefit |
|---|---|---|
| 1 | **AI that knows your business** | Real product data, real prices — never outdated |
| 2 | **AI that knows every customer** | Names, history, preferences, restrictions — loaded automatically |
| 3 | **Proactive, human-sounding voice** | Greets first, never robotic, emotion-aware tone |
| 4 | **Gets smarter with every call** | Customer memory grows — compounding advantage |
| 5 | **Complete transaction in one call** | Order → payment link → invoice, no human required |
| 6 | **Outbound + Inbound in one platform** | One subscription, one team, one dashboard |
| 7 | **India-first** | UPI, Razorpay, INR, TRAI compliance, Indian English |
| 8 | **No vendor lock-in** | Switch LLM or TTS in one config change |
| 9 | **10× cheaper than human agents** | At scale, the economics are overwhelming |
| 10 | **Live 24/7/365** | No shifts, no holidays, no sick days, no attrition |

---

*Oolix — Every Call, Perfectly Handled*
*Contact: Oolix.in | March 2026*
*This document is confidential and intended for authorised recipients only.*
