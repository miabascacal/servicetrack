# WORKPLAN_CURRENT_STATE.md — ServiceTrack
> **FUENTE DE VERDAD ÚNICA del proyecto. Todo análisis, bug, decisión y mejora debe integrarse aquí.**
> Documento de estado consolidado para arquitectos, asistentes IA y equipo de desarrollo.
> **Última actualización:** 2026-04-16 (FASE 1 parcialmente cerrada en pages + FASE 1.5 implementada en código y pendiente de deploy/config/validación)
> **Sprint cerrado:** Sprint 9
> **Estado general:** ~26% del producto completo — CRM+Citas+Taller operativos, automatizaciones Fase 1 activas, sin WhatsApp real (dependencia externa).

---

## 1. RESUMEN EJECUTIVO

ServiceTrack es un SaaS vertical automotriz (Next.js 16 + Supabase + Vercel). El núcleo del producto —CRM, Citas, Taller y automatizaciones de email— está construido y operativo en producción. WhatsApp está implementado en código pero bloqueado por una dependencia externa (número Meta no activo). Los módulos de Ventas, CSI, Seguros y Atención son placeholders vacíos.

**Lo que funciona hoy en producción:**
- Flujo completo: cliente → vehículo → cita → OT, incluyendo vinculación OT desde cita.
- OTs con identificador dual (`numero_ot` interno + `numero_ot_dms` externo DMS).
- Estados OT canónicos alineados entre BD y UI (`en_proceso`, no `en_reparacion`).
- Normalización de texto visible a MAYÚSCULAS en todas las acciones de crear/editar.
- Eventos internos de sistema en bandeja (creación/cambio estado OT).
- Recordatorios de citas automáticos por email (cron 9 AM).
- Flujo contextual parcial: si no existe cliente al crear cita, se puede crear y regresar.

**Lo que está roto o pendiente de deploy:**
- `/taller` — crash resuelto en código, **requiere deploy a Vercel para activarse**.
- Bandeja UI — ya conecta a `conversation_threads` + `mensajes`, pero sigue pendiente madurez funcional (sin webhook WA entrante, sin compose real y con hardening pendiente).
- **Acceso multiusuario roto** — el link de invitación falla con `access_denied` / `otp_expired`. Sin segundo usuario funcional no se puede validar aislamiento multi-tenant real.

---

## 2. LO YA IMPLEMENTADO

### 2.1 CRM

| Módulo | Archivo(s) clave | Estado |
|--------|-----------------|--------|
| Clientes (CRUD completo) | `app/(dashboard)/crm/clientes/` | ✅ Funcional |
| Empresas (CRUD completo) | `app/(dashboard)/crm/empresas/` | ✅ Funcional |
| Vehículos (CRUD completo) | `app/(dashboard)/crm/vehiculos/` | ✅ Funcional |
| Vinculación cliente↔empresa↔vehículo | `VinculacionControls.tsx`, `EmpresaVehiculoControls.tsx` | ✅ Funcional |
| Normalización MAYÚSCULAS en creates/updates | `app/actions/clientes.ts`, `vehiculos.ts`, `empresas.ts` | ✅ Completo |

Campos normalizados a MAYÚSCULAS: `nombre`, `apellido`, `apellido_2` (clientes), `nombre` (empresas), `marca`, `modelo`, `version`, `color` (vehículos). **No normalizar:** email, whatsapp, URLs, VIN, tokens, notas.

### 2.2 Citas

| Elemento | Estado |
|----------|--------|
| Kanban de citas (5 columnas) | ✅ Funcional |
| Detalle de cita con cambio de estado | ✅ Funcional |
| Transiciones de estado con validación | ✅ Funcional |
| Bloque "OT" en cita (`en_agencia`/`show`) | ✅ Funcional — muestra OT vinculada o permite vincular/crear |
| Vincular OT existente desde cita | ✅ Funcional — `vincularOTCitaAction` + `VincularOTCita.tsx` |
| Crear nueva OT desde cita | ✅ Funcional — link `/taller/nuevo?cita_id=...` |
| Flujo contextual: crear cliente si no existe | ✅ Parcial — Fase 1a implementada (link + `return_to`) |
| WA al confirmar/cancelar cita | ✅ Implementado en código — bloqueado por WA sin número activo |
| Recordatorio 24h (cron 9 AM) | ✅ Operativo en Vercel |

**Regla de negocio clave:** `vincularOTCitaAction` valida sucursal + cliente + vehículo. La regla de vehículo es null-permisiva: solo bloquea si AMBOS tienen vehículo asignado y son distintos. Comentario explícito en el código.

### 2.3 Taller / OTs

| Elemento | Estado |
|----------|--------|
| Lista de OTs con filtros por estado | ✅ Funcional — crash resuelto, requiere deploy |
| Detalle de OT | ✅ Funcional |
| Crear OT nueva | ✅ Funcional |
| Cambiar estado OT | ✅ Funcional — transiciones validadas en `lib/ot-estados.ts` |
| `numero_ot_dms` — identificador DMS externo | ✅ Funcional — mostrar siempre cuando exista |
| Eventos internos en bandeja (canal=`interno`) | ✅ Funcional — best-effort, no fallan la operación |
| ENUM `estado_ot` canónico | ✅ `en_proceso` — migración 008 ejecutada y validada |
| `updated_at` por trigger | ✅ Trigger `t_ordenes_trabajo_updated` (migration 005) |
| `updated_by` por usuario | ⬜ No existe — TODO documentado en `updateEstadoOTAction` |

**Estados OT y transiciones** (fuente única: `lib/ot-estados.ts`):
```
recibido → diagnostico, en_proceso, cancelado
diagnostico → en_proceso, cancelado
en_proceso → listo, cancelado
listo → entregado
entregado → (final)
cancelado → (final)
```

### 2.4 Migraciones Supabase

| Migración | Descripción | Estado |
|-----------|-------------|--------|
| `001_initial_schema.sql` | Schema base | ✅ Ejecutada |
| `002_email_config.sql` | Tabla `email_config` para UI de configuración | ⬜ Pendiente |
| `003_ai_foundation.sql` | IA: `ai_settings`, `conversation_threads`, `outbound_queue`, `automation_logs`; columnas en `mensajes` | ✅ Ejecutada |
| `004_messaging_adjustments.sql` | Ajustes ENUM `canal_mensaje` y `processing_status` | ✅ Ejecutada |
| `005_taller_foundation.sql` | Tablas `ordenes_trabajo` + `lineas_ot` + trigger `updated_at` | ✅ Ejecutada |
| `006_ot_dms_and_taller_events.sql` | Columna `numero_ot_dms`; `canal='interno'` en `conversation_threads` | ✅ Ejecutada |
| `007_canal_interno_enum.sql` | `'interno'` en ENUM `canal_mensaje`; trigger `message_count` | ✅ Ejecutada |
| `008_estado_ot_en_proceso.sql` | Renombra ENUM `en_reparacion` → `en_proceso` | ✅ Ejecutada y validada |

### 2.5 Automatizaciones y mensajería

| Canal | Estado |
|-------|--------|
| Email (Resend) — eventos de citas | ✅ Operativo |
| Cron recordatorios citas 24h (9 AM Vercel) | ✅ Operativo |
| WhatsApp saliente (`lib/whatsapp.ts`) | ✅ Implementado — **bloqueado: `wa_numeros` vacío** |
| Eventos internos OT en bandeja | ✅ Operativo (`canal='interno'`, `processing_status='skipped'`) |
| Webhook WhatsApp entrante | ⬜ No implementado |
| Clasificador de intención IA | ⬜ No implementado |
| Flush de `outbound_queue` | ⬜ No implementado |

### 2.6 Variables de entorno (Vercel — All Environments)

| Variable | Estado |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Configurada |
| `RESEND_API_KEY` | ✅ Configurada |
| `EMAIL_FROM` | ✅ `ServiceTrack <onboarding@resend.dev>` (temporal) |
| `CRON_SECRET` | ✅ Configurada |
| `ANTHROPIC_API_KEY` | ✅ Configurada |
| `WA_PHONE_NUMBER_ID` / `WA_ACCESS_TOKEN` | ⬜ Pendientes en tabla `wa_numeros` — proceso Meta no activo |
| `WA_VERIFY_TOKEN` | ⬜ Pendiente en Vercel — solo requerido al habilitar webhook |

---

## 3. LO VALIDADO PERO PENDIENTE DE DEPLOY O EJECUCIÓN

| Ítem | Archivo | Acción necesaria |
|------|---------|-----------------|
| Crash `/taller` — fallback ESTADO_CONFIG + guard formatDateTime | `app/(dashboard)/taller/page.tsx` | **Deploy a Vercel** |
| Fixes Sprint 9 (estados OT, normalización, vincular OT, flujo contextual) | Múltiples | **Deploy a Vercel** (si no se ha hecho) |

---

## 4. ROADMAP POR FASES

> Regla: no continuar agregando features hasta cerrar el gap entre comportamiento esperado del sistema y comportamiento real en UI (secciones 5 y 5b).

### FASE 0 — BLOQUEANTE (hacer antes de cualquier otra cosa)

| # | Tarea | Tipo | Dependencia |
|---|-------|------|-------------|
| 0.1 | **Deploy a Vercel** — activa fixes Sprint 9 + crash /taller | Deploy | Ninguna |
| 0.2 | **Ejecutar migración 002** (`email_config`) — sin esto `/configuracion/email` falla en silencio | Migración Supabase | Ninguna |

### FASE 1 — SEGURIDAD MULTI-TENANT 🟡 PARCIALMENTE CERRADA 2026-04-16

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1.1 | **Fix: `/taller`** — `createAdminClient()` → `await createClient()` (RLS) | `taller/page.tsx` | ✅ |
| 1.2 | **Fix: `/citas/[id]`** — `createAdminClient()` → `await createClient()` (RLS) | `citas/[id]/page.tsx` | ✅ |
| 1.3 | **Fix sistémico: todos los page components** — 8 pages migradas a `createClient()` con RLS | Multiple | ✅ |
| — | Pages corregidas: `taller/page`, `citas/page`, `citas/[id]`, `crm/vehiculos/page`, `crm/vehiculos/[id]`, `crm/clientes/[id]`, `crm/empresas/[id]`, `crm/agenda`, `configuracion/email`, `configuracion/whatsapp` | | ✅ |
| — | `app/actions/*` y `app/api/cron/*` conservan `createAdminClient()` — correcto para server actions | | ✅ intencional |

**Estado real validado en código:**
- La migración de **page components** a `await createClient()` sí está hecha y reduce de forma importante el riesgo cross-sucursal en rendering.
- FASE 1 **no está completamente cerrada** porque todavía existen riesgos de hardening:
  - server actions con `createAdminClient()` que operan por `id` sin validación explícita de sucursal
  - páginas y acciones administrativas sin guard de rol suficiente en la capa de ruta/página
  - falta validación end-to-end con segundo usuario real de otra sucursal

### FASE 1.5 — ACCESO MULTIUSUARIO 🟡 IMPLEMENTADO EN CÓDIGO, PENDIENTE DE DEPLOY / CONFIG / VALIDACIÓN

> Pendiente: deploy a Vercel + configurar Supabase Auth dashboard + validar con segundo usuario real.

| # | Tarea | Estado |
|---|-------|--------|
| 1.5.1 | **Fix invitaciones** — `redirectTo` explícito en `inviteUserByEmail` apuntando a `/auth/callback?next=/set-password` | ✅ |
| 1.5.2 | **Vista usuarios pendientes** — `email_confirmed_at` de `auth.users` via admin API para mostrar badge "Invitación pendiente" | ✅ |
| 1.5.3 | **Reenviar invitación** — `reenviarInvitacionAction` + componente `UsuarioAcciones.tsx` | ✅ |
| 1.5.4 | **Reset de contraseña desde Usuarios** — `resetPasswordAdminAction` en `UsuarioAcciones.tsx` | ✅ |
| 1.5.5 | **Recuperación de contraseña por mail** — `/forgot-password` + `forgotPasswordAction` | ✅ |
| 1.5.6 | **Set-password page** — `/set-password` para invitados y resets | ✅ |
| 1.5.7 | **Usuarios fuera del sidebar** — removido de `NAV_ITEMS`; accesible desde `/configuracion` | ✅ |
| 1.5.8 | **Validación multi-tenant con segundo usuario** | ⬜ Pendiente — requiere deploy + Supabase Auth config |

**Prerequisitos para activar en producción:**
- [ ] Deploy a Vercel
- [ ] Supabase Auth dashboard → Site URL: `https://servicetrack-one.vercel.app`
- [ ] Supabase Auth dashboard → Redirect URLs: agregar `https://servicetrack-one.vercel.app/auth/callback`
- [ ] Vercel env var: `NEXT_PUBLIC_SITE_URL=https://servicetrack-one.vercel.app`

### FASE 2 — PRODUCTO USABLE (mayor impacto sobre capacidad del equipo para operar)

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|---------|
| 2.1 | **Bandeja real — madurez operativa** | Ya conectada a `conversation_threads` + `mensajes`. Pendiente: webhook entrante, compose/respuesta, validación operativa y hardening. | Medio |
| 2.2 | **Mi Agenda — vista calendario** | Vista mes/semana/día para actividades del usuario. Base para operación diaria. Cambiar entre vistas con un clic. | Alto |
| 2.3 | **Calendario operativo de Citas** | Vista de disponibilidad al crear cita — horas del día con slots disponibles/ocupados. No drag & drop aún. | Alto |
| 2.4 | **Campos obligatorios en create** | `email` en cliente, `RFC` en empresa — HTML5 `required` + validación en server action | Bajo |
| 2.5 | **Alertas promesa vencida en Taller** | Marcar visualmente OTs con `promesa_entrega < NOW()` | Bajo |
| 2.6 | **Uppercase CSS en inputs de texto visible** | Clase CSS en `nombre`, `apellido`, `marca`, etc. Cosmético — BD ya es correcta | Bajo |

### FASE 3 — INTEGRIDAD DE NEGOCIO

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|---------|
| 3.1 | **Validación KM en OT** | `km_ingreso >= vehiculo.km_actual` | Bajo |
| 3.2 | **Flujo contextual completo en Nueva Cita** | Empresa + vehículo inline (fases 1b, 1c, 1d) | Medio |
| 3.3 | **Detección de duplicados onBlur** | Teléfono/email para cliente, placa/VIN para vehículo | Medio |

### FASE 4 — MADUREZ Y GOBERNANZA (requieren diseño previo)

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|---------|
| 4.1 | **Middleware de permisos por rol** | Protección de rutas + `usePermisos()` + UI enforcement | Alto |
| 4.2 | **Columna `updated_by`** en `ordenes_trabajo` | Requiere migración. TODO en `updateEstadoOTAction` | Bajo |
| 4.3 | **Auditoría de cambios** | Historial de quién editó qué campo | Medio |
| 4.4 | **Vista calendario para Taller** | Carga de trabajo por asesor — OTs como bloques entre `created_at` y `promesa_entrega`. Conceptualmente distinta del calendario de Citas — va en pasada separada posterior. | Alto |
| 4.5 | **Webhook WhatsApp entrante** | Sprint 8 Fase 2 | Alto |
| 4.6 | **Clasificador IA** | Sprint 8 Fase 2 | Alto |
| 4.7 | **Módulos Ventas, CSI, Seguros, Atención** | Placeholders vacíos | Muy alto |

---

## 5. BUGS ACTIVOS EN PRODUCCIÓN

### 🔴 CRÍTICO — Sistema de invitaciones de usuario roto

**Descripción:** El link de invitación enviado por Supabase Auth falla con `access_denied`, `otp_expired` o `invalid or expired`. El usuario invitado no puede activar su cuenta.
**Impacto:** El sistema es de un solo usuario en la práctica. No se puede onboardear un segundo usuario, ni validar el aislamiento multi-tenant real.
**Prerequisito de go-live:** Sin esto, cualquier prueba de multi-tenant es inválida.
**Fix requerido:** FASE 1.5.1 — diagnosticar flujo de invitación Supabase (redirect URL, expiración del token, configuración de Auth en dashboard).

### 🟡 PENDIENTE — Acceso multiusuario incompleto

Los siguientes flujos de gestión de usuarios no existen o están rotos:
- Vista de usuarios invitados/pendientes — no hay columna de estado en `/usuarios`
- Reenviar invitación — no hay acción
- Reset de contraseña desde admin — no hay acción
- Recuperación de contraseña por mail — no hay flujo de "olvidé mi contraseña" en login
- "Usuarios" en sidebar principal — debería estar solo dentro de Configuración

**Fix requerido:** FASE 1.5 completa.

### 🟡 MIGRADO — Exposición cross-sucursal en page components

**Descripción:** 10 page components usaban `createAdminClient()` (service_role) sin filtro `sucursal_id`.
**Fix aplicado 2026-04-16:** Todos los page components migrados a `await createClient()` — RLS de Supabase (`get_mi_sucursal_id()`) aplica el filtro automáticamente.
**Pendiente de validación:** El fix es correcto en código, pero **no está validado end-to-end con un segundo usuario activo en sucursal distinta**. Requiere completar FASE 1.5 (invitaciones funcionando + segundo usuario real).
**Requiere deploy:** Sí.

---

## 5b. GAP SISTEMA vs UX

Gaps entre lo que el backend hace correctamente y lo que el usuario experimenta en la interfaz. El dato en BD es correcto; la experiencia visual está incompleta.

| Gap | Estado backend | Estado UX | Impacto |
|-----|---------------|-----------|---------|
| **Uppercase en campos de texto visible** | ✅ Normalización completa en todas las acciones (create+update) | 🟡 Solo algunos campos técnicos (placa, VIN) tienen CSS `uppercase`. `nombre`, `marca`, etc. no muestran mayúsculas mientras se escribe. | Cosmético — el dato siempre llega correcto a BD |
| **Campos obligatorios en formularios de crear** | 🟡 Server action valida campos mínimos (marca/modelo/año en vehículo, nombre en cliente) | ⬜ `email` en cliente, `RFC` en empresa no tienen `required` ni advertencia en UI | El usuario puede guardar sin esos campos y no recibe feedback |
| **Validación KM en nueva OT** | ⬜ Sin validación | ⬜ Sin validación | Puede ingresar KM menor al histórico del vehículo |
| **Flujo contextual completo en Nueva Cita** | 🟡 Fase 1a implementada (`return_to` para cliente) | ⬜ No hay flujo inline para empresa ni vehículo | El usuario tiene que navegar fuera de la ruta de nueva cita |
| **Disponibilidad en Citas** | ⬜ No existe lógica de disponibilidad | ⬜ Solo kanban — sin vista de horarios ni bloqueo de slots | No se puede ver ni reservar por disponibilidad |
| **Bandeja conectada a BD** | ✅ `mensajes` + `conversation_threads` operativas | 🟡 UI ya usa datos reales, pero sigue incompleta para operación full (sin webhook entrante, sin respuesta real) | Feature parcialmente usable |
| **Invitaciones de usuario** | ✅ Supabase Auth gestiona invitaciones | 🔴 Link falla con `access_denied`/`otp_expired` — usuario no puede activar cuenta | El sistema es de un solo usuario de facto |
| **Mi Agenda — calendario** | ✅ `actividades` con `fecha_vencimiento` en BD | ⬜ Solo lista plana sin vista de día/semana/mes | Operación diaria ineficiente sin vista de tiempo |
| **Calendario de Citas** | ⬜ Sin lógica de disponibilidad | ⬜ Solo kanban — no hay vista por horario | No se puede visualizar disponibilidad al crear cita |

---

## RIESGOS TÉCNICOS Y DE SEGURIDAD

### Riesgo ALTO
| Riesgo | Estado |
|--------|--------|
| `createAdminClient()` sin filtro en page components | 🟢 Mitigado en pages críticas: migrado a `createClient()` con RLS. **Pendiente hardening adicional en server actions y validación real con segundo usuario activo** |
| **Invitaciones de usuario rotas** — sin segundo usuario real, el aislamiento multi-tenant no está validado end-to-end | 🔴 Pendiente — FASE 1.5 |

### Riesgo MEDIO
| Riesgo | Ubicación | Mitigación actual |
|--------|-----------|-------------------|
| RLS por rol en `ai_settings` y `outbound_queue` — solo valida `sucursal_id` | Migración 003 | Verificación de rol en server actions |
| `mensajes` usa `enviado_at`, no `creado_at` — código que busque `creado_at` falla | BD | Documentado en PENDIENTES.md (Bug 0b) |
| `wa_numeros` vacío — WA sin validación end-to-end | `lib/whatsapp.ts` | No bloquea desarrollo — dependencia externa |

### Riesgo BAJO
| Riesgo | Estado |
|--------|--------|
| `TECH_STACK.md` menciona n8n — decisión pivotó a código nativo | Documentado, no afecta código |
| `AGENTS.md` desactualizado — dice módulos pendientes que ya existen | Documentado |
| `hooks/` no tiene los hooks documentados en TECH_STACK.md | Documentado |

---

## 6. DEPENDENCIAS Y PASOS ANTES DE PRODUCCIÓN REAL

### Para activar WhatsApp (dependencia externa — no es deuda de código)
1. Tener cuenta Meta Business verificada
2. Número de teléfono dedicado aprobado por Meta
3. Poblar tabla `wa_numeros` con `phone_number_id`, `access_token`, `sucursal_id`, `modulo`
4. Configurar `WA_VERIFY_TOKEN` en Vercel
5. Implementar `app/api/webhooks/whatsapp/route.ts` (Sprint 8 Fase 2)
6. Smoke test: enviar mensaje → verificar fila en `mensajes` + `conversation_threads`

### Para activar dominio propio en email
1. Verificar dominio en Resend Dashboard (registros DNS)
2. Actualizar `EMAIL_FROM` en Vercel de `ServiceTrack <onboarding@resend.dev>` a `noreply@dominio.com`

### Para activar bot IA
1. Implementar `lib/ai/classify-intent.ts` y `lib/ai/detect-sentiment.ts`
2. Implementar flush de `outbound_queue` (`app/api/cron/outbound-queue-flush/route.ts`)
3. Habilitar bot: `UPDATE ai_settings SET activo = TRUE WHERE sucursal_id = '...'`

---

## 7. REGLAS PERMANENTES DEL PRODUCTO

### Identificadores de OT — regla inamovible
- `numero_ot` = identificador **interno** ServiceTrack. Formato `OT-YYYYMM-XXXX`. **Inmutable**. Nunca editar, nunca reusar.
- `numero_ot_dms` = identificador **externo** del DMS del cliente (Autoline, CDK, etc). Opcional, nullable. Nunca reemplaza a `numero_ot`.
- **Siempre mostrar ambos cuando `numero_ot_dms` exista**: lista de taller, detalle OT, tarjetas, componentes de vínculo.

### Estados OT — regla inamovible
- Fuente única de verdad: `lib/ot-estados.ts`. No duplicar transiciones ni labels en otros archivos.
- Valor canónico: `en_proceso` (no `en_reparacion`, que fue el nombre provisional y ya no existe en la BD).

### Normalización de texto — regla activa
- MAYÚSCULAS en: `nombre`, `apellido`, `apellido_2` (clientes), `nombre` (empresas), `marca`, `modelo`, `version`, `color` (vehículos), `diagnostico`, `numero_ot_dms` (OTs).
- **No normalizar nunca**: `email`, `whatsapp`, `notas_internas`, `promesa_entrega`, `vin`, URLs, tokens.

### Automatizaciones — reglas de horario y cola
- Todo mensaje WA o email debe verificar horario del bot (8:00 AM – 7:30 PM hora México).
- Fuera de horario → guardar en `outbound_queue`, no enviar directo.
- Bot IA siempre apagado por defecto (`ai_settings.activo = FALSE`). Activar solo con acción explícita de admin.

### RLS y clients de Supabase
- `createClient()` — para todas las operaciones de usuario autenticado. Respeta RLS.
- `createAdminClient()` — SOLO para operaciones de bootstrap/admin que requieren service_role. No usar en vistas de negocio sin filtro explícito de sucursal.

### Eventos internos de sistema
- OT creada / cambio de estado → insertar mensaje en `mensajes` con `canal='interno'`, `processing_status='skipped'`.
- Best-effort: el fallo del evento NO debe fallar la operación principal de OT.

### No romper módulos existentes
- Nunca modificar CRM, Citas, Taller sin entender el impacto en los otros dos.
- Cualquier cambio de schema requiere verificar migraciones anteriores y typecheck completo.

---

## 8. QUÉ CAMBIOS REQUIEREN DEPLOY

| Cambio | Tipo | Requiere deploy Vercel | Requiere migración Supabase |
|--------|------|----------------------|---------------------------|
| Crash `/taller` resuelto (page.tsx) | Código | **Sí — pendiente** | No |
| Todos los fixes Sprint 9 | Código | Sí (si no se hizo) | No |
| Migración 002 email_config | Solo BD | No | **Sí — pendiente** |
| Flujo contextual completo (fases 1b-1d) | Código | Sí | No |
| `updated_by` en ordenes_trabajo | BD + Código | Sí | Sí |
| Columna en tabla nueva | BD + Código | Sí | Sí |

---

## 9. CHECKLIST DE VALIDACIÓN MANUAL

### Antes de cualquier deploy
- [ ] `npm run build` sin errores TypeScript
- [ ] No hay referencias a `en_reparacion` en código TypeScript
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada en Vercel

### Flujo básico de humo post-deploy
- [ ] `/taller` carga sin error de servidor
- [ ] OT con estado `en_proceso` muestra badge "En proceso" (no "SIN ESTADO")
- [ ] `/taller/nuevo` crea OT y redirige al detalle
- [ ] Cambiar estado de OT en detalle funciona
- [ ] `/citas` y `/citas/nuevo` cargan sin error
- [ ] Vincular OT desde detalle de cita (`en_agencia` o `show`) funciona
- [ ] Crear cliente desde búsqueda vacía en nueva cita redirige correctamente con `?return_to=`
- [ ] `/crm/clientes/nuevo` con `?return_to=/citas/nuevo` redirige a `/citas/nuevo?cliente_id=...` al terminar

### Post-migración 002 (email_config)
- [ ] `/configuracion/email` carga sin error
- [ ] Guardar configuración de email persiste en BD

### Post-FASE 1.5 (acceso multiusuario)
- [ ] Segundo usuario puede recibir invitación y activar cuenta sin error
- [ ] Segundo usuario con rol `asesor_servicio` NO ve OTs de otras sucursales
- [ ] Segundo usuario NO ve configuración de WhatsApp/email
- [ ] Admin puede ver estado (pendiente/activo) de todos los usuarios invitados
- [ ] "Usuarios" ya no aparece en el sidebar principal

### Post-activación WhatsApp
- [ ] Tabla `wa_numeros` tiene al menos una fila con `phone_number_id` + `access_token`
- [ ] Confirmar cita envía WA al cliente
- [ ] Mensaje aparece en tabla `mensajes` con `canal='whatsapp'`
- [ ] `conversation_threads` tiene hilo creado o actualizado

---

## 10. ARQUITECTURA DE DECISIONES CLAVE (ADR ligero)

| # | Decisión | Motivo | Fecha |
|---|----------|--------|-------|
| ADR-01 | Automatizaciones en código nativo (Next.js + Vercel Cron) — no n8n | Reducir dependencias externas, control total del flujo | 2026-04-13 |
| ADR-02 | `mensajes` como fuente de verdad conversacional, `wa_mensajes_log` como log técnico legacy | Separar lógica de negocio del log de bajo nivel de API | 2026-04-14 |
| ADR-03 | `conversation_threads.contexto_id` sin FK declarado (FK lógica en código) | Permite apuntar a múltiples tablas (`citas`, `ordenes_trabajo`, `cotizaciones`) sin polimorfismo en BD | 2026-04-14 |
| ADR-04 | `canal='interno'` para eventos de sistema en bandeja | Separa conversaciones con clientes de trazabilidad interna de operaciones | 2026-04-15 |
| ADR-05 | `numero_ot` ≠ `numero_ot_dms` — identificadores duales nunca intercambiables | El DMS del cliente y ServiceTrack coexisten sin colisión de identificadores | 2026-04-15 |
| ADR-06 | `vincularOTCitaAction` — regla vehiculo_id null-permisiva | Solo bloquear conflictos explícitos; no penalizar registros incompletos | 2026-04-15 |
| ADR-07 | Crash `/taller`: fallback defensivo en render, no en query | La query siempre selecciona `estado`; el crash era en el render con valor desconocido | 2026-04-16 |
| ADR-08 | Migración sistémica `createAdminClient()` → `createClient()` en todos los page components | RLS via `get_mi_sucursal_id()` es más robusto que filtros manuales; server actions conservan admin intencionalmente | 2026-04-16 |
