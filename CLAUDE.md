# CLAUDE.md — ServiceTrack
## ⚠ NO MODIFICAR ESTE ARCHIVO sin instrucción explícita del usuario
## Plataforma SaaS de Gestión de Servicio Postventa Automotriz

Este archivo es la ÚNICA fuente de verdad para Claude Code.
Lee también: PRODUCT_MASTER.md · SUPABASE_SCHEMA.sql · TECH_STACK.md · N8N_WORKFLOWS.md · INSTRUCCIONES_PROYECTO_CLAUDE.md

---

## IDENTIDAD DEL PROYECTO

- **Nombre**: ServiceTrack (nombre de trabajo — definir nombre comercial al terminar)
- **Repo**: github.com/miabascacal/servicetrack
- **Deploy**: servicetrack-one.vercel.app
- **Tipo**: SaaS vertical automotriz — gestión de postventa para concesionarios en México
- **Stack**: Next.js 14 + TypeScript + TailwindCSS + Supabase + Claude API + Vercel
- **Automatizaciones**: Código nativo Next.js — Meta Cloud API (WA) + Resend (email) + Vercel Cron Jobs
- **DMS piloto**: Autoline (exporta CSV/Excel)
- **Horario del bot**: 8:00 AM – 7:30 PM hora México (mensajes fuera de horario se encolan)
- **WhatsApp-first**: toda comunicación con el cliente es por WA como canal principal

---

## ESTADO ACTUAL DEL DESARROLLO

### ✅ MÓDULOS CONSTRUIDOS Y FUNCIONALES

| Módulo | Rutas | Estado |
|--------|-------|--------|
| CRM — Clientes | `/crm/clientes`, `/crm/clientes/[id]`, `/nuevo`, `/editar` | ✅ Funcional |
| CRM — Empresas | `/crm/empresas`, `/crm/empresas/[id]`, `/nuevo`, `/editar` | ✅ Funcional |
| CRM — Vehículos | `/crm/vehiculos`, `/crm/vehiculos/[id]`, `/nuevo`, `/editar` | ✅ Funcional |
| Citas | `/citas` (kanban), `/citas/[id]`, `/citas/nuevo` | ✅ Funcional |
| Taller / OTs | `/taller` (kanban), `/taller/[id]`, `/taller/nuevo` | ✅ Construido |
| Usuarios | `/usuarios`, `/usuarios/roles`, `/usuarios/roles/nuevo` | ✅ Construido |
| Refacciones | `/refacciones/partes`, cotizaciones | ✅ Construido |
| Bandeja / Automatizaciones | `/bandeja/automatizaciones` | ✅ Construido |
| Configuración | `/configuracion/whatsapp`, `/configuracion/email` | ✅ Funcional |
| Reportes, Ventas, CSI, Seguros, Atención | rutas base | ⬜ Vacíos (placeholder) |

### ✅ AUTOMATIZACIONES CONSTRUIDAS (código nativo Next.js)

| Capa | Herramienta | Archivo |
|------|-------------|---------|
| WhatsApp | Meta Cloud API (WhatsApp Business API) | `lib/whatsapp.ts` |
| Email | Resend | `lib/email.ts` |
| Cron (recordatorios) | Vercel Cron Jobs | `vercel.json` + `app/api/cron/recordatorios-citas/route.ts` |
| Disparadores | Next.js Server Actions | `app/actions/citas.ts` |

### ✅ EVENTOS AUTOMÁTICOS ACTIVOS

| Evento | WhatsApp | Email |
|--------|----------|-------|
| Cita confirmada | ✅ | ✅ |
| Cita cancelada | ✅ | ✅ |
| Recordatorio 24h (cron 9AM) | ✅ | ✅ |

---

## PENDIENTES INMEDIATOS (para activar las automatizaciones)

### Variables de entorno — configurar en Vercel
```env
RESEND_API_KEY=           # API key de resend.com — para activar emails
CRON_SECRET=              # cualquier string largo — para proteger el cron job
RESEND_FROM_EMAIL=        # email desde el que se envían las notificaciones
```

### Migraciones pendientes en Supabase
- Ejecutar `supabase/migrations/002_email_config.sql`
- Ejecutar `supabase/migrations/003_ai_foundation.sql` (Sección 1, luego Sección 2 en pasada separada)

### WhatsApp Business API (Meta) — proceso largo
- Requiere cuenta Meta Business verificada
- Número de teléfono dedicado
- Proceso de aprobación Meta (puede tardar días)

### Bugs / pendientes de desarrollo
- [ ] Búsqueda global — mostrar "Crear nuevo" si no hay resultados
- [ ] Vincular vehículo — preguntar empresa al vincular
- [ ] Vista usuarios — mostrar estado de invitación
- [ ] OT — verificar flujo completo — nunca se probó después de los fixes de estado
- [ ] Módulos vacíos — Ventas, CSI, Seguros, Reportes, Atención

---

## Estado actual — Implementación y mensajería

### Sprint 8 — estado por componente

| Componente | Estado |
|---|---|
| WhatsApp saliente (`lib/whatsapp.ts`) | ✅ Operativo — persiste en `mensajes` y `wa_mensajes_log` |
| `lib/threads.ts` — resolución de hilos | ✅ Operativo — maneja race conditions |
| `conversation_threads` | ✅ Tabla activa — se crea automáticamente con cada envío saliente |
| `mensajes` | ✅ Fuente de verdad conversacional — reemplaza a `wa_mensajes_log` para lógica nueva |
| `wa_mensajes_log` | 🔄 Legacy — conservada como log técnico de bajo nivel. No usar para lógica nueva |
| Bandeja UI | 🔄 En desarrollo — actualmente usa datos mock. No conectada a Supabase |
| Webhook WhatsApp (recepción) | ⬜ Pendiente — Sprint 8 Fase 2 |
| Flush de `outbound_queue` (cron) | ⬜ Pendiente |
| Clasificador de intención IA | ⬜ Pendiente (`lib/ai/classify-intent.ts`) |
| Detector de sentimiento | ⬜ Pendiente (`lib/ai/detect-sentiment.ts`) |

### Decisiones de arquitectura clave (Sprint 8)

- **`mensajes` es la fuente de verdad.** Todo mensaje nuevo (saliente e, en Fase 2, entrante) se persiste en `mensajes`.
- **`wa_mensajes_log` es legacy.** Solo se conserva como log técnico de la llamada a la API de Meta. No construir lógica nueva sobre esta tabla.
- **Webhook pendiente.** Hasta que se implemente `app/api/webhooks/whatsapp/route.ts`, no hay recepción de mensajes WA. El canal es unidireccional saliente.
- **Bandeja con mock.** La UI en `/bandeja/automatizaciones` muestra datos de demostración, no datos reales de Supabase.
- **Bot apagado por defecto.** `ai_settings.activo = FALSE` — requiere habilitación explícita de admin.
- **`message_count` sin incremento.** El contador denormalizado en `conversation_threads` no se actualiza aún — pendiente de trigger o RPC en Fase 2.
- **`message_source`** usa: `customer`, `agent` (humano), `agent_bot` (bot automático), `system`, `import`. Nunca `agent_manual`.

---

## Documentación operativa

| Documento | Ruta | Propósito |
|---|---|---|
| IMPLEMENTATION_RUNBOOK.md | `docs/IMPLEMENTATION_RUNBOOK.md` | Runbook técnico completo para desplegar el sistema en clientes reales. Cubre infraestructura, variables de entorno, configuración por cliente/sucursal, checklists de go-live, validaciones técnicas, troubleshooting y glosario. |

---

## ARQUITECTURA DE 6 MÓDULOS

```
CRM (corazón) ← todos los módulos leen y escriben aquí
├── CITAS        — Kanban 5 columnas · timer 15 min · importar archivos
├── TALLER       — OTs · seguimiento · piezas · CSI · venta perdida · escalación 3 niveles
├── REFACCIONES  — maestro partes · cotización PDF OEM · seguimiento bot
├── VENTAS       — pipeline Kanban · leads · cruce servicio→venta
└── BANDEJA+IA   — WA · FB · IG · Email unificados · bot activo · supervisión
```

---

## CAPA IA — SPRINT 8 (migración 003 lista, pendiente de ejecutar)

### Tablas creadas por 003_ai_foundation.sql

| Tabla | Propósito |
|-------|-----------|
| `ai_settings` | Configuración IA por sucursal (1:1). Kill switch, umbrales, modelos, horario bot. `activo = FALSE` por defecto — se activa deliberadamente. |
| `conversation_threads` | Hilo de conversación por cliente+canal+contexto. Permite múltiples hilos activos si son de contextos distintos. Los índices parciales únicos previenen race conditions. |
| `outbound_queue` | Cola de mensajes diferidos. Casos: fuera de horario, aprobación manual requerida, reintentos por fallo de API. |
| `automation_logs` | Auditoría append-only de toda automatización ejecutada. Prerequisito para debugging y monitoreo desde día 1. |

### Columnas agregadas a mensajes (ALTER TABLE)

`thread_id` · `message_source` · `wa_message_id` · `ai_intent` · `ai_intent_confidence` · `ai_sentiment` · `processing_status`

### Reglas clave de la capa IA

- **`contexto_id` en `conversation_threads`**: FK lógica SIN constraint declarado. Puede apuntar a `citas`, `ordenes_trabajo`, `cotizaciones` o `leads` según `contexto_tipo`. La integridad la mantiene el código.
- **Bot apagado por defecto**: `ai_settings.activo = FALSE`. Requiere acción explícita de admin para encenderlo.
- **INSERT a `outbound_queue` y `automation_logs`**: solo desde service role (`createAdminClient()`). Nunca desde componentes UI directamente.
- **Mensajes históricos**: `processing_status = NULL` (no entran a la cola IA). Solo mensajes nuevos post-migración tienen `processing_status = 'pending'`.
- **Unicidad de hilos activos**: enforced por índices parciales únicos en BD + validación en server action.

### Deuda técnica registrada — RLS por rol

Las policies de `ai_settings` y `outbound_queue` actualmente solo validan `sucursal_id`. La validación de rol (admin/gerente para modificar settings, encargadas para aprobar mensajes) se hace en server actions. **Endurecer con RLS por rol cuando se implemente Sprint 2 (usePermisos + middleware).**

### Pendiente para 004_ai_extended.sql

`cases` · `case_status_history` · `ai_logs` · `knowledge_base` · ALTER TABLE mensajes (case_id, ai_suggested_reply, ai_reply_sent) · ALTER TABLE clientes · ALTER TABLE citas · ALTER TABLE ordenes_trabajo

### Estado Sprint 8 — actualizado 2026-04-14

#### Fase 1 — Saliente → mensajes ✅ IMPLEMENTADA

| Componente | Estado |
|-----------|--------|
| `lib/threads.ts` — `getOrCreateThread()` | ✅ |
| `lib/whatsapp.ts` — thread + persist en `mensajes` | ✅ |
| `app/actions/citas.ts` — propaga `usuario_asesor_id` + contexto | ✅ |
| `supabase/migrations/004_messaging_adjustments.sql` | ✅ |
| Validación runtime con Meta | ⬜ Pendiente (sin WA API) |

**Bloqueante externo:** `wa_numeros` vacío — número de Meta no activo (problema con proveedor).
No es deuda de código. Acción: cuando exista número → poblar `wa_numeros` → smoke test.

#### Fase 2 — Webhook entrante (pendiente)

1. `app/api/webhooks/whatsapp/route.ts` — recibir mensajes entrantes de Meta
2. `lib/ai/classify-intent.ts` — clasificador con Claude Haiku
3. `lib/ai/detect-sentiment.ts` — detector de sentimiento
4. `app/api/cron/outbound-queue-flush/route.ts` — procesar cola de mensajes

#### Fase 3 — Bandeja real (prioridad activa)

- `app/(dashboard)/bandeja/page.tsx` — lista de conversaciones desde `conversation_threads`
- Conectar a `mensajes` + `clientes` — reemplazar mock data

---

## REGLAS DE DESARROLLO — OBLIGATORIAS

1. **Nunca romper funcionalidad existente** — solo agregar o mejorar
2. **TypeScript estricto** — prohibido usar `any`
3. **shadcn/ui** como base de todos los componentes UI
4. **TailwindCSS dark theme** — `#0d1117` como fondo base
5. **Supabase** para todo: auth, BD, storage, realtime, edge functions
6. **RLS activo** en todas las tablas desde el inicio — nunca desactivar
7. **Automatizaciones nativas** — código en `lib/` y `app/api/` — NO agregar n8n
8. **Claude API** para: clasificar mensajes, generar WA personalizados, sugerencias IA
9. Cada variable nueva lleva **comentario inline** explicando su propósito
10. Antes de enviar cualquier WA o email: **verificar horario del bot** (8am–7:30pm)

---

## REGLA PERMANENTE — DOCUMENTACIÓN Y SINCRONIZACIÓN

1. **Actualización obligatoria al cierre de cada tarea relevante.**
   Cada cambio en arquitectura, BD, flujos, integraciones externas, mensajería,
   IA, seguridad, despliegue o configuración operativa obliga a evaluar y actualizar
   los documentos afectados antes de dar la tarea por terminada.

2. **Documentos a revisar cuando aplique:**
   - `CLAUDE.md` — decisiones, estado actual, reglas de arquitectura
   - `docs/IMPLEMENTATION_RUNBOOK.md` — configuración, go-live, soporte
   - `PENDIENTES.md` — roadmap y prioridades si el cambio las altera
   - Documentos de arquitectura existentes
   - Manuales operativos o de usuario ya existentes

3. **No dar una tarea por terminada si dejó documentos desactualizados.**

4. **CLAUDE.md se mantiene ligero.**
   Solo contiene: decisiones clave, estado actual, reglas de arquitectura y
   referencias a documentación operativa. No duplica documentos largos.

5. **IMPLEMENTATION_RUNBOOK.md es el documento operativo detallado.**
   Cubre: infraestructura, variables de entorno, configuración por cliente/sucursal,
   checklists de go-live, validaciones técnicas, troubleshooting y glosario.
   → Ver `docs/IMPLEMENTATION_RUNBOOK.md`

6. **Dependencias externas pendientes se registran explícitamente.**
   Cuando un cambio quede bloqueado por validación externa (ej. Meta WhatsApp
   Business API, proveedor de número, OAuth de tercero), se documenta como
   `⬜ PENDIENTE — bloqueado por [dependencia]` en CLAUDE.md y en PENDIENTES.md.

7. **Nuevos runbooks o manuales se registran en CLAUDE.md.**
   Al crear un nuevo documento operativo, agregar su referencia en la sección
   "Documentación operativa" de CLAUDE.md.

---

## COLORES POR MÓDULO (usar siempre estos)

```typescript
const MODULE_COLORS = {
  crm:         '#3b82f6',  // azul
  citas:       '#1db870',  // verde
  taller:      '#8b5cf6',  // morado
  refacciones: '#f59e0b',  // ámbar
  ventas:      '#f43f5e',  // rojo
  bandeja:     '#06b6d4',  // cian
} as const

const THEME = {
  bg:       '#0d1117',
  surface:  '#161b22',
  surface2: '#1c2128',
  border:   '#21262d',
  text:     '#e6edf3',
  muted:    '#8b949e',
} as const
```

---

## FLUJOS CRÍTICOS DEL PRODUCTO

### 1. Timer 15 min — CITAS
- Cita importada → "Contacto pendiente" en agenda de encargada
- 15 min para llamar o enviar WA al cliente
- Si no actúa → sistema envía WA automático con nombre, fecha, hora, sucursal y link Google Maps
- CRM registra si lo hizo la encargada o el sistema

### 2. Pieza llega → encargada agenda cita
- Asesor registra llegada de pieza con 1 clic
- Bot WA al cliente con botón [Sí, quiero agendar]
- Cliente toca → Bot responde: "Perfecto, en breve te contactamos"
- CRM crea actividad urgente para encargada: WA + Email + agenda CRM + Outlook

### 3. CSI Post-servicio (48h)
- Archivo llega con condición: feliz | no_feliz
- Feliz → WA con link de reseña Google
- No feliz → Actividad urgente para MK + WA + Email + Outlook

### 4. Venta perdida → recuperación
- Cliente rechazó reparación → queda en "Venta Perdida"
- Bot WA con botón [Agendar servicio] a 30/60/90 días
- Si responde → actividad en agenda encargada + WA + Outlook

### 5. Escalación OT — 3 niveles
- 4h sin actualizar → WA al asesor
- +2h → WA al gerente
- +1h → Sistema actúa (WA al cliente con último estado)

---

## MODELO DE ACTIVIDADES (regla universal del CRM)

Toda actividad se vincula SIEMPRE a:
- `usuario_asignado_id` (obligatorio)
- `cliente_id` (obligatorio)
- `vehiculo_id` / `empresa_id` / `ot_id` / `cita_id` (según contexto)
- `outlook_event_id` (sync Outlook del usuario)

Vista "Actividades del cliente" — cronológica, filtrable, exportable.

---

## ESTRUCTURA DE CARPETAS

```
app/
├── (auth)/login/
├── (dashboard)/
│   ├── layout.tsx              — Sidebar + Topbar
│   ├── dashboard/
│   ├── crm/clientes|empresas|vehiculos/
│   ├── citas/
│   ├── taller/
│   ├── refacciones/
│   ├── ventas/                 — ⬜ placeholder
│   ├── bandeja/automatizaciones/
│   ├── configuracion/whatsapp|email/
│   ├── usuarios/roles/
│   └── reportes/               — ⬜ placeholder
├── seguimiento/[token]/        — página pública sin auth
└── api/
    ├── cron/recordatorios-citas/route.ts
    └── webhooks/whatsapp/

lib/
├── whatsapp.ts                 — Meta Cloud API
├── email.ts                   — Resend
└── supabase/

app/actions/
└── citas.ts                   — Server Actions disparadores

lib/
└── ai/                         — ⬜ pendiente Sprint 8 Fase 1b
    ├── types.ts
    ├── classify-intent.ts
    ├── detect-sentiment.ts
    └── prompts/
```

---

## VARIABLES DE ENTORNO COMPLETAS (.env.local y Vercel)

```env
# Supabase — ✅ configuradas en Vercel (All Environments)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API — ❌ FALTA en Vercel
ANTHROPIC_API_KEY=

# Email — Resend — ✅ configuradas en Vercel (mover a All Environments)
RESEND_API_KEY=               # ✅ creada 2026-04-13
RESEND_FROM_EMAIL=            # ✅ onboarding@resend.dev (temporal — cambiar al tener dominio)

# Cron Jobs — Vercel — ✅ configurada (mover a All Environments)
CRON_SECRET=                  # ✅ configurada 2026-04-13

# WhatsApp — Meta Cloud API
WA_PHONE_NUMBER_ID=           # ⬜ PENDIENTE — proceso de aprobación Meta
WA_ACCESS_TOKEN=              # ⬜ PENDIENTE
WA_VERIFY_TOKEN=              # ⬜ PENDIENTE

# Google Maps (para links en WA de citas)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Microsoft Graph API (Outlook Calendar sync)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
```

---

## REFERENCIAS DE DISEÑO

- **mockup_producto.html** — cómo se deben ver las 9 pantallas
- **crm_v4.html** — Workflow Studio con todos los flujos
- Abre en el browser antes de construir cualquier pantalla nueva

---

## PREGUNTAS FRECUENTES

**¿Cuándo enviar WA o email?**
Verificar horario bot (8am–7:30pm). Fuera de horario → guardar en cola.

**¿Cómo evitar duplicar clientes?**
Buscar por `whatsapp + sucursal_id` primero. Luego por `vin`. Solo crear si no existe.

**¿Dónde están los flujos completos?**
`PRODUCT_MASTER.md` — 26 flujos con pasos, bifurcaciones y KPIs.

**¿Dónde están las automatizaciones?**
`N8N_WORKFLOWS.md` — referencia de lógica (implementadas como código nativo en `lib/`).