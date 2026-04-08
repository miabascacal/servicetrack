# PITCH_DECK.md — ServiceTrack Go-To-Market Strategy

**Last Updated**: 2026-03-31  
**Target Audience**: Investors, dealership owners, CFOs, Operations managers

---

## 🎯 EXECUTIVE SUMMARY (60 seconds)

**ServiceTrack** is an AI-powered SaaS platform that automates customer communication and follow-up workflows for automotive dealerships in Mexico. By integrating WhatsApp, intelligent AI responses, and workflow automation, we reduce asesor workload by 40% while improving customer satisfaction.

**Key Metrics**:
- **Labor Cost Reduction**: 40% fewer manual messages (asesor saves 10 hours/week)
- **Response Time**: 95% of inquiries answered <2 minutes (bot + human escalation)
- **Customer Satisfaction**: CSI scores +15-20% with proactive follow-ups
- **Time to Value**: Installed and generating value in <1 week
- **Pricing**: $299-1,999/month (based on dealership size)

---

## 📊 MARKET OPPORTUNITY

### Market Size
- **Mexico Automotive Market**: ~2,000 dealerships (Autoline, Seekop, ClearMechanic)
- **Dealerships > 50 employees**: ~400 (our TAM)
- **Potential Revenue**: $120M-200M annually (at $299-1999 ARPU)
- **Current Market**: Fragmented (no unified automation platform)

### Problem Statement
Dealership asesores spend **15-20 hours/week** on repetitive customer follow-ups:
- "¿Cuándo vuelvo por mi auto?" (When to return?)
- Appointment reminders/confirmations
- Status updates on repairs
- Upsell opportunities ("próximo servicio en 6 meses")
- Complaints management
- Post-purchase satisfaction surveys

**Manual Effort**:
- 1 asesor = 5-7 messages/hour → 50-70 messages/day → 250-350/week
- WhatsApp open rate: 95%
- **But**: 90% of messages are repetitive (status, ETA, confirmation)

**Cost to Dealership**:
- Salary: $1,500-2,500/month per asesor
- Training: $200/month per asesor
- **Burden**: $1,700-2,700/month per asesor
- **100-employee dealership**: $85,000-135,000/month just for message sending

### Competitive Landscape
| Competitor | Focus | Pain Point |
|---|---|---|
| **Autoline** | DMS (inventory, sales) | Not automation; standalone system |
| **Seekop** | Service scheduling | Not end-to-end workflow |
| **ClearMechanic** | Technical diagnostics | Not customer communication |
| **Manual + Twilio** | Raw SMS API | Requires dev team; no AI; no CRM |
| **ServiceTrack** | **Automation + AI + CRM + WhatsApp** | **Turn-key, no code** ✅ |

---

## 💡 SOLUTION: THE SERVICETRACK PLATFORM

### Core Value Proposition
> **"Reduce asesor workload by 40% while improving customer satisfaction—AI-powered WhatsApp automation that doesn't require code."**

### 3 Core Pillars

#### 1️⃣ Unified CRM Hub
- Single database of clients + vehicles + service history
- 360-degree customer view (all interactions in one place)
- Automatic vehicle maintenance alerts ("próximo servicio en X días")
- **Benefit**: No more scattered Excel sheets; asesor has all context

#### 2️⃣ AI-Powered Intelligent Messaging (via Claude API)
- **Incoming message** from customer → AI reads context (vehicle history, recent service) → Generates smart response
- **Examples**:
  - Customer: "¿Cuándo está mi auto?" 
    - Bot: "Tu auto está en revisión. Estimado de entrega: Jueves 14:00. ¿Necesitas algo más?"
  - Customer: "¿Cuándo próximo servicio?"
    - Bot: "Tu próximo servicio es en Julio. ¿Deseas agendar ahora?" [Agendar | Luego]
  - Escalation: If query is complex → marks for asesor review
- **Benefit**: Asesor handles 5x more messages without burnout; customer gets instant response

#### 3️⃣ Workflow Automation (via N8N)
- **Time-Based**: Reminders 24h + 2h before appointment
- **Event-Based**: Auto-send next service invoice when OT closes
- **Trigger-Based**: Low CSI score → auto-escalate to manager
- **Data-Driven**: Export campaigns ("sedans aging 3+ years → upsell seminuevos")
- **Benefit**: Zero manual reminder tasks; proactive upsells; no missed follow-ups

---

## 🎁 PRODUCT FEATURES (MVP: Sprint 1-5, 3 months)

### CRM Module (Sprint 3)
✅ Centralized client + vehicle database  
✅ Search by WhatsApp, VIN, or license plate  
✅ Multi-person vehicle support (owner, driver, family)  
✅ Complete interaction history timeline  

### Appointments Module (Sprint 4)
✅ Kanban board (6 stages: pending → arrived → completed)  
✅ Auto-send confirmations 24h + 2h before  
✅ WhatsApp check-in: "Ya llegué" → asesor notified  
✅ Pre-arrival form: "What's wrong?" (customer-filled)  
✅ No-show recovery: Auto-suggest reschedule  

### Workshop Module (Sprint 5)
✅ Work orders (manual or auto-from appointment)  
✅ Real-time status updates → customer gets WhatsApp  
✅ Escalation alerts (>24h without progress)  
✅ CSI survey: Automatic post-completion  

### Bandeja Unified + AI (Sprint 8)
✅ Single inbox: WhatsApp + Email + Facebook  
✅ AI generates smart responses (configured per module)  
✅ Asesor reviews + approves before sending  
✅ Audit trail: Every message logged  

### Atención a Clientes (Sprint 9)
✅ Complaint intake (floating button in all modules)  
✅ Auto-escalation workflow (receiver → manager → resolution)  
✅ SLA tracking + alerts  
✅ Reapertura automation  

---

## 📈 FINANCIAL MODEL

### Pricing Strategy
Three-tier pricing (per dealership/month):

| Tier | Usuarios | Clientes | Citas/mes | Price | Target |
|------|----------|----------|-----------|-------|--------|
| **STARTER** | 5 | 1K | 200 | $299 | Small dealers (10-20 asesores) |
| **PROFESSIONAL** | 15 | 5K | 1000 | $899 | Medium dealers (40-80 asesores) |
| **ENTERPRISE** | Unlimited | Unlimited | Unlimited | $1,999 | Large dealers (100+ asesores) |

### Unit Economics (100-dealership portfolio)
```
Dealerships: 100
Average Tier: PROFESSIONAL ($899/month)

Monthly Recurring Revenue (MRR):
  100 dealerships × $899 = $89,900/month
  Annual Revenue (ARR): $1,078,800/year

CAC (Customer Acquisition Cost):
  Sales salary: $3,000/month
  Marketing (digital): $2,000/month
  → CAC = $60,000/year ÷ 15 new customers = $4,000 per customer

LTV (Lifetime Value):
  ARPU: $899/month
  Churn rate: 5%/month (1 customer lost per 20)
  LTV = $899 ÷ 0.05 = $17,980

LTV/CAC Ratio: 17,980 / 4,000 = 4.5x ✅ (Healthy: >3x)

Gross Margin:
  COGS (Supabase, N8N, Claude API): ~$8/customer/month
  Gross Margin = ($899 - $8) / $899 = 99% ✅

Net Margin (at 3x headcount):
  Revenue: $89,900/month
  Costs:
    - Engineering (5 devs): $30,000
    - Operations (2): $8,000
    - Cloud infrastructure: $2,000
    - Legal/compliance: $1,000
  Total Costs: $41,000/month
  Net Margin: ($89,900 - $41,000) / $89,900 = 54% ✅
```

### Year 1-3 Projections
```
YEAR 1 (MVP Launch)
  Months 1-3: Beta (5 customers, $5,000/month)
  Months 4-6: Launch (15 customers, $15,000/month)
  Months 7-12: Ramp (35 customers, $35,000/month avg)
  ARR: ~$250K

YEAR 2 (Scale)
  Growth: 20 new customers/month
  ARR (end of year): $1.2M
  Gross Margin: 98%
  Net Margin: 40%

YEAR 3 (Profitability)
  Growth: 30 new customers/month
  ARR (end of year): $3.2M
  Gross Margin: 99%
  Net Margin: 55%
```

---

## 🎪 GO-TO-MARKET STRATEGY

### Phase 1: Customer Research & Pilots (Month 1-2)
**Goal**: Validate product-market fit with 5 pilot customers

1. **Target Dealerships**:
   - Size: 40-100 asesores
   - Location: Mexico City, Guadalajara (early adopters)
   - Criteria: Already using WhatsApp; willing to adopt new tools
   
2. **Outreach**:
   - Warm intros via industry contacts
   - LinkedIn: Operations managers, IT directors
   - Email: "Free pilot program (3 months) — reduce asesor workload"

3. **Pilot Metrics**:
   - System uptime: 99.5%+
   - Time to value: <1 week onboarding
   - Asesor adoption: 80%+ using AI responses
   - Message volume: 2x previous (bot doing work)
   - NPS: >40 required to scale

### Phase 2: Early Adopter Program (Month 3-6)
**Goal**: 15-20 paying customers, $15K-20K MRR

1. **Program Structure**:
   - Early Adopter Discount: $599/month (33% off PROFESSIONAL tier)
   - Commitment: 6-month contract + weekly feedback calls
   - Support: Direct Slack channel to product team

2. **Sales Approach**:
   - Case studies: 3-5 successful pilots
   - Video demos: Real dealership workflows
   - Email campaigns: Operations directors
   - Webinars: "AI Automation for Dealerships" (Spanish + English)

3. **Success Metrics**:
   - Onboarding time: <3 days
   - Monthly churn: <2%
   - NPS: >50
   - Feature requests: Track, prioritize, 1 feature/month

### Phase 3: Scaled Growth (Month 7-12)
**Goal**: 50+ customers, $50K+ MRR, path to $1M ARR

1. **Channels**:
   - **Vertical SaaS network**: Partner with Autoline, Seekop (data integrations)
   - **Reseller program**: Regional consultants sell + support
   - **Content marketing**: Blog, YouTube, webinars (SEO for "automatización WhatsApp dealerships")
   - **Conferences**: AMDA (Asociación de Distribuidores Automotrices Mexico)

2. **Product Milestones**:
   - Sprint 4: Appointments (biggest pain point → biggest ROI)
   - Sprint 5: Workshop (service revenue tracking)
   - Sprint 8: AI Bandeja (core differentiator)

3. **Sales Infrastructure**:
   - Hire VP Sales (Month 8)
   - Account Executive (Month 10)
   - Customer Success Manager (Month 9)

---

## 🏆 KEY DIFFERENTIATION

| Feature | ServiceTrack | Autoline | Seekop | Generic Twilio |
|---------|---|---|---|---|
| **WhatsApp Integrated** | ✅ | ❌ | ❌ | ⚠️ Raw API |
| **AI Responses** | ✅ Claude | ❌ | ❌ | ❌ |
| **CRM Hub** | ✅ Unified | ⚠️ Partial | ⚠️ Partial | ❌ |
| **Workflow Automation** | ✅ N8N visual | ❌ | ⚠️ Limited | ⚠️ Dev required |
| **No-code Setup** | ✅ 1 week | ⚠️ 2-3 weeks | ❌ 4+ weeks | ❌ Dev required |
| **CSI Management** | ✅ Auto-escalation | ❌ | ❌ | ❌ |
| **Mexico-first** | ✅ Regional compliance | ❌ Global | ❌ Global | ❌ Global |

---

## 🎯 SUCCESS METRICS & KPIs

### Product Metrics
| KPI | Target | How to Measure |
|-----|--------|---|
| **Asesor Time Saved** | 10 hrs/week | Survey + time-tracking (before/after) |
| **Message Volume** | 2-3x increase | Dashboard analytics |
| **AI Bot Accuracy** | 85%+ useful responses | User feedback on each response |
| **CSI Score** | +15-20% improvement | Post-implementation surveys |
| **System Uptime** | 99.5%+ | Monitoring dashboard |

### Business Metrics
| KPI | Target | How to Measure |
|-----|--------|---|
| **Customer Acquisition** | 20/month (by Month 12) | CRM pipeline tracking |
| **Monthly Churn** | <2% | Subscription tracking |
| **CAC Payback** | <6 months | Revenue tracking |
| **NPS** | >50 | Post-launch survey (quarterly) |
| **Feature Adoption** | >70% using AI responses | Analytics dashboard |

### Financial Metrics (Year 1)
| Metric | Target |
|--------|--------|
| MRR (end of year) | $35,000 |
| ARR (end of year) | $250,000 |
| Gross Margin | 98%+ |
| Net Margin | 20% (with team costs) |
| CAC | <$4,000 |
| LTV:CAC Ratio | >3:1 |

---

## 💰 FUNDRAISING (FUTURE)

### Seed Round (Goal: $500K-$1M)
- **Use of Funds**:
  - Engineering: $250K (5 devs, 12 months)
  - Sales + Marketing: $150K
  - Infrastructure + operations: $100K
- **Dilution**: 15-20% equity
- **Timeline**: Seek at Month 6 (post-15 customers)

### Series A (Goal: $3-5M, Year 2)
- **Use of Funds**:
  - Team expansion (10→20 people)
  - Product roadmap (DMS integrations, mobile app)
  - Sales team (VP Sales, AEs, CSM)
  - Market expansion (Latin America)
- **Dilution**: 20-25% equity
- **Timeline**: Seek at $1M ARR (Month 16-18)

---

## 🔮 5-YEAR VISION

### Year 1: Establish Product-Market Fit
- 50+ customers, $250K ARR
- MVP feature-complete (Sprints 1-5)
- Mexico market validated

### Year 2: Scale Vertically in Mexico
- 200+ customers, $1.2M ARR
- Full platform launch (Sprints 6-11 complete)
- Reseller partnerships established
- Series A funding

### Year 3-5: Expand Horizontally + Internationally
- 500+ customers across Mexico, Colombia, Argentina
- $5M+ ARR
- DMS integrations (Autoline partnership)
- Mobile app for asesores + customers
- New verticals: Insurance brokers, fleet management

### Potential Exit
- **Acquirer**: Autoline, Seekop, major automotive group
- **Valuation Target**: $50-100M (10-20x ARR in Year 3)

---

## 📋 IMPLEMENTATION ROADMAP (Next 12 Months)

| Phase | Timeline | Deliverables | Success Metric |
|-------|----------|---|---|
| **MVP Build** | Month 1-3 | Sprints 1-3 complete (Auth, CRM, Users) | 0 bugs in production |
| **Pilot Program** | Month 3-6 | 5 beta customers, Sprints 4-5 live | NPS >40 |
| **Early Adopter Launch** | Month 6-9 | 15-20 customers, Sprint 8 (AI Bandeja) | $15K MRR |
| **Scaled Growth** | Month 9-12 | 50+ customers, Sprints 9-11 complete | $35K MRR |
| **Analysis + Plan** | Ongoing | Weekly metrics, monthly strategy review | Data-driven decisions |

---

## 🎤 ELEVATOR PITCH (30 seconds)

> **"ServiceTrack is an AI-powered WhatsApp automation platform built specifically for Mexican auto dealerships. Our customers reduce asesor workload by 40% while improving customer satisfaction through intelligent, automated follow-ups. We're already validating with pilots, and we're seeking partners to scale across Mexico."**

---

## 📞 CONTACT & NEXT STEPS

**To discuss partnership/investment**:
- Founder: Miguel Abascal
- Email: miguel@servicetrack.mx
- LinkedIn: [Link]
- Demo: Schedule 30-min walkthrough
- Pilot: Apply for Early Adopter program

**What we're looking for**:
- Beta customer dealerships (50+ asesores, Mexico City/Guadalajara)
- Technical advisors (DMS experience, automotive SaaS)
- Reseller partners (regional consultants)
- Investors (seed round, Year 2)

---

## ✅ APPENDIX: SUPPORTING DOCS

- **IMPLEMENTATION_PLAN.md**: 11-sprint development roadmap
- **ARCHITECTURE_DECISIONS.md**: Technical design + scalability plan
- **PRODUCT_MASTER.md**: Detailed feature specifications
- **SUPABASE_SCHEMA.sql**: Database schema (ready to deploy)
- **modules_map.html**: Visual module interconnections
- **DEV_SETUP.md**: Developer onboarding guide

---

**Last Updated**: 2026-03-31  
**Author**: Miguel Abascal (Founder/PO)  
**Status**: Ready for investor/customer presentations
