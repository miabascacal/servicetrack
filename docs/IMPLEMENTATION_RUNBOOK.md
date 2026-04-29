# IMPLEMENTATION_RUNBOOK.md — ServiceTrack

> Documento técnico y operativo para la implementación de ServiceTrack en clientes reales.
> Última revisión: 2026-04-28
> Sprint de referencia: Sprint 9 cerrado (estado OT en_proceso, crash /taller resuelto, flujo contextual Citas parcial)

---

> Hotfix 2026-04-28 P0.6: `/citas` y `/agenda` restauradas con admin client + ensureUsuario (causa raiz: RLS get_mi_sucursal_id() = NULL). BotIA siempre crea pendiente_contactar. Placa ask-once. Guard de duplicados por cliente+fecha.

> Alcance operativo P0.6:
> - `/citas` (4 vistas) y `/agenda` ahora usan `createAdminClient()` + `ensureUsuario()` + `.eq('sucursal_id', sucursal_id)` explícito.
> - BotIA: todos los paths de booking inicial pasan `confirmada:false`. Solo `confirmarCitaBot` transiciona a `confirmada`.
> - Placa ask-once: si ya estamos en `step=capturar_placa` y el cliente no da placa, `placa_pendiente=true` y se avanza.
> - `crearCitaBot`: nueva guarda de duplicados por cliente+fecha antes del gate de horario.
>
> **Troubleshooting: si `/citas` sigue mostrando 0 en produccion**, verificar que el usuario tiene fila en tabla `usuarios` con `sucursal_id` poblado. Correr en Supabase SQL: `SELECT id, sucursal_id FROM usuarios WHERE id = '<auth.uid del usuario>'`.

## 1. Propósito del documento

Este runbook describe los pasos técnicos, configuraciones y validaciones necesarios para desplegar ServiceTrack en un cliente nuevo. Cubre infraestructura, dependencias externas, datos por cliente y por sucursal, y el proceso de go-live.

No es un manual comercial. Es un documento de operación para quien ejecuta la implementación.

**Regla operativa permanente:** cualquier cambio en configuración técnica externa debe documentarse el mismo día en los manuales vigentes del proyecto. Esto incluye, como mínimo, variables de entorno, URLs de Supabase Auth, dominios/redirects, tokens de webhook, configuración de Resend y dependencias equivalentes de terceros.

---

## 2. Estado actual del producto

| Componente | Estado |
|---|---|
| CRM (Clientes, Empresas, Vehículos) | ✅ Operativo |
| Citas (Kanban) | ✅ Operativo |
| Taller / OTs | ✅ Operativo — `numero_ot_dms` implementado; estados OT canónicos (`en_proceso`); eventos internos activos; crash `/taller` resuelto; vincular OT desde cita funcional |
| Refacciones | ✅ Construido |
| Bandeja / Automatizaciones (UI) | 🟡 Parcialmente operativa — `/bandeja` usa `conversation_threads` + `mensajes`; WhatsApp del cliente visible en header del chat; webhook implementado pero no activo; sin composición real ni validación operativa |
| BotIA Citas — crear cita confirmada | 🟡 Código completo (commit 713e605). Requiere: migración 019 ejecutada + `ai_settings.escalation_assignee_id` configurado. Demo pendiente de validación. |
| WhatsApp — canal saliente | ✅ Operativo (`lib/whatsapp.ts`) — bloqueado por `wa_numeros` sin número activo |
| WhatsApp — canal entrante (webhook) | 🟡 Código completo (`app/api/webhooks/whatsapp/route.ts`) — no activo: requiere deploy + `WA_VERIFY_TOKEN` + Meta config |
| Email (Resend) | ✅ Operativo (`lib/email.ts`) |
| Cron — recordatorios 24h | ✅ Operativo (`vercel.json` + `/api/cron/recordatorios-citas`) |
| Cron — flush outbound_queue | 🟡 Código completo (`/api/cron/outbound-queue-flush`) — no activo: requiere deploy |
| IA — clasificador de intención | 🟡 Código completo (`lib/ai/classify-intent.ts`) — no activo: `ai_settings.activo=FALSE` |
| IA — detector de sentimiento | 🟡 Código completo (`lib/ai/detect-sentiment.ts`) — no activo: mismo control |
| Cola de mensajes diferidos (outbound_queue) | ✅ Tabla en BD + lógica de flush implementada — no activa: requiere deploy |
| Configuración WhatsApp por sucursal | ✅ Operativo (`/configuracion/whatsapp`) |
| Módulos placeholder (Ventas, CSI, Seguros, Reportes, Atención) | ⬜ Sin implementar |

**Nota sobre mensajería:**
- `mensajes` es la fuente de verdad para conversaciones (Sprint 8 Fase 1 activa).
- `wa_mensajes_log` es la tabla legacy de log técnico de API. Se conserva como auditoría de bajo nivel. No usarla para lógica de negocio nueva.
- `conversation_threads` agrupa mensajes por cliente + canal + contexto. Operativo para salientes y eventos internos.
- El bot de IA está apagado por defecto (`ai_settings.activo = FALSE`). No se activa solo.
- `canal = 'interno'` en `conversation_threads` y `mensajes` se usa para eventos de sistema (ej. creación de OT, cambio de estado). Visible en bandeja bajo filtro "Todos". No requiere WA ni email.

**Nota sobre Taller / OTs — identificadores duales:**
- `numero_ot` — identificador interno ServiceTrack. Inmutable, auto-generado (`OT-YYYYMM-XXXX`). Es la referencia interna del sistema.
- `numero_ot_dms` — número de OT en el DMS externo del cliente (Autoline u otro). Opcional (`NULL` si no aplica). Nunca reemplaza ni sobreescribe `numero_ot`.
- Ambos identificadores deben mostrarse en pantalla cuando `numero_ot_dms` esté presente. El UI los muestra en el listado de taller y en el detalle de OT.

---

## 3. Arquitectura de despliegue

```
┌─────────────────────────────────────────────────────┐
│                     Vercel                          │
│  Next.js 16 (App Router)                            │
│  ├── Frontend (RSC + Client Components)             │
│  ├── API Routes (/api/*)                            │
│  ├── Server Actions (app/actions/)                  │
│  └── Cron Jobs (vercel.json → /api/cron/*)          │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│                    Supabase                         │
│  ├── PostgreSQL (BD principal)                      │
│  ├── Auth (usuarios y sesiones)                     │
│  ├── RLS (Row Level Security — siempre activo)      │
│  └── Storage (archivos — no usado aún)              │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┼───────────────┐
       ▼       ▼               ▼
   Meta API  Resend       Anthropic API
  (WA out)  (Email)      (IA — pendiente)
```

El sistema no tiene servidor propio. Todo corre en Vercel (stateless) con Supabase como capa de persistencia.

---

## 4. Componentes del sistema

### 4.1 Frontend

| Elemento | Descripción |
|---|---|
| Framework | Next.js 16, App Router |
| Lenguaje | TypeScript estricto (sin `any`) |
| UI | shadcn/ui + TailwindCSS dark theme |
| Hosting | Vercel (deploy automático desde `main`) |
| URL producción | `servicetrack-one.vercel.app` |
| Auth | Supabase Auth (email/password) — sesión gestionada vía cookie HttpOnly |

### 4.2 Backend (API Routes y Server Actions)

| Ruta | Propósito | Estado |
|---|---|---|
| `app/actions/citas.ts` | CRUD citas + disparo de WA/Email | ✅ Operativo |
| `app/actions/taller.ts` | CRUD OTs + eventos internos en mensajes/bandeja | ✅ Operativo |
| `app/api/cron/recordatorios-citas/route.ts` | Recordatorios 24h antes de cita | ✅ Operativo |
| `app/api/webhooks/whatsapp/route.ts` | Recepción de mensajes WA entrantes | ⬜ Pendiente |

### 4.3 Base de datos (Supabase)

PostgreSQL con RLS activo en todas las tablas. Ver sección 7 para detalle de tablas.

Migraciones aplicadas en Supabase:
- `001_initial_schema.sql` ✅ ejecutada
- `002_email_config.sql` ⬜ **PENDIENTE** — sin esta tabla `/configuracion/email` falla silenciosamente
- `003_ai_foundation.sql` ✅ ejecutada
- `004_messaging_adjustments.sql` ✅ ejecutada — agrega `processing_status: 'skipped'` a `canal_mensaje` ENUM
- `005_taller_foundation.sql` ✅ ejecutada — crea `ordenes_trabajo` y `lineas_ot`
- `006_ot_dms_and_taller_events.sql` ✅ ejecutada — agrega `numero_ot_dms`; expande `canal` de `conversation_threads` con `'interno'`
- `007_canal_interno_enum.sql` ✅ ejecutada — agrega `'interno'` al ENUM `canal_mensaje`; trigger `message_count`
- `008_estado_ot_en_proceso.sql` ✅ ejecutada y validada — renombra ENUM `en_reparacion` → `en_proceso`
- `015_citas_asesor_and_agenda_config.sql` ✅ ejecutada — `asesor_id` en `citas` + `agenda_vista_default` en config
- `018_add_bot_confirmation_fields_to_citas.sql` ✅ ejecutada — `contacto_bot`, `confirmacion_cliente`, `confirmacion_at` en `citas`
- `019_add_cita_id_to_actividades.sql` ⬜ **PENDIENTE** — `cita_id UUID` + índice en `actividades` (trazabilidad BotIA)

**Orden obligatorio para nuevas instalaciones:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 015 → 018 → 019.

### 4.4 Cron Jobs

| Job | Schedule (UTC) | Hora México | Archivo |
|---|---|---|---|
| Recordatorios de citas 24h | `0 15 * * *` | 9:00 AM | `app/api/cron/recordatorios-citas/route.ts` |
| Flush outbound_queue | — | — | ⬜ Pendiente — no implementado |

Cron jobs protegidos con `CRON_SECRET` vía header `Authorization: Bearer`.

### 4.5 Webhook WhatsApp

⬜ **No implementado.**

Ruta planeada: `app/api/webhooks/whatsapp/route.ts`

Cuando se implemente deberá:
1. Verificar `hub.verify_token` (GET — handshake de Meta)
2. Recibir mensajes POST de Meta Cloud API
3. Deduplicar por `wa_message_id` (índice único en `mensajes`)
4. Insertar en `mensajes` con `direccion = 'entrante'` y `processing_status = 'pending'`
5. Actualizar `conversation_threads` correspondiente

### 4.6 IA

| Componente | Archivo | Estado |
|---|---|---|
| Clasificador de intención | `lib/ai/classify-intent.ts` | ✅ Código completo — no activo sin WA |
| Detector de sentimiento | `lib/ai/detect-sentiment.ts` | ✅ Código completo — no activo sin WA |
| Bot de citas (loop agéntico) | `lib/ai/bot-citas.ts` | ✅ Código completo (commit 713e605) |
| Herramientas del bot | `lib/ai/bot-tools.ts` | ✅ Código completo (commit 713e605) |
| Configuración por sucursal | tabla `ai_settings` | ✅ Tabla creada — requiere configuración manual post-deploy |

El bot está **apagado por defecto** (`ai_settings.activo = FALSE`). Requiere habilitación manual por admin.

Modelos configurados por defecto en `ai_settings`:
- `intent_model`: `claude-haiku-4-5-20251001`
- `reply_model`: `claude-sonnet-4-6`

#### Pasos para activar BotIA Citas en una sucursal nueva

**Prerequisitos:**
1. Migración 019 ejecutada en Supabase (ver sección 4.3 arriba)
2. Número Meta WhatsApp activo y `wa_numeros` poblado

**Paso 1 — Ejecutar migración 019** en Supabase SQL Editor:
```sql
alter table public.actividades
  add column if not exists cita_id uuid references public.citas(id) on delete set null;
create index if not exists idx_actividades_cita_id on public.actividades(cita_id);
```

**Paso 2 — Configurar ai_settings** para la sucursal:
```sql
-- Obtener sucursal_id y UUID del responsable primero
-- Insertar o actualizar la fila de ai_settings
INSERT INTO ai_settings (sucursal_id, activo, escalation_assignee_id)
VALUES ('<uuid-sucursal>', true, '<uuid-usuario-responsable>')
ON CONFLICT (sucursal_id) DO UPDATE
  SET activo = true,
      escalation_assignee_id = '<uuid-usuario-responsable>';
```
- `escalation_assignee_id` es el usuario que aparecerá en la cita creada por el bot y en Mi Agenda.
- Sin este valor, la cita se crea con `asesor_id = NULL` y no aparece en Mi Agenda de nadie.

**Paso 3 — Validar que el bot funciona:**
- [ ] Enviar mensaje de prueba al número WA de la sucursal con el teléfono de un cliente existente en BD
- [ ] Verificar en `/bandeja` que la conversación aparece y el bot responde
- [ ] Verificar que la cita creada aparece en Supabase con `asesor_id` poblado y `estado='confirmada'`
- [ ] Verificar que en `actividades` hay una fila con `tipo='cita_agendada'`, `modulo_origen='ia'`, `cita_id` referenciando la cita
- [ ] Verificar en `/agenda` del responsable configurado que la cita aparece en el calendario
- [ ] Verificar en `/bandeja` que el número de WhatsApp del cliente es visible en el header del chat

**Paso 4 — Validar guardrails:**
- Simular cliente que dice "sí" sin que el bot haya preguntado por cita: el bot debe escalar, NO crear cita fantasma.
- Verificar que si se crea una cita, el bot no vuelve a intentar crear otra en la misma conversación.

#### Pasos adicionales para validar P0.2 (commit d57c8c2)

**Prerequisito:** deploy de `d57c8c2` activo en Vercel (confirmar con `git log --oneline -3` y estado de deploy en Vercel Dashboard).

**Paso 5 — Validar CRM enrichment (nombre):**
- [ ] Simular con cliente cuyo `nombre='CLIENTE'` y `apellido='DEMO'` en BD
- [ ] Bot pregunta nombre → cliente responde → verificar en Supabase que `clientes.nombre` y `clientes.apellido` se actualizaron
- [ ] Bandeja muestra nombre real (no "CLIENTE DEMO") en el header del chat

**Paso 6 — Validar resolución de vehículo:**
- [ ] Cliente sin vehículo vinculado: bot pregunta vehículo → cliente responde marca/modelo/año → verificar en `vehiculos` que se creó la fila → verificar en `vehiculo_personas` que existe fila `(vehiculo_id, cliente_id, rol='propietario')`
- [ ] Cliente con 1 vehículo: bot presenta opción → cliente confirma → `flowState.vehiculo_id` resuelto
- [ ] Cliente con N vehículos: bot presenta lista numerada → cliente elige → `flowState.vehiculo_id` resuelto

**Paso 7 — Validar cita con vehiculo_id:**
- [ ] Completar flujo hasta cita confirmada
- [ ] En Supabase: `SELECT vehiculo_id FROM citas WHERE id = '<cita-id>'` → debe tener UUID (no NULL)

**Paso 8 — Validar info de sucursal:**
- [ ] Preguntar al bot "¿cuál es su dirección?" o "¿dónde están ubicados?"
- [ ] Bot responde con datos de `sucursales.direccion` y `sucursales.telefono` reales — no inventa texto
- [ ] Preguntar "¿cuál es su horario?" → bot responde con `configuracion_citas_sucursal.horario_inicio/horario_fin/dias_disponibles`
- [ ] Si la sucursal no tiene dirección configurada: documentar como dependencia operativa pendiente del cliente

**Nota:** si `sucursales.direccion` o `configuracion_citas_sucursal.horario_*` están vacíos, el bot no puede responder preguntas de ubicación/horario y debe decir que no tiene esa información disponible. Configurar estos campos como parte del onboarding del cliente.

#### Validación P0.3 — BotIA Operational Brain

**Objetivo:** dejar trazable en runbook que P0.3 agregó el corpus y las reglas operativas de BotIA, pero sin cambiar la naturaleza determinística de las acciones críticas ya cerradas en P0.2.1.

**Confirmaciones de artefactos:**
- Existe `lib/ai/botia-brain.ts`.
- `lib/ai/appointment-flow.ts` importa constantes desde `@/lib/ai/botia-brain`.
- Existen los documentos:
  - `docs/ai/BOTIA_OPERATIONAL_BRAIN.md`
  - `docs/ai/BOTIA_INTENTS.md`
  - `docs/ai/BOTIA_ENTITIES.md`
  - `docs/ai/BOTIA_SLOT_RULES.md`
  - `docs/ai/BOTIA_RESPONSE_POLICIES.md`
  - `docs/ai/BOTIA_ESCALATION_RULES.md`
  - `docs/ai/BOTIA_LEARNING_POLICY.md`
  - `docs/ai/BOTIA_TRAINING_CORPUS.md`
  - `docs/ai/BOTIA_MODULE_PLAYBOOKS.md`

**Reglas operativas que deben mantenerse:**
- BotIA no aprende automáticamente a producción.
- Todo aprendizaje debe ser supervisado por admin o jefe de módulo antes de incorporarse.
- BotIA no debe aprender groserías, insultos, malos modales ni respuestas agresivas.
- P0.3 no significa demo final lista.
- P0.3 no reemplaza los hard gates de P0.2.1.
- Las acciones críticas siguen siendo determinísticas.

**Interpretación correcta de P0.3:**
- P0.3 agrega cerebro operativo documentado, taxonomía de intents, entidades, slot rules, políticas de respuesta, escalación y corpus base.
- P0.3 no autoriza relajar guardrails previos de captura de nombre, resolución de vehículo, servicio obligatorio o validaciones de disponibilidad.
- La creación de cita, confirmaciones sensibles y demás acciones críticas deben seguir protegidas por lógica determinística y hard gates server-side.

**Pendientes posteriores a P0.3:**
- Búsqueda por placa/VIN.
- OCR de tarjeta de circulación por WhatsApp.
- Widget global BotIA / Requieren asesor.
- Vistas Hoy / Semana / Mes / Todas en Citas.
- Automation Engine propio sin n8n.
- Permisos por rol en Bandeja.
- Configuración formal por módulo.

**Checklist post-deploy P0.3:**
- [ ] Probar que P0.2.1 sigue funcionando.
- [ ] Probar captura de nombre.
- [ ] Probar captura de vehículo.
- [ ] Probar servicio obligatorio.
- [ ] Probar hora ocupada.
- [ ] Probar "hoy" sin horarios pasados.
- [ ] Probar "ya te dije".
- [ ] Probar "dónde queda".

### 4.7 Email

| Elemento | Valor |
|---|---|
| Proveedor | Resend |
| Archivo | `lib/email.ts` |
| Remitente por defecto | `onboarding@resend.dev` (temporal — requiere dominio propio) |
| Eventos activos | Confirmación cita, cancelación cita, recordatorio 24h |

---

## 5. Dependencias externas

### 5.1 Supabase

| Elemento | Detalle |
|---|---|
| Rol | BD principal, Auth, RLS |
| Plan mínimo | Pro (para Row Level Security en producción y conexiones concurrentes) |
| Region | us-east-1 (actual) — considerar `us-central1` si los clientes son México |
| Acción por cliente | Crear nuevo proyecto Supabase O crear nuevo schema/organización |

### 5.2 Vercel

| Elemento | Detalle |
|---|---|
| Rol | Hosting, deploy, cron jobs |
| Plan mínimo | Pro (para cron jobs — Hobby no los soporta en producción) |
| Deploy | Automático desde rama `main` via GitHub integration |
| Variables de entorno | Configurar en Vercel Dashboard → Settings → Environment Variables |

### 5.3 Meta WhatsApp Business API (Cloud API)

| Elemento | Detalle |
|---|---|
| Rol | Envío y recepción de mensajes WhatsApp |
| Requiere | Cuenta Meta Business verificada + número de teléfono dedicado |
| Proceso de aprobación | Puede tardar días a semanas — iniciar con anticipación |
| Credenciales por número | Se almacenan por sucursal en tabla `wa_numeros` (`phone_number_id` + `access_token`) |
| Webhook | `WA_VERIFY_TOKEN` — variable global en Vercel, requerida solo al habilitar webhook |
| Estado actual | ⬜ Pendiente para todos los clientes |

**Nota crítica:** Sin aprobación de Meta no hay WhatsApp. Iniciar el proceso de onboarding de Meta Business al menos 2 semanas antes del go-live.

### 5.4 Anthropic (Claude API)

| Elemento | Detalle |
|---|---|
| Rol | Clasificación de intención, generación de respuestas IA |
| Variable | `ANTHROPIC_API_KEY` |
| Estado | ⬜ No configurada en Vercel — bot IA no activo |
| Modelos usados | Haiku 4.5 (clasificador), Sonnet 4.6 (respuestas) |

### 5.5 Resend

| Elemento | Detalle |
|---|---|
| Rol | Envío de emails transaccionales |
| Variable | `RESEND_API_KEY` |
| Remitente actual | `EMAIL_FROM` → fallback `ServiceTrack <onboarding@resend.dev>` si no existe variable |
| Dominio propio | Requiere verificación DNS en Resend Dashboard |
| Estado | ✅ Configurada en Vercel |

---

## 6. Variables de entorno

| Variable | Dónde vive | Tipo | Para qué sirve | Scope |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Pública | URL del proyecto Supabase | Todos los entornos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Pública | Anon key de Supabase (RLS activo) | Todos los entornos |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | **Secreta** | Service role — bypasea RLS — solo para server-side | Todos los entornos |
| `NEXT_PUBLIC_SITE_URL` | Vercel + `.env.local` | Pública | Base URL usada por flujos Auth para `redirectTo` (`/auth/callback?next=/set-password`) | Requerida en dev y prod |
| `RESEND_API_KEY` | Vercel | **Secreta** | API key de Resend para envío de emails | Todos los entornos |
| `EMAIL_FROM` | Vercel | Privada | Email remitente por defecto del sistema — ej: `ServiceTrack <noreply@agencia.com>` | Todos los entornos |
| `CRON_SECRET` | Vercel | **Secreta** | Protege el endpoint del cron job (`Authorization: Bearer`) | Todos los entornos |
| `ANTHROPIC_API_KEY` | Vercel | **Secreta** | API key de Claude para clasificador IA | Todos los entornos |
| `WA_PHONE_NUMBER_ID` | Tabla `wa_numeros` | **Secreta** | ID del número de teléfono en Meta — por número | Por sucursal (en BD) |
| `WA_ACCESS_TOKEN` | Tabla `wa_numeros` | **Secreta** | Token de acceso Meta — por número | Por sucursal (en BD) |
| `WA_VERIFY_TOKEN` | Vercel | **Secreta** | Token de verificación del webhook de Meta | Global |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Vercel | Pública | Links de Google Maps en mensajes de citas | Global |

**Nota importante sobre credenciales WA:** `WA_PHONE_NUMBER_ID` y `WA_ACCESS_TOKEN` no son variables de entorno globales — se almacenan en la tabla `wa_numeros` de Supabase, una fila por número configurado. No hay credenciales WA hardcodeadas en código ni en Vercel. La tabla `wa_numeros` permite que cada sucursal tenga múltiples números (por módulo). `WA_VERIFY_TOKEN` sí es variable de entorno global porque pertenece al handshake del webhook de Meta.

### 6.1 Configuración real de Auth detectada en código

El flujo actual de autenticación y recuperación usa estas piezas:

- `app/actions/auth.ts` → `forgotPasswordAction()` llama `supabase.auth.resetPasswordForEmail()`
- `app/actions/usuarios.ts` → invitación, reenvío y reset admin construyen `redirectTo`
- `app/auth/callback/route.ts` → procesa `code` o `token_hash`/`type` y redirige a `next`

**Redirect URL real usada por el código:**

```text
{SITE_URL}/auth/callback?next=/set-password
```

Donde `SITE_URL` se resuelve así:

1. `NEXT_PUBLIC_SITE_URL`
2. `https://${VERCEL_URL}` si existe
3. `http://localhost:3000` como fallback local

**Ruta callback real:**

```text
/auth/callback
```

**Destino actual para invitación / recovery / set password:**

```text
/auth/callback?next=/set-password
```

### 6.2 Configuración requerida en Supabase Auth

En Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**
  Debe apuntar al dominio base del entorno activo.
  Ejemplos:
  - Desarrollo local: `http://localhost:3000`
  - Producción actual: `https://servicetrack-one.vercel.app`
  - Cliente futuro con dominio propio: `https://app.cliente.com`

- **Redirect URLs**
  Deben incluir, como mínimo:
  - `http://localhost:3000/auth/callback`
  - `https://servicetrack-one.vercel.app/auth/callback`
  - `https://app.cliente.com/auth/callback` para cada dominio futuro

Si `Site URL` o las `Redirect URLs` no coinciden con el entorno real, los links de invitación o recuperación pueden fallar con `access_denied`, `otp_expired` o `auth_callback_failed`.

### 6.3 Qué aplica por entorno

| Entorno | Requerido | Notas |
|---|---|---|
| Desarrollo local | `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` | Permite probar login, forgot-password y callback local |
| Producción actual | Vercel con todas las variables base + `NEXT_PUBLIC_SITE_URL=https://servicetrack-one.vercel.app` | Debe coincidir con Supabase Auth `Site URL` / redirect |
| Cliente futuro con dominio propio | Mismas variables de producción, cambiando `NEXT_PUBLIC_SITE_URL` y `EMAIL_FROM` al dominio del cliente | También requiere actualizar Supabase Auth URLs y, si aplica, dominio verificado en Resend |

### 6.4 Variables requeridas hoy en Vercel

**Base obligatoria del sistema:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET`

**Email:**

- `RESEND_API_KEY`
- `EMAIL_FROM`

**IA:**

- `ANTHROPIC_API_KEY` solo si se activará la capa IA

**WhatsApp:**

- `WA_VERIFY_TOKEN` solo cuando se implemente el webhook
- `WA_PHONE_NUMBER_ID` y `WA_ACCESS_TOKEN` no van en Vercel; viven en `wa_numeros`

---

## 7. Configuración en base de datos

### 7.1 Tablas principales y su scope

| Tabla | Descripción | Scope |
|---|---|---|
| `grupos` | Grupo/agencia (nivel raíz) | Global |
| `sucursales` | Sucursal dentro de un grupo | Por cliente |
| `usuarios` | Usuarios del sistema con rol y sucursal | Por sucursal |
| `clientes` | Clientes del taller | Por sucursal |
| `vehiculos` | Vehículos vinculados a clientes | Por sucursal |
| `empresas` | Empresas (personas morales) | Por sucursal |
| `citas` | Citas de servicio | Por sucursal |
| `ordenes_trabajo` | OTs abiertas en taller — incluye `numero_ot` (interno) y `numero_ot_dms` (externo, nullable) | Por sucursal |
| `lineas_ot` | Líneas de trabajo/partes asociadas a una OT | Por sucursal (vía OT) |
| `mensajes` | Todos los mensajes entrantes y salientes | Por sucursal |
| `conversation_threads` | Agrupación de mensajes por contexto | Por sucursal |
| `wa_numeros` | Credenciales Meta API por número y módulo | Por sucursal |
| `wa_mensajes_log` | Log técnico legacy de llamadas a API Meta | Por sucursal |
| `outbound_queue` | Cola de mensajes diferidos | Por sucursal |
| `automation_logs` | Auditoría de automatizaciones | Por sucursal |
| `ai_settings` | Configuración de IA (1 fila por sucursal) | Por sucursal |

### 7.2 Tablas con datos de runtime (no configuración)

Las siguientes tablas se llenan durante la operación y no requieren configuración manual:

- `mensajes` — cada mensaje enviado o recibido
- `conversation_threads` — creados automáticamente por `lib/threads.ts`
- `wa_mensajes_log` — creado automáticamente por `lib/whatsapp.ts`
- `outbound_queue` — llenado por server actions y cron (solo service role)
- `automation_logs` — llenado por cron jobs (solo service role)

### 7.3 Notas de arquitectura de BD

- **RLS activo en todas las tablas.** La función `get_mi_sucursal_id()` determina qué filas ve cada usuario según su JWT.
- **`conversation_threads.contexto_id`** es FK lógica sin constraint declarado. Puede apuntar a `citas`, `ordenes_trabajo`, `cotizaciones` o `leads` según `contexto_tipo`. La integridad la mantiene el código.
- **`mensajes.processing_status = NULL`** en mensajes históricos — no entran al clasificador IA. Solo filas nuevas post-003 tienen `DEFAULT 'pending'`. Los mensajes internos de sistema usan `processing_status = 'skipped'` — nunca entran al clasificador IA.
- **`ai_settings.activo = FALSE`** por defecto. El bot no se activa sin acción explícita de admin.
- **`outbound_queue` e `automation_logs`** no tienen policy de INSERT para usuarios autenticados — solo inserta service role.
- **`conversation_threads.canal = 'interno'`** — canal especial para eventos de sistema (creación OT, cambio de estado OT). No requiere número WA ni configuración de email. Visible en bandeja bajo filtro "Todos". Requiere migración 006 ejecutada.
- **Eventos internos de OT** — best-effort: si la inserción del evento en `mensajes` falla, la operación OT (crear/cambiar estado) NO falla. Los errores se registran en logs del servidor (`console.error`).

---

## 8. Configuración por cliente (grupo/agencia)

Un "cliente" de ServiceTrack es una agencia o grupo automotriz. Corresponde a un registro en la tabla `grupos`.

| Paso | Acción | Dónde |
|---|---|---|
| 1 | Crear proyecto Supabase (o reusar instancia SaaS con RLS) | Supabase Dashboard |
| 2 | Ejecutar migraciones `001` → `008` en orden (omitir `002` si no se usa email config aún) | Supabase SQL Editor |
| 3 | Insertar fila en `grupos` con nombre del cliente | SQL o UI admin |
| 4 | Crear sucursal(es) en `sucursales` con FK a `grupos.id` | SQL o UI admin |
| 5 | Crear primer usuario admin en Supabase Auth | Supabase Dashboard → Auth |
| 6 | Insertar fila en `usuarios` vinculada al `auth.user.id` | SQL o UI admin |
| 7 | Configurar variables de entorno en Vercel para este entorno | Vercel Dashboard |

---

## 9. Configuración por sucursal

Cada sucursal es una unidad operativa independiente. Un grupo puede tener N sucursales.

| Paso | Acción | Tabla / Ruta |
|---|---|---|
| 1 | Insertar fila en `sucursales` con `grupo_id` y datos básicos | `sucursales` |
| 2 | Configurar número(s) WhatsApp si están listos | `wa_numeros` vía `/configuracion/whatsapp` |
| 3 | Configurar email de sucursal (from, reply-to) | tabla `email_config` vía `/configuracion/email` |
| 4 | Crear usuarios de la sucursal con rol correcto | `/usuarios` |
| 5 | (Opcional) Crear fila en `ai_settings` con `activo = FALSE` | SQL — cuando Sprint IA esté listo |
| 6 | Verificar que `get_mi_sucursal_id()` devuelve el ID correcto | SQL: `SELECT get_mi_sucursal_id()` como ese usuario |

**Configuración de wa_numeros por sucursal:**

```
wa_numeros
  ├── sucursal_id  → ID de la sucursal
  ├── modulo       → 'citas' | 'taller' | 'ventas' | 'refacciones' | 'general'
  ├── phone_number_id → de Meta Developer Console
  ├── access_token    → de Meta Developer Console
  └── activo       → TRUE para activar
```

Si no hay número para el módulo específico, `lib/whatsapp.ts` hace fallback a `modulo = 'general'`. Si tampoco hay general, el envío falla silenciosamente (registrado en `wa_mensajes_log`).

---

## 10. Checklist de pre-implementación

### Infraestructura

- [ ] Proyecto Supabase creado y configurado
- [ ] Migraciones `001`, `002`, `003`, `004` ejecutadas y verificadas
- [ ] `005_taller_foundation.sql` ejecutada (crea `ordenes_trabajo` y `lineas_ot`)
- [ ] `006_ot_dms_and_taller_events.sql` ejecutada (agrega `numero_ot_dms` + expande constraint `canal`)
- [ ] `007_canal_interno_enum.sql` ejecutada (agrega `'interno'` al ENUM + trigger `message_count`)
- [ ] Variables de entorno configuradas en Vercel (todos los entornos)
- [ ] `NEXT_PUBLIC_SITE_URL` definido para el entorno actual
- [ ] Supabase Auth → `Site URL` alineado al dominio actual
- [ ] Supabase Auth → `Redirect URLs` incluye `/auth/callback`
- [ ] Deploy a producción exitoso (`npm run build` sin errores)
- [ ] Cron job visible en Vercel Dashboard → Cron Jobs

### Dependencias externas

- [ ] Cuenta Resend activa con `RESEND_API_KEY` configurada
- [ ] Dominio de email verificado en Resend (o usar `onboarding@resend.dev` temporal)
- [ ] Proceso de aprobación Meta Business iniciado (si WA es requerido desde día 1)
- [ ] `ANTHROPIC_API_KEY` configurada si se va a activar IA (puede dejarse para después)

### Datos iniciales

- [ ] Fila en `grupos` creada
- [ ] Al menos una sucursal en `sucursales`
- [ ] Usuario admin creado en Supabase Auth + fila en `usuarios`
- [ ] Login funcional verificado
- [ ] Invitación de usuario abre `/auth/callback?next=/set-password` sin error
- [ ] Forgot-password redirige correctamente a `/set-password`

---

## 10.5 Migraciones pendientes de ejecutar en Supabase antes de demo/deploy bot

Las siguientes migraciones NO se aplican automáticamente — deben ejecutarse manualmente en
**Supabase → SQL Editor** de la instancia de producción antes de cualquier push o demo del bot.

### Migración 018 — campos de trazabilidad del bot en `citas`

Detectada como schema drift en validación pre-deploy 2026-04-27.
`lib/ai/bot-tools.ts` usa estas columnas al crear y confirmar citas vía bot.
Sin esta migración, `crearCitaBot` y `confirmarCitaBot` fallan silenciosamente.

```sql
alter table public.citas
  add column if not exists contacto_bot        boolean     default false,
  add column if not exists confirmacion_cliente boolean,
  add column if not exists confirmacion_at      timestamptz;
```

**Verificación post-ejecución:**
```sql
select column_name, data_type from information_schema.columns
where table_name = 'citas'
  and column_name in ('contacto_bot','confirmacion_cliente','confirmacion_at');
-- Debe devolver 3 filas.
```

---

## 11. Checklist de go-live

- [ ] Login funcional para todos los usuarios iniciales
- [ ] Forgot-password funcional en producción
- [ ] Link de invitación funcional en producción
- [ ] RLS verificado: usuario de sucursal A no ve datos de sucursal B
- [ ] Crear cita de prueba → verificar que aparece en kanban
- [ ] Cambiar estado de cita → verificar que dispara WA (si WA está configurado)
- [ ] Cambiar estado de cita → verificar que dispara email
- [ ] Cron job ejecutado manualmente y sin errores (ver sección 12)
- [ ] `wa_mensajes_log` tiene registro del envío de prueba
- [ ] `mensajes` tiene registro del envío de prueba (Sprint 8 Fase 1)
- [ ] `conversation_threads` tiene el hilo creado para el cliente de prueba
- [ ] Bot WA apagado (`ai_settings.activo = FALSE`) confirmado
- [ ] Acceso a Supabase Dashboard restringido a equipo técnico

---

## 12. Validaciones técnicas post-configuración

### Verificar migraciones

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'mensajes','ai_settings','conversation_threads',
  'outbound_queue','automation_logs',
  'ordenes_trabajo','lineas_ot'
)
ORDER BY table_name;
-- Debe devolver 7 filas
```

### Verificar columnas de ordenes_trabajo (migraciones 005 + 006)

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ordenes_trabajo'
AND column_name IN ('numero_ot', 'numero_ot_dms', 'seguimiento_token', 'estado')
ORDER BY column_name;
-- numero_ot: text, NO (NOT NULL)
-- numero_ot_dms: text, YES (nullable)
-- seguimiento_token: text, NO (NOT NULL, UNIQUE)
-- estado: text o enum, NO
```

### Verificar constraint canal en conversation_threads (migración 006)

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'conversation_threads_canal_check';
-- check_clause debe incluir 'interno'
```

### Verificar processing_status default

```sql
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'mensajes'
AND column_name = 'processing_status';
-- column_default debe ser 'pending'
```

### Verificar RLS activo

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('mensajes','conversation_threads','citas','clientes')
ORDER BY tablename;
-- rowsecurity debe ser TRUE en todas
```

### Verificar get_mi_sucursal_id

Ejecutar como el usuario de prueba (con su JWT) en Supabase SQL Editor:
```sql
SELECT get_mi_sucursal_id();
-- Debe devolver el UUID de la sucursal del usuario
```

### Verificar wa_numeros configurado

```sql
SELECT modulo, activo, phone_number_id IS NOT NULL AS tiene_credencial
FROM wa_numeros
WHERE sucursal_id = '<uuid-sucursal>';
```

### Test del cron manualmente

```bash
curl -X GET https://servicetrack-one.vercel.app/api/cron/recordatorios-citas \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Respuesta esperada: `{"ok":true,"enviados":<n>,"errores":<n>}` o similar.

---

## 13. Pruebas mínimas end-to-end

Estas pruebas deben ejecutarse antes de dar acceso a usuarios reales.

| # | Escenario | Resultado esperado |
|---|---|---|
| E1 | Login con usuario válido | Accede al dashboard sin error |
| E2 | Login con usuario inválido | Error claro, sin acceso |
| E3 | Crear cliente nuevo | Aparece en `/crm/clientes` |
| E4 | Crear cita para ese cliente | Aparece en kanban `/citas` en columna correcta |
| E5 | Cambiar estado cita a "confirmada" | Registro en `mensajes` como saliente + WA enviado (si `wa_numeros` configurado) |
| E6 | Cambiar estado cita a "cancelada" | Registro en `mensajes` + WA de cancelación |
| E7 | Verificar `conversation_threads` | Existe un hilo activo para el cliente |
| E8 | Ejecutar cron manualmente | Responde 200, registros en `wa_mensajes_log` |
| E9 | Usuario de sucursal B intenta ver datos de sucursal A | No ve nada (RLS) |
| E10 | Verificar `automation_logs` | Hay registro de los eventos E5 y E6 (si está implementado) |
| E11 | Crear OT desde `/taller/nuevo` | OT aparece en listado con `numero_ot`; si se ingresó `numero_ot_dms`, se muestra en la fila |
| E12 | Cambiar estado de OT | Estado se actualiza; `mensajes` tiene un registro con `canal = 'interno'`, `message_source = 'system'`; `conversation_threads` tiene un hilo con `canal = 'interno'` para esa OT |
| E13 | Crear OT con `numero_ot_dms` | Detalle `/taller/[id]` muestra badge "DMS: XXXXX" junto al número interno |
| E14 | Abrir OT de otra sucursal por UUID directo | Página devuelve 404 (RLS protege acceso) |

---

## 14. Operación inicial y monitoreo

### Logs disponibles

| Fuente | Qué monitorear |
|---|---|
| Vercel Dashboard → Functions | Errores en server actions y API routes |
| Vercel Dashboard → Cron Jobs | Estado de ejecución del cron de recordatorios |
| Supabase → `wa_mensajes_log` | Envíos WA fallidos (`status = 'error'`) |
| Supabase → `mensajes` | Mensajes salientes sin `wa_message_id` (fallo silencioso) |
| Supabase → `automation_logs` | Automatizaciones fallidas (`estado = 'failed'`) |
| Supabase → `outbound_queue` | Mensajes en cola con `intentos >= max_intentos` |

### Queries de monitoreo operativo

```sql
-- WA fallidos en las últimas 24h
SELECT telefono_destino, tipo, error_detalle, enviado_at
FROM wa_mensajes_log
WHERE status = 'error'
AND enviado_at > NOW() - INTERVAL '24 hours'
ORDER BY enviado_at DESC;

-- Mensajes salientes sin ID de Meta (posible fallo no registrado)
SELECT id, cliente_id, enviado_at
FROM mensajes
WHERE direccion = 'saliente'
AND wa_message_id IS NULL
AND canal = 'whatsapp'
AND enviado_at > NOW() - INTERVAL '24 hours';

-- Cola con mensajes atascados
SELECT id, workflow_key, intentos, max_intentos, send_after, error_detail
FROM outbound_queue
WHERE estado IN ('pending','approved')
AND send_after < NOW() - INTERVAL '1 hour'
ORDER BY send_after;
```

---

## 15. Troubleshooting inicial

### WA no llega al cliente

1. Verificar que `wa_numeros` tiene una fila con `activo = TRUE` para esa `sucursal_id` y `modulo`
2. Revisar `wa_mensajes_log` — columna `error_detalle`
3. Verificar que `WA_ACCESS_TOKEN` no expiró (los tokens de Meta expiran)
4. Si `wa_mensajes_log` tiene registro pero `mensajes` no: error de persistencia conversacional — revisar `error_detalle` por `[PERSIST_ERROR: ...]`

### Email no llega

1. Verificar `RESEND_API_KEY` en Vercel
2. Verificar `EMAIL_FROM` en Vercel
3. Revisar que el dominio del remitente esté verificado en Resend
4. Revisar carpeta spam del destinatario
5. Verificar en Resend Dashboard → Logs

### Invitación / recovery falla

1. Verificar `NEXT_PUBLIC_SITE_URL` en Vercel o `.env.local`
2. Verificar Supabase Auth → `Site URL`
3. Verificar Supabase Auth → `Redirect URLs` incluye `/auth/callback`
4. Verificar que el link recibido entra por `/auth/callback?next=/set-password`
5. Si cae en `/login?error=auth_callback_failed`, revisar que el token no haya expirado y que el dominio del link coincida con el entorno configurado

### Cron no se ejecuta

1. Verificar que el plan de Vercel soporta cron jobs (requiere Pro)
2. Verificar que `CRON_SECRET` está configurada en Vercel
3. Probar manualmente con `curl` (ver sección 12)
4. Revisar logs en Vercel Dashboard → Cron Jobs

### Usuario no ve sus datos

1. Verificar que tiene fila en tabla `usuarios` con `sucursal_id` correcto
2. Verificar que `get_mi_sucursal_id()` devuelve algo para ese JWT
3. Verificar que las policies de RLS están activas en la tabla afectada

### `conversation_threads` duplicados

No debería ocurrir — los índices parciales únicos en BD previenen duplicados. Si ocurre:
1. Verificar si los índices `uq_thread_activo_con_contexto` y `uq_thread_activo_general` existen
2. Verificar que no hay hilos con estado `closed` que deberían estar `open`

---

## 16. Riesgos actuales del sistema

| Riesgo | Severidad | Descripción | Mitigación |
|---|---|---|---|
| WA solo saliente | Alta | Sin webhook, los mensajes entrantes no se procesan ni registran | Implementar Sprint 8 Fase 2 antes de activar WA con clientes |
| Bandeja operativa parcial | Media | `/bandeja` ya refleja datos reales, pero todavía no cubre webhook entrante, composición real ni validación operativa completa. | Cerrar webhook, validación manual y hardening antes de piloto con cliente |
| `message_count` sin incremento | Baja | El contador denormalizado en `conversation_threads` no se actualiza | Implementar trigger o RPC en Fase 2 |
| RLS por rol pendiente | Media | `ai_settings` y `outbound_queue` solo validan sucursal, no rol | Implementar con Sprint 2 (usePermisos) |
| Token WA expirable | Alta | Access tokens de Meta pueden expirar — sistema falla silenciosamente | Implementar renovación de tokens o usar token permanente de negocio |
| Sin retry para emails | Baja | Si Resend falla, el email se pierde | Implementar reintentos o usar outbound_queue para emails |
| `contexto_id` FK sin constraint | Baja | Si se borra una cita, el hilo queda con `contexto_id` huérfano | Resolver hilos antes de borrar entidades referenciadas |

---

## 17. Pendientes (ordenados por impacto)

### Sprint 8 — en progreso

| Pendiente | Impacto | Sprint |
|---|---|---|
| Webhook WhatsApp (`/api/webhooks/whatsapp/route.ts`) | Crítico — sin esto no hay mensajería bidireccional | Sprint 8 Fase 2 |
| Flush de `outbound_queue` (cron) | Alto — mensajes diferidos nunca se envían | Sprint 8 |
| Madurez operativa de bandeja | Alto — ya conectada, pero faltan webhook, composición y validación real | Sprint 8 |
| Clasificador de intención IA (`lib/ai/classify-intent.ts`) | Medio — bot no puede entender mensajes | Sprint 8 |
| Detector de sentimiento (`lib/ai/detect-sentiment.ts`) | Medio | Sprint 8 |
| `message_count` incremental (trigger o RPC) | Bajo | Sprint 8 Fase 2 |

### Deuda técnica registrada

| Deuda | Descripción |
|---|---|
| RLS por rol | `ai_settings` y `outbound_queue` — solo validar sucursal, no rol |
| `wa_mensajes_log` → deprecar | Migrar completamente a `mensajes` como única fuente de verdad conversacional |
| Módulos vacíos | Ventas, CSI, Seguros, Reportes, Atención — sin implementar |
| Validación flujo OT | Flujo completo de OT nunca validado post-migración 005+006 — pendiente ejecutar migraciones y probar end-to-end |
| Dominio email propio | Actualmente usa `onboarding@resend.dev` |

---

## 18. Glosario operativo

| Término | Definición |
|---|---|
| **sucursal** | Unidad operativa independiente dentro de un grupo. Tiene su propio RLS, usuarios, números WA y configuración IA. |
| **grupo** | Agencia o corporativo que agrupa N sucursales. Nivel raíz en el modelo de datos. |
| **conversation_thread** | Agrupación de mensajes de un cliente+canal+contexto. Un cliente puede tener múltiples hilos activos si son de contextos distintos. |
| **contexto_tipo** | Tipo de entidad a la que está vinculado un hilo: `cita`, `ot`, `cotizacion`, `lead`, `general`. |
| **message_source** | Quién originó el mensaje: `customer` (cliente), `agent` (asesor humano), `agent_bot` (bot automático), `system` (sistema), `import` (importación masiva). |
| **wa_numeros** | Tabla de credenciales Meta Cloud API por sucursal y módulo. No confundir con el número de contacto público de la sucursal. |
| **wa_mensajes_log** | Log técnico legacy de cada llamada a la API de Meta. Conservado para auditoría de bajo nivel. La fuente de verdad conversacional es `mensajes`. |
| **outbound_queue** | Cola de mensajes diferidos: fuera de horario, aprobación requerida, reintentos. Solo service role inserta aquí. |
| **automation_logs** | Registro append-only de cada automatización ejecutada. Solo service role inserta aquí. |
| **ai_settings** | Configuración de IA por sucursal. Kill switch global (`activo`), umbrales de confianza, modelos, horario del bot. `activo = FALSE` por defecto. |
| **processing_status** | Estado de clasificación IA de un mensaje: `pending` (nuevo), `processing` (en curso), `done` (clasificado), `failed` (error), `skipped` (saliente — no requiere clasificación), `NULL` (histórico). |
| **service role** | Cliente de Supabase que bypasea RLS. Usado solo en server-side via `createAdminClient()`. Nunca exponer al frontend. |
| **CRON_SECRET** | String secreto que protege el endpoint del cron job. Meta/Vercel envía este header para verificar que la llamada es legítima. |
| **horario del bot** | 8:00 AM – 7:30 PM hora México. Mensajes fuera de este horario se encolan en `outbound_queue`. |
| **numero_ot** | Número de OT interno de ServiceTrack. Formato `OT-YYYYMM-XXXX`. Inmutable. Siempre presente. Es el identificador de referencia dentro del sistema. |
| **numero_ot_dms** | Número de OT en el DMS externo del cliente (Autoline u otro). Opcional. `NULL` si el cliente no usa DMS o no ingresó el número. Nunca reemplaza `numero_ot`. |
| **evento_interno** | Mensaje con `canal = 'interno'` y `message_source = 'system'` en la tabla `mensajes`. Registra acciones del sistema (ej. creación OT, cambio de estado). Visible en bandeja bajo "Todos". No dispara WA ni email. |

#### ValidaciÃ³n P0.4 â€” Dashboard Citas Hoy / Semana / Mes / Todas

**Objetivo:** que el tablero `/citas` pueda usarse operativamente sin mezclar histÃ³rico, citas del dÃ­a y citas futuras en un mismo backlog visual.

**Confirmaciones funcionales:**
- `/citas` soporta selector visible de vista con opciones `Hoy`, `Semana actual`, `Mes`, `Todas`.
- La consulta filtra por `fecha_cita` en `America/Mexico_City`.
- `Hoy` muestra solo la fecha actual.
- `Semana actual` muestra solo lunes a domingo de la semana actual.
- `Mes` muestra solo el mes actual.
- `Todas` mantiene visibilidad completa sin filtro temporal.
- El encabezado muestra vista activa + rango visible + total de citas.
- El kanban mantiene estados: `pendiente_contactar`, `contactada`, `confirmada`, `en_agencia`, `show`, `no_show`, `cancelada`.

**InterpretaciÃ³n operativa:**
- P0.4 mejora lectura operativa del mÃ³dulo de Citas, pero no reemplaza una vista calendario completa.
- P0.4 no agrega filtros de asesor ni sucursal en la UI de `/citas`; si se requieren, quedan como pendiente posterior.
- P0.4 no cambia reglas de negocio de BotIA ni flujo de creaciÃ³n/confirmaciÃ³n de citas.

**Pendientes posteriores a P0.4:**
- Rango personalizado.
- Filtro por asesor.
- Filtro por sucursal.
- Vista calendario mensual completa de Citas.

**Checklist post-deploy P0.4:**
- [ ] Vista Hoy solo muestra citas de hoy.
- [ ] Vista Semana actual solo muestra citas entre lunes y domingo de la semana actual.
- [ ] Vista Mes solo muestra citas del mes actual.
- [ ] Vista Todas muestra todo el historial visible por RLS.
- [ ] Las columnas por estado siguen funcionando.

#### ValidaciÃ³n P0.4.1 â€” Fix filtros reales + calendario mensual de Citas

**Problema detectado tras deploy de P0.4:**
- El resumen superior podÃ­a mostrar una vista y rango correctos mientras el kanban seguÃ­a renderizando tarjetas de otra vista.
- La causa fue estado cliente stale en `CitasKanban`, no un problema de RLS ni de datos en Supabase.
- La vista `Mes` seguÃ­a siendo un kanban filtrado, cuando negocio pidiÃ³ calendario mensual.

**Correcciones validadas en cÃ³digo:**
- `CitasKanban` resincroniza su lista interna cuando cambia la lista filtrada recibida por props.
- `Semana actual` usa semana operativa `domingo -> sÃ¡bado`, segÃºn el criterio validado en la prueba del `2026-04-28`.
- `Mes` ahora muestra calendario mensual visual por defecto.
- `Mes` conserva toggle explÃ­cito `Calendario` / `Kanban`.
- Los conteos por columna y el total superior se calculan sobre la misma lista filtrada que se renderiza.

**Pendientes posteriores a P0.4.1:**
- Rango personalizado.
- Filtro por asesor.
- Filtro por sucursal.
- Filtro por estado.
- Drag and drop mensual directo sobre calendario.

#### ValidaciÃ³n P0.5 â€” BotIA agencia completa + confirmaciÃ³n correcta

**Problema detectado antes del fix:**
- BotIA todavÃ­a se presentaba y respondÃ­a como si solo fuera asistente de citas.
- Solicitudes de refacciones, taller, ventas, CSI o seguros no quedaban canalizadas por mÃ³dulo de forma consistente.
- Si el cliente aceptaba fecha/hora pero pedÃ­a llamada humana, el flujo podÃ­a terminar como confirmaciÃ³n explÃ­cita aunque negocio requerÃ­a `pendiente_contactar`.

**Correcciones validadas en cÃ³digo:**
- `classify-intent.ts` y `types.ts` ahora contemplan intents de agencia: refacciones, taller, ventas, CSI, seguros, atenciÃ³n a clientes, recordatorio y confirmaciÃ³n humana.
- `bandeja.ts` enruta por mÃ³dulo de forma determinÃ­stica y crea escalaciones/actividades usando `ai_settings.escalation_assignee_id` cuando existe, sin hardcodear usuarios.
- Refacciones ya no responde "solo citas": BotIA pide pieza + vehÃ­culo y canaliza con Refacciones; si no hay acciÃ³n segura suficiente, deja `waiting_agent`.
- ConfirmaciÃ³n explÃ­cita del cliente â†’ cita `confirmada`.
- Solicitud de llamada / confirmaciÃ³n humana â†’ cita `pendiente_contactar` + actividad de seguimiento + thread `waiting_agent`.
- La placa se pide de forma preferente. Si el cliente no la tiene a la mano, el flujo puede continuar con `placa_pendiente`.
- La polÃ­tica de recordatorio queda alineada al sistema real: WhatsApp un dÃ­a antes solo si la automatizaciÃ³n estÃ¡ activa; llamada solo si se crea actividad para asesor; no se promete llamada automÃ¡tica IA.

**Pendientes posteriores a P0.5:**
- BÃºsqueda real por placa/VIN.
- OCR de tarjeta de circulaciÃ³n por WhatsApp.
- Widget global BotIA / Requiere asesor.
- Permisos por rol en Bandeja.
- ConfiguraciÃ³n formal por mÃ³dulo.

**Checklist post-deploy P0.5:**
- [ ] Cliente pide refacciones y BotIA lo enruta a Refacciones sin decir que solo atiende citas.
- [ ] Cliente pide cita y BotIA solicita nombre, vehÃ­culo, placa preferente, servicio, fecha y hora.
- [ ] Cliente pide una hora ocupada y BotIA ofrece alternativas sin escalar si sÃ­ hay horarios disponibles.
- [ ] Cliente confirma "sÃ­" y la cita queda `confirmada`.
- [ ] Cliente dice "llÃ¡mame para confirmar" y la cita queda `pendiente_contactar` con actividad para asesor.
- [ ] Cliente pide recordatorio y BotIA responde con la polÃ­tica real de WhatsApp 24h + seguimiento humano si existe actividad.
