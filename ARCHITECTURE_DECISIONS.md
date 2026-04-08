# ARCHITECTURE_DECISIONS.md — ServiceTrack

**Last Updated**: 2026-03-31  
**Status**: In Design Phase

---

## 🏗️ ARCHITECTURAL PRINCIPLES

### 1. **Multi-Tenant by Design**
- **Decision**: Every record MUST belong to a grupo (tenant), never null
- **Rationale**: SaaS scaling; clean data isolation; no accidental cross-tenant leaks
- **Pattern**: `grupo_id` in every fact table + RLS policies that enforce `auth.uid()` → `usuario.grupo_id`

### 2. **RLS as Security Layer (Not Just Database)**
- **Decision**: PostgreSQL Row-Level Security (RLS) is authoritative; frontend permission checks are UX only
- **Rationale**: 
  - Database enforces access at query time
  - Impossible to bypass via API manipulation
  - Scales to 1M+ records per tenant
- **Helper Functions**:
  - `get_mi_grupo_id()` - current user's tenant
  - `get_mi_sucursal_id()` - current user's branch (null = global access)

### 3. **Event-Driven State Changes**
- **Decision**: PostgreSQL triggers fire side effects (folio generation, automated actions, cascades)
- **Rationale**:
  - Single source of truth: database logic applies everywhere (API, bulk import, direct DB access)
  - N8N orchestrates workflow across triggers
- **Examples**:
  - `t_crear_dueno_vehiculo` - auto-creates Dueño on vehicle insert
  - `crear_queja_por_csi` - auto-escalates low CSI scores to Atención a Clientes

### 4. **3-Tier Permission Model**
- **Level 1**: Roles (grupo-wide: admin, asesor, gerente, etc.)
- **Level 2**: Granular per-module (can_ver, can_crear, can_editar, can_eliminar, can_exportar)
- **Level 3**: Per-sucursal overrides (usuario_roles.sucursal_id)
- **Level 4**: Individual user overrides (usuario_permisos_override)
- **Rationale**: Supports agile permission tweaks without schema changes; scales to complex orgs

### 5. **Hub-and-Spoke: CRM as Central Hub**
- **Decision**: CRM module is the single source of truth for clientes + vehículos + actividades
- **All other modules reference CRM**:
  - Citas links to cliente → vehículo → asesor
  - Taller links to cliente → vehículo
  - Ventas links to cliente → oportunidad
  - Atención a Clientes links to cliente → queja
- **Rationale**: Prevents data silos; 360-degree customer view; single reconciliation point

### 6. **Separated Concerns: Quejas ≠ CSI**
- **Decision**: CSI (encuestas, scoring) is separate from Atención a Clientes (quejas, escalación)
- **Link**: Trigger `crear_queja_por_csi` bridges them: low score → auto-queja
- **Rationale**:
  - CSI is metrics-driven (NPS, satisfaction trends)
  - Atención a Clientes is action-driven (resolve complaints, track SLA)
  - Different workflows, different stakeholders

### 7. **N8N as Orchestration Layer**
- **Decision**: All time-based automations (reminders, escalations, periodic messages) run in N8N, not PostgreSQL
- **Rationale**:
  - Easier to test, pause, modify
  - Integrates WhatsApp Business API, Gmail, Outlook natively
  - Avoids complex scheduling in triggers
  - Audit trail of what ran when
- **Flows**:
  - F03 Recordatorios: 24h + 2h antes automático
  - F04 No-show recovery: bot WA con reagendamiento
  - CSI envío: auto-send 1-3 days post-event
  - Escalación >24h: notificar gerente

### 8. **Claude API for Intelligent Messaging**
- **Decision**: Bandeja unified + Claude API generates intelligent responses
- **Rationale**:
  - Reduces asesor workload (bot handles 60% of inquiries)
  - Maintains brand voice consistency
  - Escalates complex issues to humans
  - Audit trail: every response logged
- **Scope**: Bandeja (Sprint 8) generates answers for FAQ, status updates, confirmations; escalates edge cases

### 9. **Verification & Service Tracking in CRM**
- **Decision**: Vehicle verification (placa, VIN, technical state) and service intervals live in vehiculos table
- **Fields**:
  - `fecha_verificacion`, `proxima_verificacion`, `estado_verificacion` (ENUM: vigente/por_vencer/vencida)
  - `intervalo_servicio_meses` (default 6), `proxima_servicio` (calculated)
  - `km_garantia`, `fecha_garantia_fin`, `garantia_ext_inicio`, `garantia_ext_fin`
- **Rationale**: Single source of truth; triggers alerts in Citas + Seguros modules

### 10. **No Inventory Management**
- **Decision**: Refacciones module is catalog + pricing only, no warehouse/stock tracking
- **Rationale**: Most dealerships outsource parts procurement; ServiceTrack focuses on labor + services
- **Scope**: Maestro partes (SKU, category, pricing) → Cotizaciones (select parts, calculate margin) → OT

---

## 🛠️ TECHNOLOGY RATIONALE

| Component | Choice | Why |
|-----------|--------|-----|
| **Frontend** | Next.js 14+ | App Router, Server Components, streaming; React ecosystem mature for automotive UX |
| **Backend** | Supabase (managed PostgreSQL) | RLS built-in; Auth + realtime; scales to millions of records; GDPR-compliant |
| **Auth** | Supabase Auth | Multi-tenant aware; JWTs; password reset, MFA ready |
| **UI** | shadcn/ui | Accessible, headless components; Tailwind-native; zero vendor lock-in |
| **Realtime** | Supabase Realtime (websockets) | Kanban drag-drop, live notifications; built on PostgreSQL LISTEN/NOTIFY |
| **Workflow** | N8N (self-hosted or cloud) | Low-code, visual; native WhatsApp, Gmail, Outlook; webhook triggers |
| **AI** | Claude API (Anthropic) | Reasoning + reliability; can follow complex brand rules; accessible via REST |
| **Storage** | Supabase Storage (S3-compatible) | Signed URLs for docs/photos; RLS-aware |
| **Messaging** | WhatsApp Business API | ~95% open rate in Mexico; native integration in N8N |

---

## 🗂️ SCHEMA DESIGN PATTERNS

### Vehicle-Person Relationship
```sql
vehiculo_personas (
  vehiculo_id → vehiculos,
  cliente_id → clientes,
  rol_vehiculo ENUM(dueno/conductor/otro),
  PRIMARY KEY (vehiculo_id, cliente_id)
)
-- Constraint: cada vehiculo MUST have ≥1 dueno
-- Trigger t_validar_dueno_vehiculo prevents deletion of last owner
```

### CSI → Queja Bridge
```sql
-- Trigger: cuando csi_promedio ≤ score_alerta
CREATE TRIGGER crear_queja_por_csi
  AFTER INSERT/UPDATE ON csi_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION fn_crear_queja_por_csi();
  
-- Result: auto-creates queja in Atención a Clientes
-- Link: csi_envios.queja_id ← quejas.id
```

### Permission Evaluation (Pseudocode)
```javascript
// Frontend/API must evaluate in this order:
1. Query DB with RLS: returns only data user can see
2. Check usuario_roles for this usuario + sucursal
3. Lookup rol_permisos for the modulo
4. Override with usuario_permisos_override if exists
5. Return {puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar}
```

### Folio Generation (Atención a Clientes)
```sql
-- Trigger on queja INSERT:
folio = 'AC-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(NEW.numero_folio::TEXT, 4, '0')
-- Example: AC-2026-0042
```

---

## 🔐 SECURITY ARCHITECTURE

### Secret Management
```env
# .env.local (NEVER commit)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJ... (public, safe in frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (secret, backend only)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
CLAUDE_API_KEY=...
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
N8N_WEBHOOK_SECRET=...
```

### Input Validation Boundaries
- **Frontend**: Basic UX validation (required fields, format)
- **API Route**: Schema validation (zod/superstruct) before DB operations
- **Database**: NOT NULL constraints, CHECK enums, foreign keys, RLS policies
- **Never Trust**: User input, external API responses, imported files

### Rate Limiting
- **API routes**: 100 req/min per user_id (via Supabase Functions or Next.js middleware)
- **WhatsApp webhook**: 1000 msg/min per número (handled by WhatsApp Business API)
- **N8N flows**: dedup by (cliente_id, tipo, últimas 5 min) to prevent duplicate messages

---

## 📊 DATA MODELING DECISIONS

### Why vehiculo_personas (Not Flat vehicles_owners)
- **Rationale**: 1 vehicle can have 2-5 persons (owner, driver, spouse, fleet manager)
- **Avoids**: Duplicate vehicle records or multi-valued columns
- **Enables**: "Filter vehicles by owner", "Track all persons in a vehicle", "Notifications to all owners"

### Why separate csi_encuestas vs csi_envios vs csi_respuestas
- **csi_encuestas**: Template (reusable per module)
- **csi_envios**: Instance (sent to 1 cliente on 1 date) — tracks token, response status, SLA
- **csi_respuestas**: Answers (many answers per envio)
- **Rationale**: Enables A/B testing encuestas, tracking partial responses, audit trail

### Why usuario_permisos_override (Not Just usuario_roles)
- **Rationale**: Sometimes asesor X should see module Y only in sucursal Z, without creating a new role
- **Avoids**: Explosion of roles (would need 100+ roles in large org)
- **Scales**: Add/remove permissions in seconds, not hours

---

## 🚀 PERFORMANCE & SCALABILITY

### Indexing Strategy
```sql
-- CRM hotspots
CREATE INDEX idx_clientes_grupo_whatsapp ON clientes(grupo_id, whatsapp);
CREATE INDEX idx_clientes_grupo_vin ON clientes(grupo_id, vin);
CREATE INDEX idx_vehiculos_cliente_id ON vehiculos(cliente_id);
CREATE INDEX idx_citas_estado ON citas(estado, sucursal_id) WHERE activa = true;

-- CSI
CREATE INDEX idx_csi_envios_estado ON csi_envios(estado) WHERE respondido_at IS NULL;
CREATE INDEX idx_csi_respuestas_envio ON csi_respuestas(envio_id);

-- Atención a Clientes
CREATE INDEX idx_quejas_estado_sla ON quejas(estado, sucursal_id) WHERE estado != 'cerrada';

-- Taller
CREATE INDEX idx_ordenes_trabajo_estado ON ordenes_trabajo(estado, sucursal_id);
CREATE INDEX idx_lineas_ot_estado ON lineas_ot(ot_id, estado);

-- Citas
CREATE INDEX idx_citas_sucursal_fecha ON citas(sucursal_id, fecha_cita) WHERE estado != 'no-show';
```

### Query Optimization
- **Avoid**: N+1 queries (always use JOINs or batch fetch)
- **Paginate**: All list endpoints default `LIMIT 50`
- **Cache**: Maestro partes (refresh daily), Roles (invalidate on change)
- **Monitor**: New Relic / Datadog APM for slow queries

### Horizontal Scaling
- **Frontend**: Vercel edge caching (default)
- **Database**: 
  - Supabase auto-scales read replicas
  - pg_partman for tables >100M rows (citas, mensajes_unificados)
- **N8N**: Self-hosted with horizontal worker nodes

---

## 🔄 DATA CONSISTENCY & INTEGRITY

### Foreign Key Rules
- All `cliente_id` references have `ON DELETE RESTRICT` (no orphaning)
- All `grupo_id` references have `ON DELETE RESTRICT` (multi-tenant isolation)
- All `usuario_id` references have `ON DELETE RESTRICT` (audit trail integrity)

### Atomicity Guarantees
- Supabase transactions (BEGIN/COMMIT) wrap:
  - OT creation + auto-création líneas + inventory deduction
  - Queja creation + auto-notification setup
  - Cita confirmation + asesor assignment + WA send
- **Never partial success**: Either all or nothing

### Idempotency
- N8N webhook handlers are idempotent (check existence before insert)
- WhatsApp webhook retries up to 3x; we deduplicate by `webhook_id + timestamp`
- CSV imports: skip duplicates by (empresa_id, cliente_whatsapp)

---

## 🛣️ API DESIGN (REST Conventions)

### Endpoint Patterns
```
POST   /api/clientes                    — Create
GET    /api/clientes?grupo_id=X&page=1 — List (paginated)
GET    /api/clientes/:id                — Read
PATCH  /api/clientes/:id                — Update (partial)
DELETE /api/clientes/:id                — Delete
POST   /api/clientes/:id/vehiculos      — Nested create
```

### Response Envelope
```json
{
  "success": true,
  "data": {...},
  "error": null,
  "meta": { "page": 1, "total": 150, "limit": 50 }
}
```

### Error Codes
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Missing JWT
- `403 Forbidden` - RLS denied access
- `404 Not Found` - Resource missing
- `409 Conflict` - Unique constraint violated
- `429 Too Many Requests` - Rate limit
- `500 Internal Server Error` - Bug

---

## 🧪 TESTING STRATEGY

### Unit Tests (40% coverage)
- Permission evaluation logic
- CSV parsers
- Utility functions (folio generators, date calculators)

### Integration Tests (30% coverage)
- RLS policies (can user X see cliente Y?)
- Trigger side effects (create vehicle → auto-dueno?)
- API endpoints (POST /clientes with invalid data → 400?)

### E2E Tests (20% coverage)
- Full workflow: create cliente → assign asesor → create cita → check-in → OT created
- CSI flow: OT closes → CSI sent → response received → score triggers queja
- Bandeja: incoming WA message → Claude API generates response → asesor approves → send

### Performance Tests (10% coverage)
- Bulk import 10k citas (must complete <5s)
- 100 concurrent Kanban drag-drop (no latency spike)
- CSI query with 1M+ respuestas (<2s response)

---

## 📋 MIGRATION STRATEGY

### Phase 1: Schema Creation (Sprint 1)
- Run `SUPABASE_SCHEMA.sql` on Supabase
- Enable RLS on all tables
- Create roles/policies
- Seed: admin user, default group

### Phase 2: Test Data (Sprint 2-3)
- Seed 10 empresas, 100 clientes, 200 vehículos
- Create test roles (admin, asesor, gerente)
- Generate sample citas, OTs

### Phase 3: Production Migration (Pre-launch)
- Backup existing dealership system
- Extract cliente/vehículo data
- CSV import with deduplication
- Validation sweep (missing VINs, phone duplicates)
- Parallel run (2 weeks: new system + old system)
- Cutover

---

## 🚨 RISK MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| RLS policy bug leaks data | Low | Critical | Audit early (Sprint 1), penetration test pre-launch |
| N8N flow fails silently | Medium | High | Monitoring alerts, dead-letter queue, retry with backoff |
| Claude API rate limit | Low | Medium | Implement queue in N8N, fallback template responses |
| WhatsApp API webhook delay | Low | High | Message timestamps; client polls for delivery status |
| Supabase downtime | Very Low | Critical | Standby pg instance in AWS; RTO/RPO <1h documented |
| CSV import duplicates data | Low | High | Dedupe on (empresa_id, cliente_whatsapp, vin) |

---

## 🎯 FUTURE-PROOFING

### Extensibility Points
- **New Modules**: Follow CRM hub pattern; every module links to cliente/vehículo/asesor
- **New Fields**: Add columns without breaking RLS (explicit nullability)
- **New Integrations**: N8N flows (no code changes needed)
- **New Reports**: ReportBuilder component (drag-drop, no SQL)
- **AI Enhancements**: Claude API version upgrades, custom prompts per module

### Potential 12+ Sprints
- **Sprint 12**: Configuration module (bot scripts, schedules, escalation rules)
- **Sprint 13**: Central dashboard (all KPIs + drill-down)
- **Sprint 14**: DMS integration (Autoline, Seekop, ClearMechanic)
- **Sprint 15**: Mobile app (native iOS/Android for asesor + cliente)
- **Sprint 16**: Inventory module (if market demands)
- **Sprint 17**: Payment processing (stripe/conekta for parts invoicing)

---

## ✅ SIGN-OFF

**Architecture Owner**: Miguel Abascal (Founder/PO)  
**Review Date**: 2026-03-31  
**Status**: Approved for Sprint 1 Implementation  
**Next Review**: Post-Sprint 1 (validate RLS, auth, performance)
