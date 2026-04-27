# PENDIENTES — ServiceTrack
_Actualizado: 2026-04-27 — Bot seguimiento de citas implementado. Fix stale closure bandeja. Asesor puede responder tras tomar conversación. WA coche listo desde taller. Schema drift detectado en `citas` (producción), migración 018 creada._

---

## ⚠️ MIGRACIONES PENDIENTES DE EJECUTAR EN SUPABASE (bloquean demo del bot)

> **Ejecutar ANTES de hacer push/deploy o probar el bot en producción.**

✅ **Migración 018** — `supabase/migrations/018_add_bot_confirmation_fields_to_citas.sql`
- Detectada en validación pre-deploy 2026-04-27: producción no tenía `contacto_bot`, `confirmacion_cliente`, `confirmacion_at` en tabla `citas`.
- `lib/ai/bot-tools.ts` (`crearCitaBot`, `confirmarCitaBot`) usa estas columnas — INSERT/UPDATE falla en producción sin esta migración.
- **Ejecutar manualmente en Supabase SQL Editor** antes de push.

```sql
alter table public.citas
  add column if not exists contacto_bot        boolean     default false,
  add column if not exists confirmacion_cliente boolean,
  add column if not exists confirmacion_at      timestamptz;
```

---

## 🔵 FASE 2b — BASE OPERATIVA CONFIGURABLE (siguiente prioridad después de FASE 1.5)

> Basada en análisis de modelo Autoline 2026-04-24. Antes de módulos secundarios (Ventas/CSI/Seguros).

### SQL pendiente de ejecución INMEDIATA

⬜ **Migración 015** — `asesor_id` en `citas` + `agenda_vista_default` en `configuracion_citas_sucursal`
```sql
-- supabase/migrations/015_citas_asesor_and_agenda_config.sql (YA EXISTE EN REPO)
ALTER TABLE citas ADD COLUMN IF NOT EXISTS asesor_id UUID REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_citas_asesor ON citas(asesor_id);
ALTER TABLE configuracion_citas_sucursal
  ADD COLUMN IF NOT EXISTS agenda_vista_default TEXT NOT NULL DEFAULT 'semana'
  CHECK (agenda_vista_default IN ('mes', 'semana', 'dia'));
```

### Pendientes de código + migración

⬜ **Migración 016** — parámetros de automatización configurables en `configuracion_citas_sucursal`
- `horas_recordatorio` INT DEFAULT 24
- `horas_recordatorio_2` INT DEFAULT 2
- `ventana_noshow_horas` INT DEFAULT 24
- `noshow_activo` BOOL DEFAULT TRUE

⬜ **Migración 016** — flags operativos en tabla `usuarios`
- `puede_ser_asesor` BOOL DEFAULT TRUE
- `puede_recibir_citas` BOOL DEFAULT TRUE
- `cuota_citas_dia` INT DEFAULT NULL

⬜ **UI `/configuracion/citas`** — exponer `horas_recordatorio`, `ventana_noshow_horas`, `noshow_activo` (el form con "Guardar" ya existe, solo agregar campos)

⬜ **`app/api/cron/recordatorios-citas/route.ts`** — leer `horas_recordatorio` de BD en lugar de hardcoded 24h, y `ventana_noshow_horas` para no-show detection

⬜ **`/citas/nuevo`** — filtrar lista de asesores por `puede_ser_asesor=true` cuando el flag exista

---

## 📊 AVANCE REAL POR SPRINT (basado en código, no en MD)

| Sprint | Nombre | % real | Estado |
|--------|--------|--------|--------|
| Sprint 1 | AUTH + LAYOUT | 80% | 🟡 Casi completo |
| Sprint 2 | USUARIOS & PERMISOS | 85% | 🟡 FASE 1.5 activa — pendiente validación manual |
| Sprint 3 | CRM | 65% | 🟡 En progreso |
| Sprint 4 | CITAS | 45% | 🟡 Agenda calendario construida, migración 015 pendiente de ejecutar |
| Sprint 5 | TALLER | 25% | 🔴 Base construida |
| Sprint 6 | REFACCIONES | 30% | 🔴 Base construida |
| Sprint 7 | VENTAS | 30% | 🔴 MVP en construcción 2026-04-22 |
| Sprint 8 | BANDEJA + IA | 60% | 🟡 FASE 5 completo en código + recordatorio 2h + no-show. Nada activo en producción — requiere número WA + config Meta + deploy |
| Sprint 9 | ATENCIÓN A CLIENTES | 0% | ⬜ Sin empezar |
| Sprint 10 | CSI | 0% | ⬜ Sin empezar |
| Sprint 11 | SEGUROS | 0% | ⬜ Sin empezar |

**Avance global: ~35% del producto completo** (código implementado; WhatsApp e IA MVP completos en código pero sin activar en producción).

---

## ✅ COMPLETADO (historial)

- [x] Búsqueda multi-palabra ("Miguel Abascal" funciona)
- [x] Vehículos duplicados en tarjetas de búsqueda
- [x] Página `/crm/vehiculos/[id]` — detalle con verificación, empresa, personas
- [x] Página `/crm/vehiculos/[id]/editar` — todos los campos
- [x] Página `/crm/clientes/[id]/editar`
- [x] Página `/crm/empresas/[id]` — detalle con clientes vinculados
- [x] Página `/crm/empresas/[id]/editar` — **SÍ EXISTE** (PENDIENTES anterior decía que daba 404 — ya estaba resuelto)
- [x] Campos verificación en vehículo: fecha, próxima, lugar, versión
- [x] `empresa_id` en `vehiculos`
- [x] Sección Empresa en perfil del cliente (vincular/desvincular)
- [x] Sección Vehículos en perfil del cliente (vincular/desvincular)
- [x] Sección Empresa en detalle del vehículo
- [x] Al vincular empresa→cliente con vehículos: checkboxes para elegir cuáles vincular
- [x] Agenda: actividades ahora se muestran (RLS fix → admin client)
- [x] Citas: error al crear arreglado
- [x] Campos obligatorios en form **editar** vehículo: color, placa, VIN (17 chars)
- [x] Intervalo de servicio en form editar vehículo
- [x] `lib/whatsapp.ts` — Meta Cloud API implementado
- [x] `lib/email.ts` — Resend implementado
- [x] Cron de recordatorios de citas (`app/api/cron/recordatorios-citas/route.ts`)
- [x] Server Actions para citas (`app/actions/citas.ts`)
- [x] WA automático al confirmar/cancelar cita
- [x] Refacciones: `/partes` conectado a Supabase (`maestro_partes`)
- [x] Refacciones: `/cotizaciones` conectado a Supabase (`cotizaciones`)
- [x] Sprint 9 — Estado OT canónico: `en_proceso` (migración 008 ejecutada + TypeScript + UI alineados)
- [x] Sprint 9 — Normalización MAYÚSCULAS: clientes (crear+editar), empresas (crear+editar), vehículos (crear+editar), OT diagnóstico + numero_ot_dms
- [x] Sprint 9 — OT: `version` agregado a `createVehiculoAction` y `createVehiculoYVincularAction`
- [x] Sprint 9 — OT: `updateOTAction` acepta `numero_ot_dms` para edición posterior
- [x] Sprint 9 — Cita detalle: bloque "Orden de Trabajo" visible en estados `en_agencia` y `show`
- [x] Sprint 9 — `vincularOTCitaAction`: vincular OT existente a una cita con validaciones de sucursal+cliente+vehículo
- [x] Sprint 9 — `VincularOTCita.tsx`: componente cliente para buscar y vincular OT desde detalle de cita
- [x] Sprint 9 — Nueva cita: link "Crear cliente nuevo" cuando la búsqueda retorna cero resultados
- [x] Sprint 9 — Wizard nuevo cliente: soporte `return_to` para redirigir a `/citas/nuevo?cliente_id=...` tras crear cliente
- [x] Sesión 2026-04-24 — Mi Agenda: calendario mes/semana/día con navegación por URL (vista + fecha en searchParams)
- [x] Sesión 2026-04-24 — Agenda: vista default configurable desde Configuración > Citas (`agenda_vista_default`)
- [x] Sesión 2026-04-24 — Migración 015 creada: `asesor_id` en `citas` + `agenda_vista_default` en config (PENDIENTE EJECUTAR en Supabase)
- [x] Sesión 2026-04-24 — FASE 2b documentada: base operativa configurable (parámetros automatización, flags usuario)
- [x] Sesión 2026-04-24 — Roadmap reordenado: FASE 2b antes de módulos secundarios; WA+IA como prioridad comercial
- [x] Sesión 2026-04-27 — Bot: seguimiento de citas ya agendadas como PRIORIDAD 1 (antes de agendar nuevas). Primera interacción siempre llama `consultar_citas_cliente`.
- [x] Sesión 2026-04-27 — Bot: `confirmarCitaBot` tool — confirma asistencia vía bot, actualiza `confirmacion_cliente`, `contacto_bot`, `confirmacion_at` en BD.
- [x] Sesión 2026-04-27 — Bot: guard `crear_cita` — llama exactamente una vez por conversación; si ya existe `cita_id` retorna "ya creada" y fuerza end_turn.
- [x] Sesión 2026-04-27 — Bot: nuevos intents `confirmar_asistencia` + `consulta_cita_propia` en `classify-intent.ts` y routing en `bandeja.ts`.
- [x] Sesión 2026-04-27 — WA coche listo: `mensajeVehiculoListo()` en `lib/whatsapp.ts` + disparo best-effort en `updateEstadoOTAction` al pasar OT a `listo`.
- [x] Sesión 2026-04-27 — Bandeja: fix stale closure en `loadMessages` (ref-based cache con `useRef<Set<string>>` en lugar de state).
- [x] Sesión 2026-04-27 — Bandeja: `enviarMensajeAsesorAction` + textarea de respuesta en chat panel (visible cuando hilo en `open` con assignee).
- [x] Sesión 2026-04-27 — Bandeja: `handleTomar` invalida cache ref + recarga mensajes inmediatamente tras tomar conversación.
- [x] Sesión 2026-04-27 — Bandeja: fix columna `creado_at` en orden de hilos (antes usaba `created_at` inexistente).
- [x] Sesión 2026-04-27 — Bot flotante/overlay para otros módulos: documentado como SUGERENCIA FUTURA, NO implementar ahora.
- [x] Sesión 2026-04-24 — Fix `hooks/usePermisos.ts`: eliminado `sucursal_id` de SELECT (causa real del error en producción)
- [x] Sesión 2026-04-24 — Ciclo de vida de usuarios: `desactivarUsuarioAction`, `reactivarUsuarioAction`, `borrarUsuarioAction` con chequeo de historial FK
- [x] Sesión 2026-04-24 — `UsuarioAcciones.tsx` reescrito con botones Desactivar/Reactivar/Eliminar (2-click confirm)
- [x] Sprint 9 — `vincularOTCitaAction`: comentario explícito de regla vehiculo_id null-permisiva
- [x] Sprint 9 — Crash `/taller` resuelto: fallback ESTADO_CONFIG + guard formatDateTime
- [x] FASE 1 — Seguridad multi-tenant: 10 page components migrados de `createAdminClient()` a `await createClient()` con RLS → **NO cerrada por completo**: faltan hardening en `app/actions/*`, rutas admin y validación con segundo usuario real
- [x] Bug 0c — `createAdminClient()` en `citas/[id]` — migrado a `createClient()` como parte de FASE 1 sistémica → pendiente validación multi-tenant

---

## 🚨 ACCIÓN INMEDIATA — ANTES DE CUALQUIER CÓDIGO NUEVO

### A. ✅ Migración 003_ai_foundation.sql — COMPLETADA 2026-04-13
### A2. ✅ Migración 004_messaging_adjustments.sql — COMPLETADA 2026-04-14
Constraints actualizados: `message_source` → `agent`, `processing_status` → nuevo vocabulario, `last_message_source` alineado.

### A3. ✅ Sprint 8 Fase 1 — IMPLEMENTADA 2026-04-14
`lib/threads.ts` (`getOrCreateThread`), `lib/whatsapp.ts` (persistencia conversacional), `app/actions/citas.ts` (usuario_asesor_id + contexto).
⬜ Validación runtime pendiente: `wa_numeros` vacío — ver pendiente WA abajo.

### A4. 🚨 PENDIENTE BLOQUEANTE — WhatsApp Business API (dependencia externa)

⬜ **WhatsApp Business API / número no operativo**
- `wa_numeros` vacío — sin `phone_number_id` ni `access_token` de Meta
- Validación end-to-end de mensajería pendiente por dependencia externa
- No bloquea desarrollo interno: bandeja real ✅, webhook ✅ (código implementado, requiere número Meta activo), clasificador IA ✅

**Causa:** Problema con proveedor — número no dado de alta / posible estafa.
**Impacto:** No se puede probar envío real, integración Meta, ni recepción (webhook).
**Decisión:** NO bloquear desarrollo. Continuar con componentes internos.
**Acción futura:** Cuando exista número válido → poblar `wa_numeros` → smoke test completo.


Tablas creadas: `mensajes`, `ai_settings`, `conversation_threads`, `outbound_queue`, `automation_logs`
Columnas en `mensajes`: `thread_id`, `message_source`, `wa_message_id`, `ai_intent`, `ai_intent_confidence`, `ai_sentiment`, `processing_status`
Índices: `idx_mensajes_thread`, `idx_mensajes_wa_message_id` (UNIQUE), `idx_mensajes_processing`

### A9. ✅ Sesión 2026-04-22 — Fixes + automatizaciones complementarias

**Encoding fixes (código visible en UI):**
- `UsuarioAcciones.tsx`: 6 strings mojibake corregidos (Invitación, invitación, contraseña, Sin acción)
- `usuarios/page.tsx`: 1 string mojibake corregido (módulo)

**Nueva página: `/usuarios/roles/[id]`**
- `app/(dashboard)/usuarios/roles/[id]/page.tsx` — server component, carga rol + permisos
- `app/(dashboard)/usuarios/roles/[id]/EditRolClient.tsx` — client component, matriz editable
- Usa `updateRolPermisosAction` de `app/actions/roles.ts` (ya existía)
- Roles `super_admin` muestran mensaje explicativo en lugar de la matriz

**Automatizaciones completadas:**
- `lib/whatsapp.ts` — añadidos `mensajeRecordatorio2h` y `mensajeNoShow`
- `app/actions/citas.ts` — al confirmar cita, encola recordatorio 2h en `outbound_queue` con `send_after = cita - 2h` (best-effort)
- `app/api/cron/recordatorios-citas/route.ts` — añade detección de no-show: citas de ayer en `confirmada` → actualiza a `no_show` + envía WA/email

**Roadmap BLOQUE 5 documentado en WORKPLAN** como FASE 6 (Mi Agenda, Calendario Citas, Taller calendario, Workflow Studio, AI Copilot, Agentes por módulo)

**Pendiente externo (sin código necesario):**
- Migración 009 en Supabase (roles/permisos)
- Deploy a Vercel (activa todos los cambios)

### A8. ✅ FASE 5 Sprint — IMPLEMENTADO 2026-04-22 (código completo, requiere deploy + config externa)

**Webhook WA entrante** (`app/api/webhooks/whatsapp/route.ts`):
- GET handshake con `WA_VERIFY_TOKEN`
- POST: dedup por `wa_message_id`, resuelve sucursal vía `wa_numeros.phone_number_id`, busca cliente por teléfono, crea/reutiliza `conversation_threads` con `thread_origin: 'inbound'`, persiste en `mensajes` (`processing_status: 'pending'`)
- Si `ai_settings.activo=TRUE`: clasifica intent + sentimiento inline y actualiza mensaje; escala hilo a `waiting_agent` si confianza < threshold

**IA MVP**:
- `lib/ai/types.ts` — tipos compartidos `IntentTipo`, `SentimentTipo`
- `lib/ai/classify-intent.ts` — 8 intents (Claude Haiku), respuesta JSON validada
- `lib/ai/detect-sentiment.ts` — 4 sentimientos (Claude Haiku), respuesta JSON validada

**Outbound Queue Flush** (`app/api/cron/outbound-queue-flush/route.ts`):
- Cron cada 15 min (nuevo en `vercel.json`)
- Procesa `outbound_queue` estados `pending` (sin aprobación requerida) + `approved`, con `send_after ≤ NOW()`
- Respeta horario del bot por sucursal desde `ai_settings.horario_bot_inicio/fin` (default 08:00-19:30 UTC-6)
- WA via `enviarMensajeWA`, email vía Resend raw
- Retry exponencial: 15→30→60 min hasta `max_intentos`; después marca `failed`
- Log a `automation_logs` vía `upsert` con `idempotency_key`

**`lib/threads.ts`** — agregado parámetro `thread_origin` opcional (default: `'outbound_manual'`)

**Pendiente para activar:**
- ⬜ `WA_VERIFY_TOKEN` en Vercel
- ⬜ Configurar webhook en Meta Business Manager (URL + suscripción a `messages`)
- ⬜ Poblar `wa_numeros` cuando el número Meta esté activo
- ⬜ Smoke test: mensaje entrante → `mensajes` + `conversation_threads` en BD

### A5. ✅ Sprint 9 — IMPLEMENTADO 2026-04-15
- `estado_ot` ENUM: `en_reparacion` → `en_proceso` — migración 008 ✅ ejecutada y validada en Supabase (2026-04-16)
- Normalización MAYÚSCULAS: `nombre`/`apellido`/`apellido_2` (create+update clientes), `nombre` empresa (create+update), `marca`/`modelo`/`version`/`color` vehículos (create+update), `diagnostico`/`numero_ot_dms` OT (create+update)
- Cita: bloque "Orden de Trabajo" en detalle de cita (estados `en_agencia`/`show`): crear nueva OT o vincular OT existente
- `vincularOTCitaAction` en `app/actions/taller.ts`: validaciones de sucursal+cliente+vehículo
- `app/_components/citas/VincularOTCita.tsx`: componente cliente para buscar/vincular OT
- Nueva cita: link "Crear cliente nuevo" cuando búsqueda retorna cero resultados
- Wizard nuevo cliente: soporte `return_to` para redirigir de regreso a `/citas/nuevo?cliente_id=...`
- `version` en `createVehiculoAction` y `createVehiculoYVincularAction`
- `updateOTAction` acepta `numero_ot_dms` para edición posterior

### A6. ✅ COMPLETADO — Migración 008 ejecutada y validada (2026-04-16)
**Archivo**: `supabase/migrations/008_estado_ot_en_proceso.sql`
ENUM `estado_ot` contiene: `recibido`, `diagnostico`, `en_proceso`, `listo`, `entregado`, `cancelado`.
Validado con: `SELECT estado, COUNT(*) FROM ordenes_trabajo GROUP BY estado` → `diagnostico=2, en_proceso=2`. Sin `en_reparacion`.

### A7. ✅ COMPLETADO — Crash /taller resuelto en producción (2026-04-16)
**Archivo**: `app/(dashboard)/taller/page.tsx`
Dos fixes aplicados:
- `ESTADO_CONFIG[row.estado as EstadoOT] ?? { label: row.estado ?? 'SIN ESTADO', ... }` — fallback defensivo cuando llega valor inesperado o null
- `{row.created_at ? formatDateTime(row.created_at) : '—'}` — guard contra `Invalid Date` en `Intl.DateTimeFormat`
Requiere deploy a Vercel para activarse en producción.

### B. Ejecutar migración 002_email_config.sql (sigue pendiente)
**Archivo**: `supabase/migrations/002_email_config.sql`
Sin esta tabla, la pantalla `/configuracion/email` falla silenciosamente.

### C. 🟡 Variables de entorno y configuración externa — PARCIAL
Base ya identificada en código: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `ANTHROPIC_API_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`.

Pendiente validar en producción:
- `NEXT_PUBLIC_SITE_URL` apuntando al dominio real
- URLs de redirect en Supabase Auth para invitación / reset / set-password
- Variables presentes en All Environments de Vercel

---

## 🟡 PENDIENTE DEPLOY — ACCESO MULTIUSUARIO (FASE 1.5)

**Diagnóstico resuelto 2026-04-22:**
- `/usuarios` vacío: tabla `usuarios` tenía RLS activo pero sin ninguna policy SELECT.
- "table not found" roles/usuario_roles: RLS activo pero políticas fallaron al crearse (se referenciaban funciones que no existían aún en el script de schema).
- Fix: migración `009_roles_permisos_schema.sql` — añade policy SELECT a `usuarios`, recrea `roles`/`rol_permisos`/`usuario_roles` con RLS correcto, grants a `authenticated`.

**Para cerrar FASE 1.5:**
1. ⬜ Ejecutar migración 009 en Supabase SQL Editor
2. ⬜ Deploy a Vercel
3. ⬜ Validar `/usuarios` muestra lista real
4. ⬜ Validar flujo completo: invitar → pendiente visible → reenviar → set-password → login
5. ⬜ Validar `/usuarios/roles` carga sin error
6. ⬜ Crear rol desde `/usuarios/roles/nuevo` → permisos guardados
7. ⬜ Validar aislamiento sucursal con segundo usuario real (M7)

### M1. ✅ Fix link de invitación — código listo, pendiente deploy

`redirectTo` explícito en `inviteUserByEmail` apuntando a `/auth/callback?next=/set-password`.
Supabase Auth ya configurado con Site URL + Redirect URLs (confirmado por usuario).

### M2. ✅ Vista usuarios pendientes — código listo, pendiente migración 009 + deploy

`email_confirmed_at` de Supabase Auth → badge "Invitación pendiente". La tabla `usuarios` now tendrá SELECT policy tras migración 009.

### M3. ✅ Reenviar invitación — código listo, pendiente deploy

`reenviarInvitacionAction` en `app/actions/usuarios.ts`. Valida estado en Auth antes de reenviar.

### M4. ✅ Reset de contraseña desde admin — código listo, pendiente deploy

`resetPasswordAdminAction` en `app/actions/usuarios.ts`.

### M5. ✅ Recuperación de contraseña por mail — código listo, pendiente deploy

`/forgot-password` + `forgotPasswordAction` + `/set-password` + `setPasswordAction`.

### M6. ✅ "Usuarios" movido a Configuración

Removido del sidebar. Accesible desde `/configuracion`.

### M7. ⬜ Validación multi-tenant con segundo usuario real

Prerequisito de go-live. Requiere migración 009 + deploy.
Crear segundo usuario, asignar a sucursal, verificar que NO ve datos de otras sucursales.

### M8. ✅ `/usuarios/roles` — resuelto con migración 009

Tablas `roles`/`rol_permisos` ya en migración. La página usa `admin` client para reads (correcto).
`actions/roles.ts` usa `createClient()` que funcionará con las nuevas RLS policies.

### M9. Esquema de roles/permisos ausente en BD real

Estado validado en producción:
- PostgREST no encuentra relación `usuarios -> usuario_roles`
- PostgREST reporta que no existe `public.roles`

Conclusión:
- el problema visible actual ya no es solo RLS
- la BD real no trae completo el esquema esperado por `/usuarios` y `/usuarios/roles`
- falta ejecutar SQL de `roles`, `rol_permisos`, `usuario_roles` y `usuario_permisos_override`

Fix mínimo seguro ya aplicado en código:
- `/usuarios` ya no depende de relaciones embebidas para listar usuarios
- `/usuarios/roles` degrada con mensaje explícito hasta que exista el esquema

---

## 🔴 PENDIENTE — HARDENING DE SEGURIDAD EN ACTIONS

### S1. `createAdminClient()` sigue activo en acciones sensibles

Persisten acciones server-side con `createAdminClient()` que todavía requieren validación más estricta
por sucursal y por rol antes de dar FASE 1 por cerrada.

### S2. Rutas admin sin guard de rol

`/usuarios`, `/configuracion`, `/configuracion/whatsapp` y `/configuracion/email` necesitan validación
operativa para confirmar que usuarios no-admin no entren ni ejecuten acciones sensibles.

### S3. Validación por `id` en acciones críticas

Hay acciones que recuperan o mutan registros por `id` y dependen de validaciones parciales.
Revisar antes de seguir con features nuevas para evitar riesgo cross-sucursal.

---

## 🔴 PENDIENTE — SOLICITADO Y NO IMPLEMENTADO

### 1. Campos obligatorios en forms de CREAR (no solo editar)

**Vehículo — `/crm/vehiculos/nuevo`:**
- color, placa, VIN (17 chars) — NO son obligatorios. Solo en editar.

**Cliente — `/crm/clientes/nuevo`:**
- email → pediste que sea obligatorio. Actualmente NO lo es.

**Empresa — `/crm/empresas/nuevo`:**
- RFC → pediste obligatorio. NO lo es.
- Contacto vinculado → pediste obligatorio al crear. NO lo es.

---

### 2. Detección de duplicados en tiempo real (onBlur)

Al salir del campo, buscar si ya existe:
- **Cliente:** teléfono → "⚠ Ya existe [Nombre] con este teléfono"
- **Cliente:** email → "⚠ Ya existe [Nombre] con este email"
- **Vehículo:** placa → "⚠ Ya existe [Marca Modelo año] con esta placa"
- **Vehículo:** VIN → "⚠ Ya existe [Marca Modelo año] con este VIN"

Aplica crear y editar. No bloquea guardado, solo advierte.

---

### 3. Permisos para eliminar registros

Solo `admin` o `gerente` pueden eliminar.
- Verificar rol en server action antes de DELETE
- Botón eliminar visible solo si `usuario.rol in ['admin', 'gerente']`

---

### 4. Sistema de permisos — pantalla "¿Qué permisos tengo?"

- Pantalla `/usuarios/mi-perfil` — rol del usuario + tabla de qué puede hacer
- Admin cambia rol de usuarios de su sucursal desde `/usuarios`
- Nuevo rol `super_admin` — ve todos los grupos

**Jerarquía:** `super_admin > admin > gerente > asesor_servicio > viewer`

---

### 5. Módulo de Auditoría

Historial de cambios: quién editó qué campo, valor anterior vs nuevo.
Mínimo últimos 5 cambios por registro.

**SQL a correr:**
```sql
CREATE TABLE auditoria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  accion TEXT NOT NULL, -- 'insert' | 'update' | 'delete'
  creado_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_auditoria_registro ON auditoria(tabla, registro_id);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
```

**Implementación:** server actions — antes de UPDATE leer valores actuales, guardar diff.

---

### 6. Módulo Configuración en sidebar

Nuevo ítem ⚙ Configuración con:
- **Usuarios y Permisos** → mover `/usuarios` aquí
- **Auditoría** → ver punto 5
- **Mi Sucursal** → editar nombre, teléfono, whatsapp, horarios
- **Errores del sistema** → tabla `error_logs`

**SQL para errores:**
```sql
CREATE TABLE error_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),
  pagina TEXT,
  accion TEXT,
  mensaje TEXT NOT NULL,
  detalle TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 7. Ejecutar migración `002_email_config.sql` en Supabase

La tabla `email_config` no existe en la BD. La pantalla `/configuracion/email` falla silenciosamente.
**Pasos:**
1. Abrir Supabase SQL Editor
2. Ejecutar el contenido de `supabase/migrations/002_email_config.sql`
3. Verificar que la pantalla de configuración de email guarda correctamente

---

### 8. Campos obligatorios en forms de CREAR — (ver punto 1)

_(ya documentado arriba — relistado aquí para priorización)_

---

### 9. Detección de duplicados en tiempo real — (ver punto 2)

_(ya documentado arriba)_

---

### 10. Permisos básicos por rol — deuda de Sprint 2

Sin esto, cualquier usuario puede intentar eliminar registros de otros.
**Mínimo viable:**
- Server action verifica `usuario.rol` antes de DELETE
- Botón "Eliminar" oculto si rol no es `admin` o `gerente`
- Hook `usePermisos()` retorna permisos del usuario actual

---

### 11. Página editar cliente — sección vinculación

En `/crm/clientes/[id]/editar` NO hay sección para vincular/desvincular empresa o vehículos.
Esos controles solo están en el perfil (`/crm/clientes/[id]`).
_(Baja prioridad si ya accesibles desde perfil)_

---

## 🐛 BUGS / DEUDA TÉCNICA ENCONTRADA EN ANÁLISIS (2026-04-13)

### ✅ Bug 0c — RESUELTO 2026-04-16
`app/(dashboard)/citas/[id]/page.tsx` migrado a `await createClient()` como parte de FASE 1 sistémica.

### Bug 0 — RLS por rol pendiente en tablas de capa IA (NUEVO — 2026-04-13)
Las policies de `ai_settings` y `outbound_queue` (migración 003) solo validan `sucursal_id`.
No validan rol del usuario. La verificación de rol (admin/gerente para modificar AI settings,
encargadas/asesores para aprobar mensajes) se hace en server actions por ahora.
→ **Endurecer con RLS por rol cuando se implemente Sprint 2 (usePermisos + middleware).**
→ Afecta también: cualquier endpoint que use estas tablas.

### Bug 0b — mensajes no tiene creado_at (NUEVO — detectado en migración 003)
La tabla `mensajes` usa `enviado_at` como timestamp principal, NO `creado_at`.
El índice `idx_mensajes_processing` fue corregido para usar `enviado_at`.
→ Cualquier código que busque `mensajes.creado_at` fallará. Usar `enviado_at`.

### Bug 1 — AGENTS.md desactualizado
`AGENTS.md` todavía dice que Layout, CRM y Citas están "por construir" — llevan semanas construidos.
No afecta el código pero confunde a agentes de IA en sesiones nuevas.
→ Sugerir: ¿Actualizo AGENTS.md?

### Bug 2 — TECH_STACK.md menciona n8n como capa de automatización
El proyecto PIVOTÓ a código nativo (Next.js + Vercel Cron + lib/). TECH_STACK.md aún
documenta n8n como si fuera la decisión activa.
→ Sugerir: ¿Actualizo TECH_STACK.md con la decisión de código nativo?

### Bug 3 — Migración `002_email_config.sql` SIN EJECUTAR en Supabase
La tabla `email_config` NO existe en la BD todavía. La configuración de email desde UI
fallará silenciosamente.
→ **Ejecutar en Supabase SQL Editor antes de continuar con cualquier módulo de email.**

### Bug 4 — Bandeja (`/bandeja`) ya usa Supabase, pero sigue incompleta operativamente
La ruta `app/(dashboard)/bandeja/page.tsx` ya consulta `conversation_threads` y `mensajes`.
La deuda real ya no es "conectar mock data", sino cerrar webhook entrante, composición real,
validación manual y hardening alrededor de mensajería.
→ **Actualizar documentación legacy que todavía la describe como mock.**

### Bug 5 — `hooks/` del proyecto tiene solo archivos de Next.js hooks (no app hooks)
TECH_STACK.md documenta `useCitas.ts`, `useOTs.ts`, `useActividades.ts`, `useRealtime.ts`
como existentes. El directorio `hooks/` NO contiene ninguno de esos archivos.

### Bug 6 — `components/` no existe como carpeta raíz
TECH_STACK.md documenta `components/ui/`, `components/layout/`, `components/crm/`, etc.
El proyecto real usa `app/_components/` en su lugar.
→ TECH_STACK.md desactualizado en la estructura de carpetas.

### Bug 7 — Sprint 2 (USUARIOS & PERMISOS) incompleto sin advertencia
Las tablas `roles`, `rol_permisos`, `usuario_roles`, `usuario_permisos_override` existen
en SUPABASE_SCHEMA.sql pero:
- No hay `usePermisos()` hook
- No hay middleware de protección por rol
- No hay validación de permisos en server actions
- Los botones de eliminar son visibles para cualquier usuario

### Bug 8 — OT: flujo nunca probado completamente
Per CLAUDE.md original: "OT — verificar flujo completo — nunca se probó después de los fixes de estado"
Sigue sin verificarse.

---

## ⚠️ DECISIONES TÉCNICAS REGISTRADAS

| Decisión | Descripción |
|----------|-------------|
| n8n → código nativo | Automatizaciones implementadas con Next.js + Vercel Cron + lib/ (NO n8n) |
| WA provider | Meta Cloud API directa (no Twilio / 360dialog) |
| Email | Resend (no SendGrid) |
| `components/` | Estructura real: `app/_components/` (no `/components` en raíz) |
| Admin client | ~~Refacciones y taller usan `createAdminClient()` para evitar RLS en listados~~ → **PARCIALMENTE RESUELTO 2026-04-16**: los page components críticos usan `createClient()` con RLS. Aún queda hardening en `app/actions/*`, config admin y validación multiusuario real |

---

## 🟡 NO SOLICITADO TODAVÍA — SIGUIENTES PRIORIDADES NATURALES

### Por sprint (según IMPLEMENTATION_PLAN.md):

**Sprint 3 pendiente (CRM):**
- **Mi Agenda — vista calendario** — cambiar entre mes/semana/día con un clic. Mostrar actividades agendadas por fecha_vencimiento. Base para operación diaria. → **FASE 2.2** ⬜ No iniciada.
- Driver 360: timeline cronológico del cliente
- Actividades: crear actividad desde cualquier módulo (NuevaActividad.tsx existe pero sin verificar integración)
- Outlook/Gmail sync (requiere Azure app + OAuth)
- Triggers BD: crear_dueno_vehiculo, validar_max_clientes

**Sprint 4 pendiente (CITAS):**
- F01 Importar archivos CSV/Excel de citas
- F02 Timer 15 min visible + bot actúa si encargada no contacta
- F04 No-show recovery: bot WA con opciones de reagendamiento
- F05 Campaña proactiva: detectar vehículos próximos a mantenimiento
- F06 Recepción Express completa: pre-llegada WA, check-in QR, firma digital
- **Flujo contextual completo en Nueva Cita** — si cliente no existe: crear cliente → empresa → vehículo inline sin salir de la ruta, y regresar con `cliente_id` preseleccionado. Fase 1a (link "Crear cliente") ✅. Fases 1b (empresa inline), 1c (vehículo inline), 1d (auto-preseleccionar único vehículo) ⬜ pendientes.
- **Vista calendario para Citas** — vista de disponibilidad al crear cita: horas del día con slots ocupados/libres. Cambiar entre mes/semana/día con un clic. No drag & drop aún. → **FASE 2.3** ⬜ No iniciada.
- **Validación de KM en nueva OT** — verificar que `km_ingreso` sea ≥ último KM registrado en el vehículo. ⬜ No implementado.

**Sprint 5 pendiente (TALLER):**
- Líneas OT (lineas_ot): agregar trabajo/partes a una OT
- WA automático al cliente al cambiar estado de OT
- Escalación automática: OT >4h sin actualizar → notificación asesor → gerente → bot
- Venta perdida: asesor detecta necesidad → flujo recuperación
- CSI automático al cerrar OT
- **Vista calendario para Taller** — vista de carga de trabajo por asesor: OTs como bloques entre `created_at` y `promesa_entrega`. Conceptualmente separada del calendario de Citas — va en pasada posterior, no junto con él. → **FASE 4.4** ⬜ No iniciada.
- **Columna `updated_by`** en `ordenes_trabajo` — trazabilidad de quién cambió el estado. Requiere nueva migración. Documentado como TODO en `updateEstadoOTAction`. ⬜ Pendiente de migración.
- **Alertas de promesa vencida** — marcar visualmente OTs con `promesa_entrega < NOW()` en lista de taller. Valor alto, esfuerzo bajo. ⬜ No implementado.

**Sprint 6 pendiente (REFACCIONES):**
- PDF de cotización auto-generado con logo
- Firma digital del cliente para aprobar cotización
- Al aprobar → piezas se agregan a OT automáticamente

**Sprints 7-11:** Ventas, Bandeja+IA, Atención, CSI, Seguros — por completo.

---

## 🎯 PRIORIDAD ACTIVA — Cerrar seguridad, acceso y validación antes de abrir features nuevas

Motivo: el repo ya trae bandeja parcial con datos reales y el acceso multiusuario ya está implementado
en código, pero todavía faltan deploy, configuración externa y validación manual.

Orden recomendado:
- Ejecutar migración `002_email_config.sql`
- Hardening de seguridad en actions y rutas admin
- Validar multiusuario real con segundo usuario
- Recién después seguir con webhook WhatsApp, IA y madurez de bandeja
