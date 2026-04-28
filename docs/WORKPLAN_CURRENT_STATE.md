# WORKPLAN_CURRENT_STATE.md — ServiceTrack
> **FUENTE DE VERDAD ÚNICA del proyecto. Todo análisis, bug, decisión y mejora debe integrarse aquí.**
> Documento de estado consolidado para arquitectos, asistentes IA y equipo de desarrollo.
> **Última actualización:** 2026-04-28 (P0.3 BotIA Operational Brain — docs/ai/ 9 archivos, lib/ai/botia-brain.ts, integración appointment-flow.ts)
> **Sprint cerrado:** Sprint 9 + Sprint 10 (bot seguimiento) + P0 BotIA (commit 713e605) + P0.2 BotIA CRM+Vehículo (commit d57c8c2) + P0.2.1 hard gates (commit 8fdc771) + P0.3 Operational Brain
> **Estado general:** ~47% del producto completo — CRM+Citas+Taller+Usuarios operativos, bot con flujo completo captura nombre+vehículo+servicio+fecha+hora+confirmación. Demo pendiente de re-prueba con teléfono 5511118888 (validar: nombre capturado, vehiculo_personas poblado, cita.vehiculo_id NOT NULL, cita.servicio NOT NULL, horarios filtran pasados para hoy).

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

**Lo que está roto o pendiente de deploy/activación:**
- `/taller` — crash resuelto en código, **requiere deploy a Vercel para activarse**.
- **Acceso multiusuario roto** — el link de invitación falla con `access_denied` / `otp_expired`. Migración 009 creada pero sin ejecutar. Sin segundo usuario funcional no se puede validar aislamiento multi-tenant real.
- Bandeja UI — conecta a `conversation_threads` + `mensajes`, pero incompleta: webhook WA implementado en código pero sin activar (requiere número Meta + config externa), sin compose/respuesta real.
- **WhatsApp + IA MVP** — código completo (webhook, classify-intent, detect-sentiment, outbound-queue-flush), pero nada activo en producción: requiere deploy + `wa_numeros` poblado + `WA_VERIFY_TOKEN` + habilitar `ai_settings`.
- **Migración 018** — ✅ ejecutada en Supabase producción. `citas` tiene `contacto_bot`, `confirmacion_cliente`, `confirmacion_at`.
- **Migración 019 — ⬜ PENDIENTE de ejecutar.** `actividades` aún no tiene columna `cita_id`. El bot crea la cita correctamente, pero la actividad de trazabilidad falla silenciosamente hasta ejecutar esta migración.
- **BotIA — ⬜ ai_settings no configurado.** El bot crea citas con `asesor_id = NULL` hasta que se configure `escalation_assignee_id` en la fila `ai_settings` de la sucursal. La cita NO aparece en Mi Agenda de nadie sin este paso.
- **Demo NO cerrada** — no cerrar la demo del bot hasta: (a) migración 019 ejecutada, (b) `ai_settings.escalation_assignee_id` configurado, (c) actividad visible en BD con `cita_id`, (d) cita visible en Mi Agenda del responsable.

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
| `009_roles_permisos_schema.sql` | Política SELECT en `usuarios`; crea `roles`, `rol_permisos`, `usuario_roles` con RLS correcto; grants a `authenticated` | ✅ Ejecutada 2026-04-22 |
| `010_ventas_leads.sql` | Tablas `leads` + `ventas_perdidas` con RLS | ⬜ Pendiente crear |
| `011_csi_schema.sql` | Tablas CSI: `csi_encuestas`, `csi_preguntas`, `csi_envios`, `csi_respuestas` | ⬜ Pendiente crear |
| `012_seguros_schema.sql` | ENUMs `tipo_poliza`/`estado_poliza`; tablas `companias_seguro` + `seguros_vehiculo` | ⬜ Pendiente crear |
| `013_workflow_studio.sql` | Tablas `automation_rules` + `automation_rule_logs` | ⬜ Pendiente crear |
| `015_citas_asesor_and_agenda_config.sql` | `asesor_id` en `citas` + `agenda_vista_default` en `configuracion_citas_sucursal` | ✅ Ejecutada |
| `018_add_bot_confirmation_fields_to_citas.sql` | `contacto_bot`, `confirmacion_cliente`, `confirmacion_at` en `citas` | ✅ Ejecutada |
| `019_add_cita_id_to_actividades.sql` | `cita_id UUID` + índice en `actividades` — trazabilidad BotIA | ⬜ **Pendiente ejecutar en producción** |

### 2.5 Automatizaciones y mensajería

| Canal | Estado |
|-------|--------|
| Email (Resend) — eventos de citas | ✅ Operativo |
| Cron recordatorios citas 24h (9 AM Vercel) | ✅ Operativo |
| WhatsApp saliente (`lib/whatsapp.ts`) | ✅ Implementado — **bloqueado: `wa_numeros` vacío** |
| Eventos internos OT en bandeja | ✅ Operativo (`canal='interno'`, `processing_status='skipped'`) |
| Webhook WhatsApp entrante | 🟡 Código completo (`app/api/webhooks/whatsapp/route.ts`) — **no activo**: requiere deploy + `WA_VERIFY_TOKEN` + config Meta + `wa_numeros` poblado |
| Clasificador de intención IA (`lib/ai/classify-intent.ts`) | 🟡 Código completo — **no activo**: `ai_settings.activo=FALSE` por defecto; ninguna fila `ai_settings` configurada en producción |
| Detector de sentimiento IA (`lib/ai/detect-sentiment.ts`) | 🟡 Código completo — **no activo**: mismo control que intent |
| Flush de `outbound_queue` (cron cada 15 min) | 🟡 Código completo (`app/api/cron/outbound-queue-flush/route.ts`) — **no activo**: requiere deploy para que Vercel registre el cron |

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
| Crash `/taller` — fallback ESTADO_CONFIG + guard formatDateTime | `app/(dashboard)/taller/page.tsx` | ✅ Deploy realizado 2026-04-22 |
| FASE 1.5 (usuarios/invitaciones/roles) | Múltiples | ✅ Deploy realizado 2026-04-22 |
| Fixes Sprint 9 (estados OT, normalización, vincular OT, flujo contextual) | Múltiples | ✅ Deploy realizado 2026-04-22 |

---

## 4. ROADMAP POR FASES

> Regla: no continuar agregando features hasta cerrar el gap entre comportamiento esperado del sistema y comportamiento real en UI (secciones 5 y 5b).

### FASE 0 — BLOQUEANTE ✅ CERRADA 2026-04-22

| # | Tarea | Tipo | Estado |
|---|-------|------|--------|
| 0.1 | Deploy a Vercel — activa fixes Sprint 9 + crash /taller | Deploy | ✅ Realizado 2026-04-22 |
| 0.2 | Ejecutar migraciones 001-009 | Migraciones Supabase | ✅ Todas aplicadas 2026-04-22 |

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

### FASE 1.5 — ACCESO MULTIUSUARIO 🟡 ACTIVO EN PRODUCCIÓN — PENDIENTE VALIDACIÓN MANUAL

> **Diagnóstico resuelto 2026-04-22:** El error "Could not find the table public.roles" y el related error de `usuario_roles` eran causados por RLS activo sin políticas (policies fallaron al crearse porque `get_mi_grupo_id()` se definía DESPUÉS de las policies en SUPABASE_SCHEMA.sql). La tabla `usuarios` tampoco tenía SELECT policy, por lo que la lista siempre retornaba vacía con `createClient()`.
>
> **Fix:** Migración `009_roles_permisos_schema.sql` creada. Pendiente de ejecutar en Supabase.

| # | Tarea | Estado |
|---|-------|--------|
| 1.5.1 | **Fix invitaciones** — `redirectTo` explícito en `inviteUserByEmail` apuntando a `/auth/callback?next=/set-password` | ✅ |
| 1.5.2 | **Vista usuarios pendientes** — `email_confirmed_at` de `auth.users` via admin API para mostrar badge "Invitación pendiente" | ✅ |
| 1.5.3 | **Reenviar invitación** — `reenviarInvitacionAction` + componente `UsuarioAcciones.tsx` | ✅ |
| 1.5.4 | **Reset de contraseña desde Usuarios** — `resetPasswordAdminAction` en `UsuarioAcciones.tsx` | ✅ |
| 1.5.5 | **Recuperación de contraseña por mail** — `/forgot-password` + `forgotPasswordAction` | ✅ |
| 1.5.6 | **Set-password page** — `/set-password` para invitados y resets | ✅ |
| 1.5.7 | **Usuarios fuera del sidebar** — removido de `NAV_ITEMS`; accesible desde `/configuracion` | ✅ |
| 1.5.9 | **Fix `/usuarios` vacío + schema RLS** — migración 009 creada: política SELECT en `usuarios`, tablas `roles`/`rol_permisos`/`usuario_roles` con RLS correcto | ✅ Código — 🔴 Pendiente ejecutar migración |
| 1.5.10 | **Fix `/usuarios/roles`** — tablas ya en migración 009; `roles/page.tsx` usa `admin` client (correcto) | ✅ Resuelto con migración 009 |
| 1.5.11 | **Página editar rol** — `/usuarios/roles/[id]` — permite editar permisos de un rol existente | ✅ Creado: `roles/[id]/page.tsx` + `EditRolClient.tsx` |
| 1.5.12 | **Fix encoding UsuarioAcciones.tsx + page.tsx** — textos mojibake corregidos | ✅ Resuelto |
| 1.5.8 | **Validación multi-tenant con segundo usuario** | ⬜ Pendiente — requiere migración + deploy + segundo usuario real |

**Estado en producción (2026-04-22):**
- [x] **Migración 009** ejecutada en Supabase
- [x] **Deploy a Vercel** realizado — `servicetrack-one.vercel.app`
- [ ] **Validación manual** del flujo completo de invitaciones (pendiente)

**Checklist de cierre post-deploy:**
- [ ] `/usuarios` muestra lista de usuarios (no vacía)
- [ ] Invitar usuario → badge "Invitación pendiente" aparece
- [ ] Reenviar invitación funciona
- [ ] Usuario invitado acepta → se establece contraseña → login → accede
- [ ] Reset contraseña desde admin funciona
- [ ] `/forgot-password` → email llega → link redirige a `/set-password`
- [ ] `/usuarios/roles` carga sin error "table not found"
- [ ] Crear nuevo rol → guarda permisos correctamente
- [ ] Validar aislamiento: segundo usuario en sucursal X NO ve datos de sucursal Y

### FASE 2 — PRODUCTO USABLE (mayor impacto sobre capacidad del equipo para operar)

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|---------|
| 2.1 | **Bandeja real — madurez operativa** | Ya conectada a `conversation_threads` + `mensajes`. Pendiente: webhook entrante, compose/respuesta, validación operativa y hardening. | Medio |
| 2.2 | **Mi Agenda — vista calendario** | Vista mes/semana/día para actividades del usuario. Base para operación diaria. Cambiar entre vistas con un clic. | Alto |
| 2.3 | **Calendario operativo de Citas** | Vista de disponibilidad al crear cita — horas del día con slots disponibles/ocupados. No drag & drop aún. | Alto |
| 2.4 | **Campos obligatorios en create** | `email` en cliente, `RFC` en empresa — HTML5 `required` + validación en server action | Bajo |
| 2.5 | **Alertas promesa vencida en Taller** | Marcar visualmente OTs con `promesa_entrega < NOW()` | Bajo |
| 2.6 | **Uppercase CSS en inputs de texto visible** | Clase CSS en `nombre`, `apellido`, `marca`, etc. Cosmético — BD ya es correcta | Bajo |

### FASE 2b — BASE OPERATIVA CONFIGURABLE (prioridad antes de FASE 3 y módulos secundarios)

> Puente entre "tenemos el sistema" y "el sistema se opera con parámetros reales del cliente". Basado en análisis de modelo Autoline (2026-04-24). No bloquea activación de FASE 5 (WA).

| # | Tarea | Descripción | Esfuerzo |
|---|-------|-------------|---------|
| 2b.1 | **Ejecutar migración 015** en Supabase | `asesor_id` en `citas` + `agenda_vista_default` en `configuracion_citas_sucursal` | Inmediato (SQL ya listo) |
| 2b.2 | **Migración 016** — parámetros de automatización | Columnas en `configuracion_citas_sucursal`: `horas_recordatorio` (default 24), `horas_recordatorio_2` (default 2), `ventana_noshow_horas` (default 24), `noshow_activo` (bool, default true) | Bajo |
| 2b.3 | **Migración 016** — flags operativos en `usuarios` | `puede_ser_asesor` (bool), `puede_recibir_citas` (bool), `cuota_citas_dia` (int nullable) | Bajo |
| 2b.4 | **UI parámetros de automatización** | Exponer en `/configuracion/citas`: recordatorio, ventana no-show, toggle no-show activo | Bajo |
| 2b.5 | **Cron recordatorios**: leer `horas_recordatorio` de BD | `app/api/cron/recordatorios-citas/route.ts` lee config de BD en lugar de hardcoded 24h | Bajo |
| 2b.6 | **Cron no-show**: leer `ventana_noshow_horas` de BD | Mismo archivo, ventana configurable por sucursal en lugar de hardcoded | Bajo |
| 2b.7 | **Agenda: filtrar asesores por flag** | `/citas/nuevo` solo muestra usuarios con `puede_ser_asesor=true` | Bajo |

**Qué NO se copia de Autoline:** UI de escritorio, modelo on-prem, batch processing, reemplazo del DMS, retrocompatibilidad legacy.

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
| 4.5 | **Módulos Ventas, CSI, Seguros, Atención** | Placeholders vacíos | Muy alto |

### FASE 6 — UX / OPERACIÓN + MÓDULOS RESTANTES ✅ DESPLEGADA 2026-04-22

> FASE 1.5 activa en producción (pendiente validación manual). FASE 5 desplegada (pendiente número WA). FASE 6 completada y en producción.

| # | Feature | Estado |
|---|---------|--------|
| 6.1 | **Mi Agenda — vista calendario** semana/mes con actividades reales | ✅ `AgendaCalendario.tsx` en producción |
| 6.2 | **Disponibilidad al crear cita** — slots 30 min, ocupados por fecha en DB | ✅ MVP: slots 08:00–18:00 hardcodeados. TODO: leer desde `configuracion_sucursal` cuando exista |
| 6.3 | **Taller — Vista calendario** | ⬜ Pasada posterior separada |
| 6.4 | **Workflow Studio** — lista + crear reglas en `automation_rules` DB | ✅ `/bandeja/workflow-studio` en producción |
| 6.5 | **AI Automation Copilot** | ⬜ Pendiente — requiere Workflow Studio maduro |
| 6.6 | **Agentes por módulo** | ⬜ Pendiente — requiere FASE 5 activa |
| 6.7 | **Ventas MVP** — kanban leads 6 columnas, stats en tiempo real | ✅ Corregido 2026-04-22: estados ENUM reales (`cotizado/negociando/cerrado_ganado/cerrado_perdido`), FK `asesor_id`, columna `nombre` |
| 6.8 | **CSI MVP** — encuestas, envíos, score promedio | ✅ Corregido 2026-04-22: `respuesta_numerica`, modulos `taller/ventas/citas`, grupo via `ensureUsuario` |
| 6.9 | **Seguros MVP** — pólizas con alertas de vencimiento | ✅ `/seguros` en producción |
| 6.10 | **Bandeja operativa madura** | ⬜ Pendiente — requiere webhook WA activo |

### FASE 5 — WHATSAPP + AUTOMATIZACIONES + IA MVP 🟡 CÓDIGO COMPLETO EN PRODUCCIÓN — PENDIENTE ACTIVACIÓN EXTERNA

> **Estado 2026-04-22:** Todo el código de FASE 5 está implementado y TypeScript pasa sin errores. Nada está activo en producción. La activación requiere deploy + configuración externa (número Meta, `wa_numeros`, `WA_VERIFY_TOKEN`, `ai_settings`).
>
> **Prerequisito de activación:** FASE 1.5 completamente validada es el orden recomendado, pero el código fue implementado de forma anticipada. La activación del webhook y el bot puede hacerse independientemente una vez que haya número Meta activo.
>
> **Nota:** WhatsApp-first para el cliente final — NO soporte B2B para compradores del sistema.

| # | Tarea | Estado código | Estado producción |
|---|-------|--------------|------------------|
| 5.1 | **WhatsApp saliente real** (`lib/whatsapp.ts`) | ✅ Código completo | 🔴 Sin `wa_numeros` — dependencia externa |
| 5.2 | **Webhook entrante** (`app/api/webhooks/whatsapp/route.ts`) | ✅ Código completo | 🔴 No activo — requiere deploy + `WA_VERIFY_TOKEN` + Meta config |
| 5.3 | **Automatizaciones determinísticas** (citas → WA) | ✅ Código completo | 🔴 No activo — mismo bloqueante que 5.1 |
| 5.3b | **Recordatorio 2h** (`outbound_queue` al confirmar cita) | ✅ Código completo — encola en `outbound_queue` con `send_after = cita - 2h` | 🔴 No activo — depende de flush cron activo |
| 5.3c | **No-show detection** (cron diario detecta citas `confirmada` de ayer, envía WA, actualiza estado) | ✅ Código completo — en `recordatorios-citas/route.ts` | 🔴 No activo — depende de WA activo |
| 5.3d | **Aviso vehículo listo** — WA automático al cliente cuando OT → `listo` | ✅ 2026-04-27: `mensajeVehiculoListo()` en `lib/whatsapp.ts`; integrado en `updateEstadoOTAction` con número de OT y dirección | 🔴 No activo — depende de `wa_numeros` activo |
| 5.4 | **Bandeja operativa** (compose, respuesta, filtros) | 🟡 Asesor puede responder desde bandeja (`enviarMensajeAsesorAction`). Webhook entrante pendiente. | ⬜ Webhook WA no activo |
| 5.5 | **IA: clasificador de intención** (`lib/ai/classify-intent.ts`) | ✅ Código completo — 12 intents incl. `confirmar_asistencia` y `consulta_cita_propia` (2026-04-27) | 🔴 No activo — `ai_settings.activo=FALSE` por defecto |
| 5.6 | **IA: detector de sentimiento** (`lib/ai/detect-sentiment.ts`) | ✅ Código completo | 🔴 No activo — mismo control que 5.5 |
| 5.7 | **Handoff bot → humano** (en webhook, umbral `confidence_threshold`) | ✅ Código completo | 🔴 No activo — depende de 5.2 y 5.5 |
| 5.8 | **Flush `outbound_queue`** (`app/api/cron/outbound-queue-flush/route.ts`) | ✅ Código completo | 🔴 No activo — requiere deploy para que Vercel registre el cron |
| 5.9 | **Bot: seguimiento de citas ya agendadas** — `consultarCitasCliente` + `confirmarCitaBot` | ✅ 2026-04-27: herramientas en `lib/ai/bot-tools.ts`; bot redesignado en `bot-citas.ts` con prioridad seguimiento → confirmación → nueva cita | 🔴 No activo — depende de WA activo; testeable en Demo Bot |
| 5.9b | **P0 BotIA — crearCitaBot con asesor_id + actividad** — commit 713e605 | ✅ `crearCitaBot` sets `asesor_id` desde `ai_settings.escalation_assignee_id`; crea actividad `cita_agendada` best-effort; `cita_proxima` en contexto; guardrails anti-hallucination; WA en Bandeja | ⬜ **Demo pendiente validación** — requiere migración 019 + `ai_settings` configurado |
| 5.9c | **P0.2 BotIA CRM Enrichment + Vehicle Resolution** — commit d57c8c2 | ✅ Bot captura nombre real si CLIENTE DEMO (`actualizarNombreClienteBot`); resuelve/crea vehículo (`buscarVehiculosCliente`, `crearVehiculoYVincularBot`); `vehiculo_id` en cita; `leerInfoSucursal` inyecta dirección/horario/teléfono en system prompt. Nuevos parsers: `parsearNombre`, `parsearVehiculo`, `parsearSeleccion`, `isNegacion`. Guard `MARCAS_CONOCIDAS` evita false positives. | ⬜ **Demo pendiente re-prueba** — ver P0.2.1 abajo |
| 5.9d | **P0.2.1 Hard gates BotIA** — commit 8fdc771 | ✅ Fix raíz del fallo P0.2 (test real 5511117777): Steps A y B ahora completamente deterministas (`skipBot=true`) — el LLM nunca se invoca para captura de nombre/vehículo. `isClientePlaceholder()` en `appointment-flow.ts`. `crearCitaBot` rechaza `vehiculo_id=null` y `servicio=null` antes de tocar BD. `buscarDisponibilidad` filtra slots pasados para hoy con buffer 30 min (Mexico_City). `bot-citas.ts` pasa `vehiculo_id` desde `ctx.appointment_flow` al handler de `crear_cita`. Vehículo obligatorio: `isNegacion` en `capturar_vehiculo` mantiene al usuario en el mismo paso. Respuestas de frustración en todos los pasos deterministas. Step C solo avanza cuando `nombre_resuelto && vehiculo_resuelto`. | ⬜ **Demo pendiente** — teléfono 5511118888; validar: nombre capturado en CRM, vehiculo_personas poblado, cita.vehiculo_id NOT NULL, cita.servicio NOT NULL, slots pasados filtrados |
| 5.10 | **Workflow Studio / AI Copilot** | ⬜ No implementado | ⬜ — pasada futura |
| 5.11 | **Bot flotante / overlay por módulo** | ⬜ Sugerencia futura — NO implementar aún. El bot hoy vive solo en Automatizaciones/Demo. En el futuro podría invocarse desde Citas, Taller, CRM como ventana flotante. | ⬜ — pendiente diseño |
| 5.12 | **CRM enrichment del bot** — vehículo del cliente en contexto del bot | 🟡 Parcial — vehículo se resuelve antes de crear la cita (P0.2). El bot no menciona el vehículo en el seguimiento de citas existentes (JOIN `citas → vehiculos` pendiente en `BotContexto`). | ⬜ — completar en pasada futura junto a seguimiento enriquecido |
| 5.13 | **Automation Engine sin n8n** — reglas determinísticas | ⬜ Las reglas de escalación, timeouts y handoff deben configurarse desde UI. `automation_rules` existe en BD pero sin engine de ejecución. | ⬜ — diseño pendiente |
| 5.14 | **P0.3 BotIA Operational Brain** — documentación y constantes centralizadas | ✅ 2026-04-28: `docs/ai/` con 9 archivos (BOTIA_OPERATIONAL_BRAIN, INTENTS, ENTITIES, SLOT_RULES, RESPONSE_POLICIES, ESCALATION_RULES, LEARNING_POLICY, TRAINING_CORPUS, MODULE_PLAYBOOKS). `lib/ai/botia-brain.ts` con constantes centralizadas. `appointment-flow.ts` integrado: ya no tiene duplicados inline — importa BOTIA_PLACEHOLDER_NOMBRES, BOTIA_FRUSTRATION_PATTERNS, BOTIA_CONFIRMATION_PATTERNS, BOTIA_NEGATION_PATTERNS, BOTIA_SCHEDULING_PHRASES, BOTIA_SERVICE_SYNONYMS, BOTIA_VEHICLE_HINTS desde botia-brain.ts. Política de aprendizaje supervisado documentada. Corpus semilla con ~45 ejemplos YAML clasificados. | ⬜ No activo en producción — bot requiere WA + ai_settings |

---

## 5. BUGS ACTIVOS EN PRODUCCIÓN

### 🟡 PENDIENTE DEPLOY — Sistema multiusuario: fix completo en código, pendiente migración + deploy

**Diagnóstico resuelto 2026-04-22:**
- "Could not find the table public.roles" / "Could not find a relationship usuarios → usuario_roles": las tablas existen en el schema original pero sus políticas RLS fallaron al crearse (referenciaban `get_mi_grupo_id()` antes de que la función existiera). Con RLS activo y sin policies → acceso denegado → PostgREST reporta "table not found".
- `/usuarios` siempre vacío: la tabla `usuarios` tiene RLS habilitado pero sin ninguna política SELECT. `createClient()` (user JWT) no podía leer nada.

**Fixes aplicados en código (2026-04-22):**
- Migración `009_roles_permisos_schema.sql` creada: añade SELECT policy a `usuarios`, recrea `roles`/`rol_permisos`/`usuario_roles` con RLS correcto y grants a `authenticated`.
- Bugs de encoding corregidos en `app/actions/usuarios.ts`.

**Resuelto 2026-04-22:** migración 009 ejecutada en Supabase. Deploy activo en Vercel.

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
| **Bandeja conectada a BD** | ✅ `mensajes` + `conversation_threads` operativas | 🟡 UI ya usa datos reales. Webhook entrante implementado en código pero sin activar. Sin compose/respuesta real. | Feature parcialmente usable |
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

### Para activar WhatsApp (código ya completo — solo configuración externa pendiente)
1. Tener cuenta Meta Business verificada con número de teléfono aprobado por Meta
2. Poblar tabla `wa_numeros`: insertar fila con `phone_number_id`, `access_token`, `sucursal_id`, `modulo='general'`, `activo=true`
3. Configurar `WA_VERIFY_TOKEN` en Vercel (cualquier string secreto)
4. Deploy a Vercel (activa el cron y el webhook)
5. En Meta Business Manager → WhatsApp → Configuración → Webhook: URL `https://servicetrack-one.vercel.app/api/webhooks/whatsapp`, Verify Token = valor de `WA_VERIFY_TOKEN`, suscribirse al evento `messages`
6. Smoke test saliente: confirmar cita → mensaje aparece en `mensajes` + `wa_mensajes_log`
7. Smoke test entrante: enviar WA al número → verificar fila en `mensajes` con `direccion='entrante'` + `conversation_threads` creado/actualizado

### Para activar dominio propio en email
1. Verificar dominio en Resend Dashboard (registros DNS)
2. Actualizar `EMAIL_FROM` en Vercel de `ServiceTrack <onboarding@resend.dev>` a `noreply@dominio.com`

### Para activar bot IA (código ya implementado)
1. ✅ `lib/ai/classify-intent.ts` — clasificador de intención (Claude Haiku)
2. ✅ `lib/ai/detect-sentiment.ts` — detector de sentimiento (Claude Haiku)
3. ✅ `app/api/cron/outbound-queue-flush/route.ts` — cron de flush en `vercel.json`
4. Verificar que `ANTHROPIC_API_KEY` esté en Vercel (All Environments) — ya configurada según tabla §2.6
5. Habilitar bot: `UPDATE ai_settings SET activo = TRUE WHERE sucursal_id = '...'`

### Para activar webhook WhatsApp (código ya implementado)
1. Configurar `WA_VERIFY_TOKEN` en Vercel (cualquier string secreto)
2. En Meta Business Manager → WhatsApp → Webhook: URL `https://servicetrack-one.vercel.app/api/webhooks/whatsapp`, Verify Token = el valor de `WA_VERIFY_TOKEN`
3. Suscribirse al evento `messages`
4. Poblar `wa_numeros` con `phone_number_id`, `access_token`, `sucursal_id`, `modulo='general'`

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
| Migración 009 (roles/permisos/RLS) | BD | No | **Sí — pendiente** |
| Migración 002 email_config | BD | No | **Sí — pendiente** |
| FASE 1.5 (usuarios/invitaciones) | Código | **Sí — pendiente** | No (usa 009) |
| Webhook WA (`app/api/webhooks/whatsapp/route.ts`) | Código | **Sí** | No (usa config externa) |
| Cron flush (`app/api/cron/outbound-queue-flush/route.ts`) | Código | **Sí** (activa el cron en Vercel) | No |
| IA MVP (`lib/ai/classify-intent.ts`, `lib/ai/detect-sentiment.ts`) | Código | **Sí** | No (requiere `ai_settings` habilitado) |
| `vercel.json` (nuevo cron outbound-queue-flush) | Config | **Sí** | No |
| Flujo contextual completo (fases 1b-1d) | Código | Sí | No |
| `updated_by` en ordenes_trabajo | BD + Código | Sí | Sí |
| Encoding fixes `UsuarioAcciones.tsx` + `usuarios/page.tsx` | Código | **Sí — pendiente** | No |
| `/usuarios/roles/[id]` — edit rol page | Código | **Sí — pendiente** | No (usa tablas de 009) |
| Recordatorio 2h en `outbound_queue` al confirmar cita | Código | **Sí — pendiente** | No |
| No-show detection en cron `recordatorios-citas` | Código | **Sí — pendiente** | No |
| `mensajeRecordatorio2h` + `mensajeNoShow` en `lib/whatsapp.ts` | Código | **Sí — pendiente** | No |

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

### Post-activación FASE 5 (WhatsApp + IA)

**WhatsApp saliente:**
- [ ] `wa_numeros` tiene fila con `phone_number_id` + `access_token` + `activo=true`
- [ ] Confirmar cita envía WA al cliente
- [ ] Fila aparece en `mensajes` con `canal='whatsapp'`, `direccion='saliente'`
- [ ] `conversation_threads` tiene hilo creado o actualizado
- [ ] `wa_mensajes_log` tiene fila con `status='enviado'`

**Webhook entrante:**
- [ ] `WA_VERIFY_TOKEN` configurado en Vercel
- [ ] Meta webhook verificado (GET handshake devuelve challenge correctamente)
- [ ] Meta suscrito al evento `messages`
- [ ] Mensaje entrante de cliente → fila en `mensajes` con `direccion='entrante'`, `message_source='customer'`
- [ ] `conversation_threads` actualizado con `last_customer_message_at`
- [ ] Dedup funciona: reenviar mismo mensaje de Meta no crea fila duplicada

**Cron outbound-queue-flush:**
- [ ] Vercel muestra el cron en el dashboard (`*/15 * * * *`)
- [ ] Insertar fila manualmente en `outbound_queue` con `estado='pending'`, `approval_required=false`, `send_after=NOW()` → se procesa en siguiente corrida
- [ ] Fila procesada → `estado='sent'`, fila en `automation_logs`

**IA (requiere número WA activo + mensaje entrante real):**
- [ ] Insertar fila en `ai_settings` con `activo=true` para la sucursal
- [ ] Mensaje entrante de texto → `ai_intent` y `ai_sentiment` poblados en `mensajes`
- [ ] `processing_status='processed'` en el mensaje
- [ ] Mensaje con confianza baja → `conversation_threads.estado='waiting_agent'`

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
| ADR-09 | Migración 009 para roles/permisos en lugar de cambiar el código | Las tablas ya estaban definidas en el schema; el bug era en la BD (RLS sin policies), no en la lógica de negocio. Código no necesita cambios. | 2026-04-22 |
| ADR-10 | Webhook WA clasifica IA inline (síncrono) en lugar de diferido por cron | Haiku es suficientemente rápido (<2s) para no bloquear el webhook (<20s límite Meta). Mensajes sin AI activo quedan en `processing_status='pending'` — pueden clasificarse retroactivamente. | 2026-04-22 |
| ADR-11 | Lookup de cliente en webhook por `whatsapp.eq.{phone}` OR `whatsapp.eq.+{phone}` | Meta envía teléfonos sin `+`. Los registros en `clientes` pueden tener o no el prefijo. Solución pragmática para MVP sin normalización forzada en BD. | 2026-04-22 |
| ADR-12 | Parámetros de automatización configurables en BD, no hardcodeados | `horas_recordatorio`, `ventana_noshow_horas`, `noshow_activo` como columnas en `configuracion_citas_sucursal`. Cada sucursal tiene sus tiempos. Evita cambios de código para ajustar comportamiento. | 2026-04-24 |
| ADR-13 | Flags operativos en `usuarios` independientes del rol | `puede_ser_asesor`, `puede_recibir_citas`, `cuota_citas_dia` viven en la fila del usuario, no en el rol. El rol define visibilidad; el flag define capacidad operativa. Permite un gerente que no es asesor, o un asesor sin cuota. | 2026-04-24 |
| ADR-14 | Roadmap prioriza activación WA+IA y base operativa configurable sobre módulos secundarios | Ventas/CSI/Seguros/Atención son importantes pero no son el diferenciador central del producto. Citas + Automatizaciones + Bot WA es lo que genera valor operativo inmediato para el cliente piloto. | 2026-04-24 |
| ADR-15 | Autoline como referencia de lógica operativa, no de UI ni arquitectura | Del modelo Autoline se adaptan: parámetros configurables por sucursal, flags por usuario, agenda como cockpit. No se copian: UI de escritorio, on-prem, batch, retrocompatibilidad legacy. | 2026-04-24 |

---

## 11. BASE OPERATIVA — MODELO DE REFERENCIA (Autoline adaptado)

> Analizado 2026-04-24. Objetivo: integrar la lógica operativa de un DMS maduro sin copiar su complejidad técnica ni su UI legacy.

### 11.1 Modelo de usuario en capas

```
usuario
  └── rol base          (define qué módulos ve: asesor_servicio, gerente, admin)
        └── permisos por módulo  (puede_ver, puede_crear, puede_editar, puede_eliminar)
              └── alcance         (sucursal_id via RLS, ya implementado)
                    └── flags operativos  (puede_ser_asesor, puede_recibir_citas — TODO)
```

**Lo que ya existe:** rol + permisos + alcance (RLS).
**Lo que falta:** flags operativos en `usuarios` (migración 016).

### 11.2 Configuración por módulo/sucursal

| Módulo | Tabla de config | Estado |
|--------|----------------|--------|
| Citas | `configuracion_citas_sucursal` | ✅ Existe — falta: `horas_recordatorio`, `ventana_noshow_horas`, `noshow_activo` |
| Taller | `configuracion_taller_sucursal` | ✅ Existe |
| CRM | — | ⬜ No existe — baja prioridad |
| Ventas | — | ⬜ No existe — baja prioridad |
| Bandeja/IA | `ai_settings` | ✅ Existe (`activo`, `horario_bot_inicio/fin`, `confidence_threshold`) |

### 11.3 Agenda como cockpit operativo

La agenda de `/agenda` es el punto de coordinación de la operación diaria. No es solo "mis actividades". Objetivo final:
- **Vista personal** (hoy): actividades + citas asignadas al usuario
- **Vista de equipo** (futuro): carga de trabajo por asesor, slots disponibles vs ocupados
- **Vista de disponibilidad** (FASE 2.3 pendiente): al crear cita, mostrar horarios disponibles del asesor asignado

### 11.4 Parámetros de automatización configurables (FASE 2b)

| Parámetro | Tabla | Default | Usado por |
|-----------|-------|---------|-----------|
| `horas_recordatorio` | `configuracion_citas_sucursal` | 24 | Cron `recordatorios-citas` |
| `horas_recordatorio_2` | `configuracion_citas_sucursal` | 2 | `outbound_queue` al confirmar cita |
| `ventana_noshow_horas` | `configuracion_citas_sucursal` | 24 | Cron no-show detection |
| `noshow_activo` | `configuracion_citas_sucursal` | true | Cron no-show detection |
| `agenda_vista_default` | `configuracion_citas_sucursal` | `semana` | `/agenda` sin parámetro de URL |

**Hoy:** todos hardcodeados en código. **FASE 2b:** mover a BD con UI de configuración.

### 11.5 Orden de prioridad actualizado

```
FASE 1.5  → Cierre multi-usuario (pendiente smoke test manual)
FASE 2    → Agenda + Calendario Citas [YA CONSTRUIDAS]
FASE 2b   → Base operativa configurable (migración 015 + 016, UI params, flags usuario)
FASE 5    → Activar WA+IA (código listo, dependencia: número Meta)
FASE 3    → Integridad de negocio (KM, duplicados, flujo contextual)
FASE 4    → Gobernanza (middleware permisos, auditoría, taller calendario)
Módulos   → Ventas/CSI/Seguros/Atención (ya tienen placeholders, no son prioridad)
```
