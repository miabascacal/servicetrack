# CLAUDE.md — ServiceTrack
## ⚠ NO MODIFICAR ESTE ARCHIVO sin instrucción explícita del usuario
## Plataforma SaaS de Gestión de Servicio Postventa Automotriz

Este archivo es la guía de comportamiento y reglas de arquitectura para Claude Code.
Lee también: PRODUCT_MASTER.md · SUPABASE_SCHEMA.sql · TECH_STACK.md · N8N_WORKFLOWS.md · INSTRUCCIONES_PROYECTO_CLAUDE.md

---

## 📌 SOURCE OF TRUTH

El documento principal y único de planeación operativa del proyecto es:

> **`docs/WORKPLAN_CURRENT_STATE.md`**

Este documento contiene: estado actual validado, lo implementado, lo pendiente, roadmap por fases, riesgos, decisiones arquitectónicas (ADRs) y checklists de validación.

**Roadmap activo (ver WORKPLAN para detalle):**
- FASE 1.5 — Acceso multiusuario: invitaciones, recuperación de contraseña, estado de usuarios → **prioridad inmediata antes de cualquier feature nueva**
- FASE 2.2 — Mi Agenda con vista calendario (mes/semana/día)
- FASE 2.3 — Calendario operativo de Citas (disponibilidad al crear)
- FASE 4.4 — Calendario de Taller (pasada posterior separada)

**Reglas de uso obligatorio:**
- Antes de implementar, proponer cambios o diseñar features → leer el WORKPLAN.
- Si el WORKPLAN no está en contexto → pedirlo explícitamente antes de continuar.
- Después de cualquier análisis, decisión o implementación → indicar qué sección del WORKPLAN debe actualizarse.
- Los bugs, riesgos y decisiones detectados en chat deben integrarse al WORKPLAN antes de cerrar la tarea.

**Documentos complementarios que NO reemplazan al WORKPLAN:**
- `CLAUDE.md` — guía de comportamiento, reglas de arquitectura y convenciones de código. NO es plan operativo.
- `PENDIENTES.md` — historial de sprints, bugs legacy y lista de items pendientes. NO es el roadmap activo.
- `docs/IMPLEMENTATION_RUNBOOK.md` — onboarding de clientes reales, infraestructura, go-live. NO es plan de desarrollo.

---

## ⚠️ DOCUMENTATION RULES

- **NO crear nuevos documentos de planeación** — prohibido generar archivos tipo `ARCHITECT_REVIEW.md`, `PLAN_V2.md`, `ROADMAP_NEW.md` u otros análisis fuera del WORKPLAN.
- **TODO análisis, bug, decisión y mejora debe integrarse al WORKPLAN** — no dejar información solo en el chat.
- **No duplicar información entre documentos** — si algo ya está en el WORKPLAN, no repetirlo en CLAUDE.md ni en PENDIENTES.md.
- **CLAUDE.md se mantiene ligero** — solo reglas, convenciones y referencias. No estado de implementación.

---

## IDENTIDAD DEL PROYECTO

- **Nombre**: ServiceTrack (nombre de trabajo — definir nombre comercial al terminar)
- **Repo**: github.com/miabascacal/servicetrack
- **Deploy**: servicetrack-one.vercel.app
- **Tipo**: SaaS vertical automotriz — gestión de postventa para concesionarios en México
- **Stack**: Next.js 16 + TypeScript + TailwindCSS + Supabase + Claude API + Vercel
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
| Taller / OTs | `/taller` (kanban), `/taller/[id]`, `/taller/nuevo` | ✅ Construido — soporta numero_ot_dms + eventos internos en bandeja |
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
EMAIL_FROM=               # email desde el que se envían las notificaciones
```

### Migraciones pendientes en Supabase
- Ejecutar `supabase/migrations/002_email_config.sql` ⬜ pendiente
- `003_ai_foundation.sql` — ✅ ejecutada
- `004` a `008` — ✅ ejecutadas (mensajería, taller, DMS, ENUM estado_ot)
- `010` a `013` — ✅ ejecutadas (ventas/leads, CSI, seguros, workflow_studio)

### WhatsApp Business API (Meta) — proceso largo
- Requiere cuenta Meta Business verificada
- Número de teléfono dedicado
- Proceso de aprobación Meta (puede tardar días)

### Bugs / pendientes de desarrollo
- [ ] Búsqueda global — mostrar "Crear nuevo" si no hay resultados
- [ ] Vincular vehículo — preguntar empresa al vincular
- [ ] Vista usuarios — mostrar estado de invitación
- [ ] OT — verificar flujo completo — nunca se probó después de los fixes de estado
- [x] Ventas: kanban MVP + /ventas/nuevo ✅ Sprint 9
- [x] CSI: encuestas y envíos MVP ✅ Sprint 9
- [x] Seguros: pólizas + /seguros/nueva ✅ Sprint 9
- [x] Workflow Studio: CRUD de reglas ✅ Sprint 9
- [x] Reportes: KPIs reales de BD ✅ Sprint 9

### FASE 5 — Checklist de activación WhatsApp/IA (BLOQUEADO — dependencias externas)

Para activar el canal WhatsApp, en este orden exacto:

1. **Poblar `wa_numeros`** — INSERT con `sucursal_id`, `phone_number_id` y `access_token` del número aprobado por Meta
2. **Configurar `WA_VERIFY_TOKEN`** en Vercel → Settings → Environment Variables (All Environments)
3. **Configurar webhook en Meta Business** → App → WhatsApp → Configuration → Webhook URL: `https://servicetrack-one.vercel.app/api/webhooks/whatsapp` con el mismo `WA_VERIFY_TOKEN`
4. **Activar bot** → INSERT en `ai_settings` con `sucursal_id` de la sucursal, `activo = TRUE`
5. **Smoke test saliente** — desde citas, confirmar una cita y verificar que llega WA al cliente
6. **Implementar webhook entrante** — `app/api/webhooks/whatsapp/route.ts` (pendiente de código)

Ninguno de estos pasos requiere cambio de código (excepto el punto 6). Son configuración de infraestructura.

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
| Bandeja UI | 🟡 Conectada parcialmente a Supabase — usa `conversation_threads` + `mensajes`; pendiente madurez operativa |
| Webhook WhatsApp (recepción) | ⬜ Pendiente — Sprint 8 Fase 2 |
| Flush de `outbound_queue` (cron) | ⬜ Pendiente |
| Clasificador de intención IA | ⬜ Pendiente (`lib/ai/classify-intent.ts`) |
| Detector de sentimiento | ⬜ Pendiente (`lib/ai/detect-sentiment.ts`) |

### Decisiones de arquitectura clave (Sprint 8)

- **`mensajes` es la fuente de verdad.** Todo mensaje nuevo (saliente e, en Fase 2, entrante) se persiste en `mensajes`.
- **`wa_mensajes_log` es legacy.** Solo se conserva como log técnico de la llamada a la API de Meta. No construir lógica nueva sobre esta tabla.
- **Webhook pendiente.** Hasta que se implemente `app/api/webhooks/whatsapp/route.ts`, no hay recepción de mensajes WA. El canal es unidireccional saliente.
- **Bandeja parcial con datos reales.** `/bandeja` ya consume `conversation_threads` + `mensajes`; la deuda pendiente está en webhook entrante, composición real y validación operativa.
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

## CAPA IA — SPRINT 8 (migración 003 ya ejecutada)

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

### Decisiones clave — Taller + DMS (2026-04-15)

- **`ordenes_trabajo` tiene dos identificadores distintos:**
  - `numero_ot` = identificador interno ServiceTrack. Inmutable. Generado por `generarNumeroOT()`.
  - `numero_ot_dms` = identificador externo del DMS del cliente (Autoline, CDK, etc). Opcional, nullable.
  - Nunca reutilizar uno para el otro. Nunca guardar el número DMS en notas o metadata.
- **Pantallas que muestran `numero_ot` también deben mostrar `numero_ot_dms` cuando exista.**
  - Aplica a: lista de taller, detalle de OT, cualquier tarjeta o componente que renderice el número.
- **Taller genera eventos internos en mensajes/bandeja:**
  - OT creada → mensaje de sistema en hilo `canal='interno'` con `contexto_tipo='ot'`.
  - Cambio de estado → mensaje de sistema en el mismo hilo.
  - `processing_status = 'skipped'` — no pasan por el clasificador IA.
  - Visible en bandeja bajo filtro "Todos". Canal identificado como "Interno".
  - Implementado en `insertarEventoOT()` helper en `app/actions/taller.ts`.
  - Best-effort: errores en el evento NO fallan la operación principal de OT.
- **`conversation_threads.canal` ahora acepta `'interno'`** (migración 006).
- **`lib/threads.ts` — `ThreadCanal`** incluye `'interno'`.

### Decisiones clave — Sprint 9 (2026-04-15 → 2026-04-16)

- **ENUM `estado_ot`: valor canónico es `'en_proceso'`, no `'en_reparacion'`.**
  - Migración 008 ✅ ejecutada y validada en Supabase (2026-04-16). ENUM contiene: `recibido`, `diagnostico`, `en_proceso`, `listo`, `entregado`, `cancelado`.
  - `types/database.ts` → `EstadoOT` usa `'en_proceso'`.
  - `lib/ot-estados.ts` es la única fuente de verdad de transiciones y labels.
- **Crash `/taller` resuelto (2026-04-16):**
  - `app/(dashboard)/taller/page.tsx` — fallback defensivo en `ESTADO_CONFIG[row.estado]` + guard en `formatDateTime(row.created_at)`.
  - Requiere deploy a Vercel. No requiere migración.
- **Normalización a MAYÚSCULAS en server actions (campos de texto visibles):**
  - `nombre`, `apellido`, `apellido_2` de clientes → `.toUpperCase()` en `app/actions/clientes.ts`
  - `marca`, `modelo` de vehículos → `.toUpperCase()` en `app/actions/vehiculos.ts` (placa y VIN ya lo tenían)
  - `diagnostico` de OTs → `.toUpperCase()` en `app/actions/taller.ts`
  - NO aplica a: email, whatsapp, URLs, VIN, tokens, notas_internas, promesa_entrega
- **Cita "Abrir OT" también disponible en estado `en_agencia`** (antes solo en `show`).
  - `app/(dashboard)/citas/[id]/page.tsx` — condición: `(estado === 'en_agencia' || estado === 'show')`
- **Flujo contextual de nueva cita: "Crear cliente" cuando no hay resultados.**
  - `app/(dashboard)/citas/nuevo/page.tsx` — link a `/crm/clientes/nuevo?return_to=/citas/nuevo`
  - `app/(dashboard)/crm/clientes/nuevo/page.tsx` — lee `return_to` de searchParams
  - Al finalizar el wizard (vincular/crear vehículo, o saltar), redirige a `${return_to}?cliente_id=${id}` si `return_to` existe, si no al perfil del cliente.
- **Cita en `en_agencia` o `show` → bloque "Orden de Trabajo"** en detalle de cita:
  - Si hay OT vinculada (`cita_id = cita.id`) → muestra `numero_ot` + `numero_ot_dms` + link "Ver OT"
  - Si no hay OT vinculada → botón "Crear nueva OT" + lista de OTs existentes del mismo cliente/vehículo para vincular
  - Componente: `app/_components/citas/VincularOTCita.tsx`
  - Acción: `vincularOTCitaAction` en `app/actions/taller.ts` — valida sucursal+cliente+vehículo antes de actualizar `cita_id`
- **`updateOTAction` acepta `numero_ot_dms`** para edición posterior del identificador DMS.
- **`version` en creates de vehículo** — campo normalizado a MAYÚSCULAS en `createVehiculoAction` y `createVehiculoYVincularAction`.
- **Normalización MAYÚSCULAS — cobertura completa:**
  - Clientes: `nombre`, `apellido`, `apellido_2` — create y update
  - Empresas: `nombre` — create y update (ambas acciones)
  - Vehículos: `marca`, `modelo`, `version`, `color` — create y update (3 funciones)
  - OT: `diagnostico`, `numero_ot_dms` — create y update
  - NO normalizar: `email`, `whatsapp`, `notas_internas`, `promesa_entrega`, `tokens`
- **Trazabilidad de estado OT:** `updated_at` manejado por trigger `t_ordenes_trabajo_updated` (migration 005). **TODO pendiente:** agregar columna `updated_by` UUID en migración futura cuando se requiera auditoría por usuario.
- **`usuarios.id` = `auth.users.id`** — La tabla `usuarios` usa el UUID de auth como PK. NO existe columna `auth_user_id`. NUNCA hacer `.eq('auth_user_id', user.id)`. Siempre usar `ensureUsuario(supabase, user.id, user.email)` en server actions para obtener `sucursal_id` y `grupo_id`.
- **Modelo de roles:** `usuario_roles` NO tiene columna `sucursal_id`. El scoping de roles es por grupo (via `roles.grupo_id`) y por sucursal vía RLS (policy verifica que el `usuario_id` apunte a un usuario en `get_mi_sucursal_id()`). Al hacer query sobre `usuario_roles`, NUNCA seleccionar `sucursal_id`.
- **Asignación de roles:** usar `asignarRolAction(usuarioId, rolId)` y `removerRolAction(asignacionId)` en `app/actions/roles.ts`. La asignación valida que el rol pertenezca al mismo `grupo_id` del admin y que el usuario objetivo esté en la misma `sucursal_id`.
- **Origen de asesores en citas:** todos los usuarios con `activo=true` son elegibles como asesor de cita. No hay filtro por rol. Si en el futuro se quiere restringir a roles específicos, filtrar por `rol IN ('asesor_servicio', 'gerente')` en la query de la página `/citas/nuevo`.
- **`usuarios` NO tiene `grupo_id`** — grupo se resuelve via `sucursales → razones_sociales → grupos`. `ensureUsuario` ya maneja este join automáticamente.
- **`estado_lead` ENUM real** (BD): `nuevo, contactado, cotizado, negociando, cerrado_ganado, cerrado_perdido`. Usar siempre estos valores. NO usar `interesado`, `cotizacion`, `ganado`, `perdido`.
- **`csi_respuestas` score** — columna es `respuesta_numerica`, no `score`.

### Estado Sprint 8 — actualizado 2026-04-15

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

#### Fase 3 — Bandeja real (madurez operativa pendiente)

- `app/(dashboard)/bandeja/page.tsx` — ya lista conversaciones desde `conversation_threads`
- Pendiente: webhook entrante, composición real, validación manual y hardening operativo

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
   - `docs/WORKPLAN_CURRENT_STATE.md` — **PRIMERO SIEMPRE** — estado activo, roadmap, riesgos, ADRs
   - `CLAUDE.md` — si el cambio afecta reglas de arquitectura o convenciones
   - `docs/IMPLEMENTATION_RUNBOOK.md` — si el cambio afecta infraestructura, migraciones o go-live
   - `PENDIENTES.md` — si hay un item de historial que marcar como resuelto

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
EMAIL_FROM=                   # ✅ onboarding@resend.dev temporal o remitente del cliente

# Cron Jobs — Vercel — ✅ configurada (mover a All Environments)
CRON_SECRET=                  # ✅ configurada 2026-04-13

# WhatsApp — Meta Cloud API
# `WA_PHONE_NUMBER_ID` y `WA_ACCESS_TOKEN` viven por sucursal en tabla `wa_numeros`
WA_VERIFY_TOKEN=              # ⬜ PENDIENTE — solo requerido al implementar webhook

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
