# PENDIENTES — ServiceTrack
_Actualizado: 2026-04-28 — P0.5 BotIA agencia completa + política de confirmación humana; P0.4.1 corrige filtros reales de Citas y agrega calendario mensual._

---

## ⚠️ MIGRACIONES PENDIENTES DE EJECUTAR EN SUPABASE (bloquean demo del bot)

> **Ejecutar ANTES de hacer push/deploy o probar el bot en producción.**

✅ **Migración 018** — `supabase/migrations/018_add_bot_confirmation_fields_to_citas.sql`
- **YA EJECUTADA en producción.**

⬜ **Migración 019** — `supabase/migrations/019_add_cita_id_to_actividades.sql`
- Agrega `cita_id UUID` + índice a tabla `actividades` para trazabilidad BotIA.
- `crearCitaBot` ya escribe `cita_id` al crear la actividad — falla silenciosamente sin esta columna.
- **Ejecutar manualmente en Supabase SQL Editor antes del próximo deploy:**

```sql
alter table public.actividades
  add column if not exists cita_id uuid references public.citas(id) on delete set null;
create index if not exists idx_actividades_cita_id on public.actividades(cita_id);
```

---

✅ **Migración 018 (archivo)** — referencia original:
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

## 🤖 P0.2.1 BotIA Hard Gates — PENDIENTES POST-COMMIT 8fdc771

> Commit 8fdc771 es el fix raíz del fallo P0.2. El test real con teléfono 5511117777 reveló que Claude Haiku ignoraba las instrucciones `flowInject` por conflicto con el SYSTEM_PROMPT principal. P0.2.1 hace que Steps A y B sean completamente deterministas.

### Qué corrige P0.2.1 (sobre d57c8c2)

- **Steps A y B deterministas**: `skipBot=true` — el LLM nunca se invoca para captura de nombre ni vehículo. La respuesta se genera directamente en `bandeja.ts`.
- **`isClientePlaceholder()`**: helper en `appointment-flow.ts` reemplaza el check inline `nombre==='CLIENTE' && apellido==='DEMO'`. Cubre variantes como `SIN NOMBRE`, `TEST`, `PRUEBA`, `UNKNOWN`, `DESCONOCIDO`.
- **`crearCitaBot` hard gates**: rechaza `vehiculo_id=null` y `servicio=null` antes de tocar la BD — protege la integridad independientemente del caller.
- **Disponibilidad hoy filtrada**: `buscarDisponibilidad` filtra slots pasados para hoy con buffer de 30 min (timezone `America/Mexico_City`). Mensaje especial cuando ya no hay slots hoy.
- **`vehiculo_id` desde `ctx.appointment_flow`**: el handler de la tool `crear_cita` en `bot-citas.ts` pasa `ctx.appointment_flow?.vehiculo_id` — ya no depende de que el LLM lo recuerde.
- **Vehículo obligatorio**: `isNegacion` en `capturar_vehiculo` mantiene al usuario en el mismo paso (antes saltaba al siguiente → `vehiculo_id=null`).
- **Respuestas de frustración**: variantes en todos los pasos deterministas A y B.
- **Step C safety gate**: `if (!skipBot && flowState.nombre_resuelto && flowState.vehiculo_resuelto)` — no avanza a servicio/fecha/hora si A o B generaron una respuesta de error.

### Archivos modificados en 8fdc771

| Archivo | Cambio |
|---------|--------|
| `lib/ai/appointment-flow.ts` | `isClientePlaceholder()` exportada al final del archivo |
| `lib/ai/bot-tools.ts` | `buscarDisponibilidad` → filtro hoy + mensaje especial; `crearCitaBot` → hard gates vehiculo_id + servicio |
| `lib/ai/bot-citas.ts` | Handler `crear_cita` pasa `vehiculo_id: ctx.appointment_flow?.vehiculo_id ?? null` |
| `app/actions/bandeja.ts` | Import `isClientePlaceholder`; Steps A+B reescritos como deterministas; Step C guarded |

### Checklist de demo con 5511118888 (telefono nuevo, sin historial)

Usar **Bandeja → Automatizaciones → Simular mensaje** con teléfono `5511118888`.

**Flujo nominal:**
- [ ] Mensaje "quiero una cita" → bot pregunta nombre (no el LLM, respuesta directa)
- [ ] Responder con nombre "Carlos Mendez" → nombre guardado en `clientes` BD, bot avanza a vehículo
- [ ] Cliente dice que no tiene vehículo registrado → bot pide datos (marca, modelo, año)
- [ ] "Honda City 2022" → vehículo creado en `vehiculos` + `vehiculo_personas` vinculado
- [ ] Bot pregunta servicio → responder "cambio de aceite"
- [ ] Bot pregunta fecha → responder fecha futura → bot muestra slots (no pasados)
- [ ] Bot pregunta hora → responder hora disponible
- [ ] Bot resume y pide confirmación → responder "sí"
- [ ] Cita creada: `vehiculo_id` NOT NULL, `servicio` NOT NULL, `estado='confirmada'`

**Validaciones BD:**
- [ ] `SELECT nombre, apellido FROM clientes WHERE whatsapp='+525511118888'` → muestra nombre real
- [ ] `SELECT * FROM vehiculo_personas vp JOIN vehiculos v ON v.id=vp.vehiculo_id WHERE vp.cliente_id=...` → registro existe
- [ ] `SELECT vehiculo_id, servicio, estado FROM citas WHERE cliente_id=...` → ambos NOT NULL, estado confirmada
- [ ] `SELECT cita_id FROM actividades WHERE cliente_id=... ORDER BY created_at DESC LIMIT 1` → cita_id NOT NULL (requiere migración 019)

**Prueba de disponibilidad hoy:**
- [ ] Simular con "quiero cita para hoy" → slots mostrados son todos futuros (≥ ahora + 30 min)

**Prueba de frustración:**
- [ ] En paso nombre, escribir "no quiero dar mi nombre" → bot insiste con mensaje de disculpa

---

## 🤖 P0.3 BotIA Operational Brain — COMPLETADO 2026-04-28

> Centraliza las constantes del bot en `lib/ai/botia-brain.ts` como fuente única de verdad. Documenta la arquitectura completa de la IA en `docs/ai/`. Limpia los duplicados inline de `appointment-flow.ts`.

### Qué incluye P0.3

| Artefacto | Archivo | Estado |
|-----------|---------|--------|
| Constantes centralizadas | `lib/ai/botia-brain.ts` | ✅ Creado |
| Integraciones en flujo | `lib/ai/appointment-flow.ts` | ✅ Integrado — 7 importaciones desde botia-brain.ts |
| Arquitectura del brain | `docs/ai/BOTIA_OPERATIONAL_BRAIN.md` | ✅ Creado |
| Catálogo de intents | `docs/ai/BOTIA_INTENTS.md` | ✅ Creado |
| Entidades y extracción | `docs/ai/BOTIA_ENTITIES.md` | ✅ Creado |
| Reglas de slots | `docs/ai/BOTIA_SLOT_RULES.md` | ✅ Creado |
| Políticas de respuesta | `docs/ai/BOTIA_RESPONSE_POLICIES.md` | ✅ Creado |
| Reglas de escalación | `docs/ai/BOTIA_ESCALATION_RULES.md` | ✅ Creado |
| Política de aprendizaje | `docs/ai/BOTIA_LEARNING_POLICY.md` | ✅ Creado |
| Corpus semilla | `docs/ai/BOTIA_TRAINING_CORPUS.md` | ✅ Creado (~45 ejemplos YAML) |
| Playbooks por módulo | `docs/ai/BOTIA_MODULE_PLAYBOOKS.md` | ✅ Creado |

### Lo que cambia en appointment-flow.ts

Duplicados eliminados: `PLACEHOLDER_NOMBRES`, `SERVICIOS_KEYWORD`, `MARCAS_CONOCIDAS`, `AFFIRMATIVES` (inline en isAfirmacionFlow), `FRUSTRACION` (inline en isFrustracion), `NEGACIONES` (inline en isNegacion), `INTENT` (inline en intentoAgendar). Todos reemplazados por imports de `botia-brain.ts`. **Sin cambios de comportamiento ni en tipos.**

### Pendientes de P0.3 (futuro)

- [ ] Migrar corpus semilla a tabla `botia_ejemplos_candidatos` cuando volumen supere ~200 ejemplos
- [ ] UI admin de revisión de ejemplos candidatos (pendiente webhook WA activo)
- [ ] Integrar `BOTIA_SERVICE_SYNONYMS` en `classify-intent.ts` cuando se refactorice el clasificador
- [ ] Reagendamiento como flujo único (`reagendarCitaBot()`) — ver BOTIA_MODULE_PLAYBOOKS.md
- [ ] Consulta de estado OT entrante por WA (bloqueante: webhook WA activo)

---

## 🤖 P0.2 BotIA CRM Enrichment + Vehículo — HISTÓRICO d57c8c2

> P0.2 implementó la infraestructura. P0.2.1 (8fdc771) corrige el fallo de ejecución (LLM ignoraba flowInject). La re-prueba debe realizarse con 5511118888 usando el checklist P0.2.1 arriba.

### Archivos creados/modificados en d57c8c2

| Archivo | Cambio |
|---------|--------|
| `lib/ai/bot-crm.ts` | NUEVO — operaciones CRM/vehículo/sucursal via `createAdminClient()` |
| `lib/ai/appointment-flow.ts` | Extendido con pasos `capturar_nombre`, `resolver_vehiculo`, `capturar_vehiculo`; nuevos parsers |
| `lib/ai/bot-citas.ts` | `sucursalInject` en system prompt; `flowInject` para pasos P0.2 |
| `app/actions/bandeja.ts` | State machine P0.2 (Steps A+B+C); guards 5b/5c; `leerInfoSucursal` |
| `app/(dashboard)/bandeja/page.tsx` | Agrega `apellido` al query de clientes |
| `app/(dashboard)/bandeja/_BandejaClient.tsx` | `clienteNombre` muestra nombre+apellido |
  - [ ] `actividades` tiene fila `tipo='cita_agendada'`, `cita_id` referenciando la cita
  - [ ] La cita aparece en "Mi Agenda" del responsable configurado
  - [ ] Preguntar al bot "¿cuál es su dirección?" → responde con datos reales de la sucursal (no inventa)
  - [ ] Preguntar "¿cuál es el horario?" → responde horario real de `configuracion_citas_sucursal`

### Pendiente si sucursal no tiene dirección/horario configurado

Si `sucursales.direccion` está vacío o `configuracion_citas_sucursal` no tiene `horario_inicio/horario_fin`, el bot no podrá responder preguntas de ubicación/horario. Documentar como dependencia de configuración operativa del cliente.

## 🤖 P0 BotIA CITAS — PENDIENTES POST-COMMIT 713e605

> Commit 713e605 implementa asesor_id configurable, actividad trazable, cita_proxima en contexto, guardrails.
> P0.1 validado: flujo seguimiento+confirmación cita existente funciona correctamente.

### Validación obligatoria (P0.1 base)

- [ ] Ejecutar migración 019 en Supabase SQL Editor (ver arriba)
- [ ] Configurar `ai_settings.escalation_assignee_id` con UUID de un usuario responsable en la sucursal de prueba
- [ ] Simular conversación bot → crear cita → verificar que la cita aparece en BD con `asesor_id` y `estado='confirmada'`
- [ ] Verificar que se creó una fila en `actividades` con `tipo='cita_agendada'`, `modulo_origen='ia'`, `cita_id` referenciando la cita creada
- [ ] Verificar que la cita aparece en "Mi Agenda" del usuario configurado en `escalation_assignee_id`
- [ ] Verificar que Bandeja muestra el número de WhatsApp del cliente en el header del chat

### Pendiente de diseño: Automation Engine sin n8n

⬜ El proyecto usa código nativo (Next.js + Vercel Cron). No usa n8n.
⬜ El Workflow Studio (`/bandeja/workflow-studio`) es el embrión del engine.
⬜ Las reglas de BotIA (umbrales, intents, horarios, escalación) viven en `ai_settings` y `automation_rules`.
⬜ Falta: UI para configurar reglas de escalación, timeouts y handoff desde Configuración.
⬜ Falta: engine que ejecute reglas de `automation_rules` de forma determinística (no depender solo del LLM).

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
- [x] P0 BotIA — `crearCitaBot` sets `asesor_id` desde `ai_settings.escalation_assignee_id` (configurable, sin hardcodeo)
- [x] P0 BotIA — `crearCitaBot` crea actividad CRM best-effort (`tipo=cita_agendada`, `modulo_origen=ia`, `cita_id`)
- [x] P0 BotIA — `cita_proxima` inyectada en contexto del bot para clientes con cita próxima (flujo follow-up)
- [x] P0 BotIA — Guardrail anti-hallucination: bloquea frases "cita confirmada" si no hay `cita_id` real
- [x] P0 BotIA — Slot detection fallback: si cliente confirma con "sí" y LLM saltó `preparar_confirmacion_cita`, extrae slot del historial y crea cita directamente
- [x] P0 Bandeja — WhatsApp del cliente visible en header del chat con ícono verde
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
---

## P0.4 Dashboard Citas â€” COMPLETADO 2026-04-28

> `/citas` ya no muestra todo el historial mezclado en una sola vista. El kanban ahora soporta vistas temporales operativas.

### QuÃ© implementa P0.4

| Elemento | Estado |
|---------|--------|
| Vista `Hoy` | âœ… `fecha_cita = hoy` en `America/Mexico_City` |
| Vista `Semana actual` | âœ… lunes a domingo de la semana actual |
| Vista `Mes` | âœ… primer dÃ­a a Ãºltimo dÃ­a del mes actual |
| Vista `Todas` | âœ… sin filtro de fecha |
| Resumen visible | âœ… vista activa + rango visible + total de citas |
| Columnas por estado | âœ… `pendiente_contactar`, `contactada`, `confirmada`, `en_agencia`, `show`, `no_show`, `cancelada` |

### DiagnÃ³stico previo

- `/citas` hacÃ­a `select` de todas las citas visibles por RLS y solo ordenaba por `fecha_cita` y `hora_cita`.
- No habÃ­a control visible para separar hoy, semana actual, mes actual o histÃ³rico completo.
- El kanban no renderizaba la columna `show` aunque el estado existe en tipos y transiciones.

### Pendientes posteriores a P0.4

- [ ] Rango personalizado
- [ ] Filtro por asesor
- [ ] Filtro por sucursal
- [ ] Filtro por estado como control explÃ­cito de UI
- [ ] Vista calendario mensual completa de Citas

---

## P0.4.1 Dashboard Citas â€” COMPLETADO 2026-04-28

> P0.4 saliÃ³ con fallo visual real: el header cambiaba de vista y conteo, pero el kanban podÃ­a seguir mostrando tarjetas de la vista anterior porque el componente cliente retenÃ­a estado local viejo.

### QuÃ© corrige P0.4.1

| Elemento | Estado |
|---------|--------|
| Filtro real de tarjetas por vista | âœ… corregido |
| Conteos por columna alineados con tarjetas renderizadas | âœ… corregido |
| Semana operativa real | âœ… domingo a sÃ¡bado |
| Vista Mes tipo calendario | âœ… MVP implementado |
| Toggle Mes `Calendario` / `Kanban` | âœ… agregado |

### Causa raÃ­z del fallo de P0.4

- `app/(dashboard)/citas/page.tsx` sÃ­ recalculaba la lista filtrada.
- `app/_components/citas/CitasKanban.tsx` guardaba `initialCitas` en `useState(...)` y no se resincronizaba al cambiar props.
- Resultado: el resumen superior reflejaba la vista nueva, pero las tarjetas podÃ­an seguir siendo de la vista anterior.

### Pendientes posteriores a P0.4.1

- [ ] Rango personalizado
- [ ] Filtro por asesor
- [ ] Filtro por sucursal
- [ ] Filtro por estado
- [ ] Drag and drop directo sobre calendario

---

## P0.5 BotIA agencia completa + confirmaciÃ³n correcta â€” COMPLETADO 2026-04-28

> BotIA deja de hablar como si solo fuera asistente de citas. Ahora enruta solicitudes por mÃ³dulo y diferencia confirmaciÃ³n explÃ­cita vs solicitud de llamada humana.

### QuÃ© implementa P0.5

| Elemento | Estado |
|---------|--------|
| BotIA asistente de agencia | âœ… citas, taller, refacciones, atenciÃ³n a clientes, ventas, CSI, seguros |
| Enrutamiento por mÃ³dulo con escalaciÃ³n segura | âœ… implementado |
| Refacciones: pedir pieza + vehÃ­culo y canalizar | âœ… implementado |
| ConfirmaciÃ³n humana â‰  confirmaciÃ³n explÃ­cita | âœ… implementado |
| `pendiente_contactar` si cliente pide llamada | âœ… implementado |
| PolÃ­tica real de recordatorio 24h | âœ… implementado |
| Hora ocupada ofrece alternativas sin escalar | âœ… se mantiene |
| Placa preferente, pero no hard gate | âœ… implementado |

### Pendientes posteriores a P0.5

- [ ] BÃºsqueda real por placa/VIN en CRM desde BotIA
- [ ] OCR de tarjeta de circulaciÃ³n por WhatsApp
- [ ] Widget global BotIA / Requiere asesor
- [ ] Permisos por rol en Bandeja
- [ ] ConfiguraciÃ³n formal por mÃ³dulo
- [ ] Llamada automÃ¡tica IA no implementada
