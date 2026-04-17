# PENDIENTES — ServiceTrack
_Actualizado: 2026-04-16 — FASE 1 seguridad multi-tenant parcialmente cerrada (pages críticas migradas a createClient, hardening pendiente en actions/rutas admin). FASE 1.5 acceso multiusuario implementada en código, pendiente deploy/config/validación. Bandeja conectada a datos reales de Supabase de forma parcial. Roadmap reordenado._

---

## 📊 AVANCE REAL POR SPRINT (basado en código, no en MD)

| Sprint | Nombre | % real | Estado |
|--------|--------|--------|--------|
| Sprint 1 | AUTH + LAYOUT | 80% | 🟡 Casi completo |
| Sprint 2 | USUARIOS & PERMISOS | 20% | 🔴 Incompleto |
| Sprint 3 | CRM | 65% | 🟡 En progreso |
| Sprint 4 | CITAS | 35% | 🟡 Base construida |
| Sprint 5 | TALLER | 25% | 🔴 Base construida |
| Sprint 6 | REFACCIONES | 30% | 🔴 Base construida |
| Sprint 7 | VENTAS | 2% | 🔴 Placeholder |
| Sprint 8 | BANDEJA + IA | 35% | 🟡 Fase 1 implementada, WA sin validar, bandeja en progreso |
| Sprint 9 | ATENCIÓN A CLIENTES | 0% | ⬜ Sin empezar |
| Sprint 10 | CSI | 0% | ⬜ Sin empezar |
| Sprint 11 | SEGUROS | 0% | ⬜ Sin empezar |

**Avance global: ~24% del producto completo.**

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
- No bloquea desarrollo interno: bandeja real ✅, webhook (pendiente Sprint 8 Fase 2), clasificador IA (pendiente)

**Causa:** Problema con proveedor — número no dado de alta / posible estafa.
**Impacto:** No se puede probar envío real, integración Meta, ni recepción (webhook).
**Decisión:** NO bloquear desarrollo. Continuar con componentes internos.
**Acción futura:** Cuando exista número válido → poblar `wa_numeros` → smoke test completo.


Tablas creadas: `mensajes`, `ai_settings`, `conversation_threads`, `outbound_queue`, `automation_logs`
Columnas en `mensajes`: `thread_id`, `message_source`, `wa_message_id`, `ai_intent`, `ai_intent_confidence`, `ai_sentiment`, `processing_status`
Índices: `idx_mensajes_thread`, `idx_mensajes_wa_message_id` (UNIQUE), `idx_mensajes_processing`

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

## 🔴 PENDIENTE — ACCESO MULTIUSUARIO (FASE 1.5 — antes de cualquier feature nueva)

**Estado real en código:** ya existen flujo de invitación con `redirectTo`, pantalla `set-password`,
`forgot-password`, reenviar invitación, reset de contraseña y navegación de Usuarios dentro de
Configuración. Lo pendiente ya no es construirlo, sino desplegarlo, configurarlo y validarlo end-to-end.

**FASE 1.5 sigue pendiente de cierre hasta completar, sin excepción:**
- deploy del fix de `/usuarios`
- validación manual de `/usuarios` en producción
- reprueba completa: invitación, usuario pendiente visible, reenviar invitación, set-password, reset contraseña, login
- validación de aislamiento por sucursal
- revisión posterior de `/usuarios/roles` por posible patrón similar de RLS

### M1. 🔴 CRÍTICO — Validar link de invitación en ambiente real

El link que recibe el usuario invitado falla con `access_denied` / `otp_expired` / `invalid or expired`.
El usuario no puede activar su cuenta.
**Acción:** diagnosticar configuración de Auth en Supabase Dashboard — redirect URL, tiempo de expiración del OTP, URL del sitio.

### M2. 🟡 Vista de usuarios invitados / pendientes — validar runtime

El código ya consulta `auth.users.email_confirmed_at` para distinguir pendiente vs activo
y ahora también distingue casos sin registro en Supabase Auth.
Se corrigió además el bug raíz de pantalla vacía: `/usuarios` leía la tabla `usuarios`
con `createClient()` pese a que la tabla no tiene policy de lectura bajo RLS.
Ahora la vista usa `createAdminClient()` con guard de admin y filtro por contexto.
Falta validarlo con usuarios reales y revisar comportamiento en producción.

### M3. 🟡 Reenviar invitación — validar runtime

La acción ya existe en `app/actions/usuarios.ts` y se endureció para:
- validar que el usuario exista en Supabase Auth
- bloquear reenvío si ya activó cuenta
- detectar desalineación ID/email
- mostrar errores explícitos en UI
Falta validar delivery real, redirects y expiración.

### M4. 🟡 Reset de contraseña desde Usuarios — validar runtime

La acción admin ya existe.
Falta validar envío real y flujo completo de recuperación.

### M5. 🟡 Recuperación de contraseña por mail — validar runtime

El flujo ya existe en login + `/forgot-password` + `/set-password`.
Falta validación real en producción.

### M6. ✅ Mover "Usuarios" a Configuración

Resuelto en código: ya no aparece en el sidebar principal; el acceso quedó dentro de Configuración.

### M7. Validación real multi-tenant con segundo usuario funcional

Una vez resueltas M1-M6, crear un segundo usuario real, asignarlo a la misma sucursal con rol `asesor_servicio`, y validar:
- Solo ve OTs, citas y clientes de su sucursal
- No ve configuración de WhatsApp/email
- No puede eliminar registros

**Prerequisito de go-live.** Sin esto, el aislamiento multi-tenant es código no verificado.

### M8. `/usuarios/roles` — revisar patrón de RLS

Pendiente inmediato después del deploy de `/usuarios`.
La ruta usa `createClient()` sobre `roles`; hay que confirmar si reproduce el mismo patrón de RLS
que dejó vacía la pantalla principal de usuarios.

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
