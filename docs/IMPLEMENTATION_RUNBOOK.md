# IMPLEMENTATION_RUNBOOK.md — ServiceTrack

> Documento técnico y operativo para la implementación de ServiceTrack en clientes reales.
> Última revisión: 2026-04-15
> Sprint de referencia: Sprint 8 (Fase 1 completa — Taller+DMS implementado)

---

## 1. Propósito del documento

Este runbook describe los pasos técnicos, configuraciones y validaciones necesarios para desplegar ServiceTrack en un cliente nuevo. Cubre infraestructura, dependencias externas, datos por cliente y por sucursal, y el proceso de go-live.

No es un manual comercial. Es un documento de operación para quien ejecuta la implementación.

---

## 2. Estado actual del producto

| Componente | Estado |
|---|---|
| CRM (Clientes, Empresas, Vehículos) | ✅ Operativo |
| Citas (Kanban) | ✅ Operativo |
| Taller / OTs | ✅ Construido — `numero_ot_dms` implementado; eventos internos en bandeja activos; pendiente validación de flujo completo post-migración |
| Refacciones | ✅ Construido |
| Bandeja / Automatizaciones (UI) | 🔄 En desarrollo — usa datos mock, no conectada a Supabase real |
| WhatsApp — canal saliente | ✅ Operativo (`lib/whatsapp.ts`) |
| WhatsApp — canal entrante (webhook) | ⬜ Pendiente — no implementado |
| Email (Resend) | ✅ Operativo (`lib/email.ts`) |
| Cron — recordatorios 24h | ✅ Operativo (`vercel.json` + `/api/cron/recordatorios-citas`) |
| IA — clasificador de intención | ⬜ Pendiente (`lib/ai/classify-intent.ts`) |
| IA — detector de sentimiento | ⬜ Pendiente (`lib/ai/detect-sentiment.ts`) |
| Cola de mensajes diferidos (outbound_queue) | ✅ Tabla en BD — lógica de flush pendiente |
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
│  Next.js 14 (App Router)                            │
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
| Framework | Next.js 14, App Router |
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

Migraciones aplicadas:
- `001_initial_schema.sql` ✅
- `002_email_config.sql` ✅
- `003_ai_foundation.sql` ✅
- `004_messaging_adjustments.sql` — verificar si fue ejecutada (agrega columna `processing_status: 'skipped'` usada en mensajes salientes)
- `005_taller_foundation.sql` ⬜ **PENDIENTE DE EJECUTAR** — crea `ordenes_trabajo` y `lineas_ot`
- `006_ot_dms_and_taller_events.sql` ✅ ejecutada — agrega `numero_ot_dms` + expande CHECK constraint `canal` de `conversation_threads` para incluir `'interno'`
- `007_canal_interno_enum.sql` ⬜ **PENDIENTE DE EJECUTAR** — agrega `'interno'` al ENUM `canal_mensaje` (fix mensajes internos OT) + trigger `message_count`

**Orden obligatorio:** ejecutar 005 antes de 006. Ejecutar 006 antes de desplegar el módulo Taller.

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
| Clasificador de intención | `lib/ai/classify-intent.ts` | ⬜ Pendiente |
| Detector de sentimiento | `lib/ai/detect-sentiment.ts` | ⬜ Pendiente |
| Configuración por sucursal | tabla `ai_settings` | ✅ Tabla creada — UI pendiente |

El bot está **apagado por defecto** (`ai_settings.activo = FALSE`). Requiere habilitación manual por admin desde la UI.

Modelos configurados por defecto en `ai_settings`:
- `intent_model`: `claude-haiku-4-5-20251001`
- `reply_model`: `claude-sonnet-4-6`

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
| Credenciales por número | `WA_PHONE_NUMBER_ID` + `WA_ACCESS_TOKEN` |
| Webhook | `WA_VERIFY_TOKEN` — configurar en Meta Developer Console |
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
| Remitente actual | `onboarding@resend.dev` (temporal, sin dominio propio) |
| Dominio propio | Requiere verificación DNS en Resend Dashboard |
| Estado | ✅ Configurada en Vercel |

---

## 6. Variables de entorno

| Variable | Dónde vive | Tipo | Para qué sirve | Scope |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Pública | URL del proyecto Supabase | Todos los entornos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Pública | Anon key de Supabase (RLS activo) | Todos los entornos |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | **Secreta** | Service role — bypasea RLS — solo para server-side | Todos los entornos |
| `RESEND_API_KEY` | Vercel | **Secreta** | API key de Resend para envío de emails | Todos los entornos |
| `RESEND_FROM_EMAIL` | Vercel | Privada | Email remitente — ej: `noreply@agencia.com` | Todos los entornos |
| `CRON_SECRET` | Vercel | **Secreta** | Protege el endpoint del cron job (`Authorization: Bearer`) | Todos los entornos |
| `ANTHROPIC_API_KEY` | Vercel | **Secreta** | API key de Claude para clasificador IA | Todos los entornos |
| `WA_PHONE_NUMBER_ID` | Vercel / tabla `wa_numeros` | **Secreta** | ID del número de teléfono en Meta — por número | Por sucursal (en BD) |
| `WA_ACCESS_TOKEN` | Vercel / tabla `wa_numeros` | **Secreta** | Token de acceso Meta — por número | Por sucursal (en BD) |
| `WA_VERIFY_TOKEN` | Vercel | **Secreta** | Token de verificación del webhook de Meta | Global |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Vercel | Pública | Links de Google Maps en mensajes de citas | Global |

**Nota importante sobre credenciales WA:** `WA_PHONE_NUMBER_ID` y `WA_ACCESS_TOKEN` no son variables de entorno globales — se almacenan en la tabla `wa_numeros` de Supabase, una fila por número configurado. No hay credenciales WA hardcodeadas en código ni en Vercel. La tabla `wa_numeros` permite que cada sucursal tenga múltiples números (por módulo).

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
| 2 | Ejecutar migraciones `001` → `006` en orden | Supabase SQL Editor |
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

---

## 11. Checklist de go-live

- [ ] Login funcional para todos los usuarios iniciales
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
2. Revisar que el dominio del remitente esté verificado en Resend
3. Revisar carpeta spam del destinatario
4. Verificar en Resend Dashboard → Logs

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
| Bandeja con datos mock | Media | La UI de bandeja no refleja datos reales — confusión para demos/piloto. Eventos internos de OT SÍ se guardan en Supabase, pero la bandeja no los muestra hasta que se conecte. | Conectar a Supabase antes de piloto con cliente |
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
| Bandeja UI conectada a Supabase real | Alto — actualmente mock | Sprint 8 |
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
