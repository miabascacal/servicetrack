# BotIA — Module Playbooks

> Guías operativas por módulo para el asistente Ara.
> **Última actualización:** 2026-04-28 — P0.3

---

## MÓDULO: CITAS

### Playbook: Agendar Cita Nueva

**Estado:** ✅ Implementado (P0.1 + P0.2.1)

**Flujo:**
1. Cliente envía intento de cita
2. Bot detecta → entra en state machine
3. Step A: resolver nombre (si DEMO)
4. Step B: resolver vehículo (buscar en DB → confirmar/listar/crear)
5. Step C: capturar servicio → fecha → hora → resumen → confirmación
6. Crear cita con vehiculo_id + servicio NOT NULL
7. Crear actividad best-effort
8. Responder con fecha/hora legibles

**Datos mínimos:** cliente_id, nombre_real, vehiculo_id, servicio, fecha, hora, sucursal_id

**Configuraciones necesarias:** `configuracion_citas_sucursal` (horarios, días), `ai_settings.escalation_assignee_id`

**Cuándo escalar:** Error técnico / cliente molesto persistente / sin disponibilidad total

---

### Playbook: Confirmar Cita Existente

**Estado:** ✅ Implementado (P0.1)

**Flujo:**
1. Primera interacción O intent `confirmar_asistencia`
2. `consultar_citas_cliente()` → encontrar cita próxima
3. Saludar y mencionar la cita
4. Si cliente confirma → `confirmarCitaBot()` → estado=confirmada
5. "¡Perfecto! Tu cita quedó confirmada. ¡Hasta pronto!"

**Datos mínimos:** cliente_id, cita_id

---

### Playbook: Cancelar Cita

**Estado:** ✅ Implementado (P0.1)

**Flujo:**
1. Cliente dice que no puede ir
2. `cancelarCitaBot()` → estado=cancelada
3. "Entendido, tu cita fue cancelada. ¿Te gustaría reagendar?"
4. Si sí → iniciar flujo de agendamiento nuevo

---

### Playbook: Reagendar Cita

**Estado:** ⬜ Pendiente implementación completa

**Flujo planeado:**
1. Detectar intent `reagendar_cita`
2. Consultar cita activa del cliente
3. Cancelar la existente (estado=cancelada)
4. Iniciar flujo nuevo de agendamiento con datos parciales pre-cargados
5. Confirmar nuevo resumen

**Bloqueante:** No hay action específica `reagendarCitaBot()`. La cancelación + nueva cita son pasos separados.

---

### Pendientes de Citas

| Ítem | Prioridad |
|------|-----------|
| Vista Hoy en dashboard `/citas` | Alta |
| Vista Semana actual | Alta |
| Vista Mes | Media |
| Vista Todas (sin filtro de fecha) | Media |
| Rango personalizado | Baja |
| Filtro por asesor | Media |
| Filtro por estado | Media |
| Reagendamiento como flujo único | Media |

---

## MÓDULO: TALLER / OTs

### Playbook: Aviso Vehículo Listo

**Estado:** ✅ Implementado (WA saliente)

**Flujo:**
1. Asesor cambia OT a estado `listo`
2. `updateEstadoOTAction()` detecta estado=listo
3. `enviarMensajeWA()` con `mensajeVehiculoListo()`
4. Best-effort — fallo no bloquea operación

---

### Playbook: Consulta Estado de OT (entrante)

**Estado:** ⬜ Pendiente

**Flujo planeado:**
1. Cliente pregunta por su vehículo por WA
2. Bot detecta intent `taller_estado_ot`
3. Buscar OT activa del cliente
4. Responder con estado actual y estimado de entrega

**Bloqueante:** Webhook WA no activo. No hay herramienta `consultarEstadoOT` en bot-tools.ts.

---

### Pendientes de Taller

| Ítem | Prioridad |
|------|-----------|
| Consulta estado OT entrante por WA | Alta (cuando WA activo) |
| Notificación cambio de estado OT | Media |
| Autorización de trabajo (WA → cliente aprueba) | Alta |
| `updated_by` en ordenes_trabajo | Baja |

---

## MÓDULO: REFACCIONES

### Estado general: ⬜ Pendiente

**Flujo planeado:**
1. Asesor registra llegada de pieza
2. Bot WA al cliente: "Tu pieza llegó. ¿Quieres agendar cita para instalarla?"
3. Cliente toca sí → flujo de cita nueva con servicio pre-cargado
4. CRM crea actividad urgente para encargada

**Bloqueante:** Webhook WA no activo.

---

## MÓDULO: CSI

### Playbook: Encuesta Post-Servicio

**Estado:** ⬜ Pendiente

**Flujo planeado:**
1. OT → estado=entregado
2. 48h después → cron envía WA con link de encuesta
3. Si cliente responde "feliz" → WA con link reseña Google
4. Si cliente responde "no feliz" → actividad urgente para MK

**Bloqueante:** Webhook WA + cron CSI no implementados.

---

## MÓDULO: VENTAS

### Playbook: Seguimiento de Lead

**Estado:** ⬜ Pendiente

**Flujo planeado:**
1. Lead en estado `cotizado` sin actividad en X días
2. Bot WA: "¿Sigues interesado en el vehículo que cotizaste?"
3. Si responde → actividad para asesor de ventas

---

## MÓDULO: ATENCIÓN A CLIENTES

### Playbook: Queja / Escalación

**Estado:** 🟡 Parcial — escalación a asesor implementada

**Flujo:**
1. Cliente expresa queja compleja o solicita hablar con humano
2. Bot detecta → `handoff=true` → `waiting_agent`
3. Bandeja muestra "⚡ Requiere asesor"
4. Asesor toma la conversación desde Bandeja

**Pendiente:**
- Actividad automática para jefe de Atención al Cliente
- Notificación push/email/WA al asesor

---

## BANDEJA — Requisitos Asesor

### Estado actual del botón "Requieren asesor"

**Ya implementado:**
- Filtro `waiting_agent` en `_BandejaClient.tsx`
- Contador `countRequiereAsesor`
- El botón aparece cuando count > 0
- Al clic aplica filtro a la lista

**Pendiente:**
- Mostrar siempre (no conditional) para que asesor recuerde existencia del filtro
- Notificación al asesor cuando nueva conversación entra en `waiting_agent`
- Widget flotante global (ver abajo)

---

## WIDGET GLOBAL (futuro)

### Descripción

Botón flotante visible en todas las pantallas del dashboard que muestra:
- Número de conversaciones `waiting_agent`
- Al clic → navega a Bandeja con filtro "Requiere asesor" activo

**Diseño:** Botón en esquina inferior derecha, similar a chat de soporte.

**Implementación sugerida:**
- Componente `BotiaWidget` en `app/(dashboard)/layout.tsx`
- Contador via Server Component o realtime subscription a `conversation_threads`
- No implementar hasta que WA esté activo en producción

---

## CONFIGURACIÓN POR MÓDULO (pendiente)

Cada módulo necesitará config propia:

| Módulo | Config necesaria |
|--------|-----------------|
| Citas | buffer_minutos_hoy, intervalo, días, horarios |
| Taller | tiempo_promedio_servicio, alertas de escalación |
| Refacciones | dias_anticipacion_aviso |
| CSI | horas_post_entrega_encuesta |
| Ventas | dias_inactividad_followup |
| Bot general | max_reintentos, umbral_frustracion, escalation_assignee |
## Addendum P0.5 â€” mÃ³dulos de agencia

### Refacciones
- BotIA debe responder como asistente de agencia.
- Datos mÃ­nimos a pedir: pieza/refacciÃ³n, vehÃ­culo y placa/VIN si el cliente la tiene.
- Si hay datos suficientes, canalizar a Refacciones con actividad segura.
- Si faltan datos o no hay acciÃ³n segura suficiente, mantener la conversaciÃ³n abierta y dejar `waiting_agent`.

### ConfirmaciÃ³n de cita
- ConfirmaciÃ³n explÃ­cita del cliente â†’ cita `confirmada`.
- Solicitud de llamada o confirmaciÃ³n humana â†’ cita `pendiente_contactar` + actividad para asesor + thread `waiting_agent`.
- Rechazo de la cita â†’ no crear cita confirmada; ofrecer reagendar o asesor.

### Recordatorios
- WhatsApp un dÃ­a antes solo si la automatizaciÃ³n estÃ¡ activa.
- Llamada humana solo si existe actividad para asesor.
- Llamada automÃ¡tica IA sigue pendiente.
