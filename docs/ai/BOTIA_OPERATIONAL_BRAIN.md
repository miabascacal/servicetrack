# BotIA Operational Brain — ServiceTrack

> Arquitectura de inteligencia operativa del asistente Ara.
> **Última actualización:** 2026-04-28 — P0.3

---

## P0.5.1 - identity gates y auditoria

- El orden operativo para agendar queda fijado en codigo: cliente/nombre confiable -> vehiculo -> placa preferente o `placa_pendiente` -> servicio -> fecha -> hora -> confirmacion final.
- BotIA no puede crear cliente basura ni cerrar una cita `confirmada` si falta cualquiera de esos datos criticos.
- Si el cliente pide llamada humana o confirmacion humana, la cita debe quedar `pendiente_contactar`, con actividad para asesor y thread `waiting_agent`.
- BotIA debe responder como asistente de agencia y no puede decir que no tiene acceso a CRM/BD o que solo atiende citas.
- La trazabilidad minima obligatoria queda en `mensajes`, metadata de `conversation_threads` y `automation_logs` best-effort.

## 1. Principio Rector

**La IA redacta y ayuda a interpretar, pero las acciones críticas las decide código determinístico.**

El LLM (Claude Haiku) puede:
- Generar texto de respuesta
- Interpretar intención aproximada
- Sugerir siguiente paso

El LLM **NUNCA** puede:
- Crear una cita sin que código determinístico valide los slots
- Confirmar una cita sin un `cita_id` real en BD
- Inventar dirección, horario o costo no configurados
- Aprender patrones sin aprobación de admin

---

## 2. Flujo de Procesamiento

```
Mensaje cliente (WA / Demo)
        │
        ▼
[1] Normalización
     - Strip whitespace, lowercase para análisis
     - Detectar frustración → isFrustracion()
     - Detectar afirmación → isAfirmacionFlow()

        │
        ▼
[2] Intent Detection
     - classifyIntent() → intent + confidence
     - Si confidence < threshold → ambiguous path

        │
        ▼
[3] Entity Extraction
     - parsearNombre(), parsearFecha(), parsearHora()
     - parsearVehiculo(), parsearServicio()
     - parsearSeleccion() para respuestas de lista

        │
        ▼
[4] State / Slot Check
     - getAppointmentFlowState() → AppointmentFlowState
     - isClientePlaceholder() → ¿cliente resuelto?
     - ¿vehiculo_id resuelto?
     - ¿servicio, fecha, hora presentes?

        │
        ▼
[5] Rules Engine (bandeja.ts — determinístico)
     - Step A: nombre_resuelto? → capturar nombre
     - Step B: vehiculo_resuelto? → resolver vehículo
     - Step C: slots completos? → capturar servicio/fecha/hora
     - Pre-check: confirmacion_pendiente + isAfirmacion → crear cita directo

        │
        ▼
[6] Allowed Action
     - skipBot=true → respuesta ya generada determinísticamente
     - skipBot=false → pasar al LLM con contexto enriquecido

        │
        ▼
[7] LLM (Claude Haiku) — solo si skipBot=false
     - system prompt + sucursalInject + citaProximaInject + flowInject
     - tools: buscar_disponibilidad, crear_cita, confirmar_cita, escalar_a_asesor
     - máximo 8 iteraciones del loop agéntico

        │
        ▼
[8] Response Policy
     - Guardrail anti-hallucination: si dice "confirmada" sin cita_id → reemplazar
     - Tono: profesional, breve, ≤3 líneas, 1 pregunta por turno
     - Si handoff=true → estado thread → waiting_agent

        │
        ▼
[9] Audit / Log
     - mensajes INSERT con message_source='agent_bot'
     - automation_logs INSERT (best-effort)
     - setAppointmentFlowState() → persiste estado en metadata
```

---

## 3. Relación con Módulos

| Módulo | BotIA puede | BotIA no puede (aún) |
|--------|-------------|----------------------|
| **CRM / Clientes** | Buscar por WA, actualizar nombre real, crear cliente DEMO | Crear cliente completo con todos los campos |
| **CRM / Vehículos** | Buscar por cliente, crear vehículo simple, vincular | Buscar por placa/VIN, OCR tarjeta de circulación |
| **Citas** | Consultar, crear, confirmar, cancelar | Reagendar con cambio de fecha (pendiente) |
| **Taller / OTs** | Notificar estado (WA saliente cuando OT→listo) | Consultar estado de OT por WA (pendiente) |
| **Refacciones** | — | Consultar disponibilidad de pieza (futuro) |
| **CSI** | — | Enviar encuesta post-servicio (futuro) |
| **Ventas** | — | Seguimiento de leads (futuro) |
| **Atención a Clientes** | Escalar conversación a asesor | Resolver quejas complejas autónomamente |
| **Automatizaciones** | Crear actividad best-effort | Ejecutar reglas de automation_rules (motor pendiente) |
| **Configuración** | Leer horarios, dirección, teléfono de sucursal | Modificar configuración |

---

## 4. Acciones Permitidas

### Sin confirmación adicional del cliente
- Buscar cliente por WA
- Consultar citas del cliente
- Buscar disponibilidad de horarios
- Leer info de sucursal

### Requieren confirmación explícita del cliente
- Crear cita nueva (resumen → "¿Confirmas?")
- Cancelar cita existente
- Reagendar cita (resumen → "¿Confirmas el nuevo horario?")
- Crear vehículo si datos son ambiguos

### Requieren asesor humano
Ver `BOTIA_ESCALATION_RULES.md`.

---

## 5. Reglas de No-Hardcode

Toda la siguiente información **debe venir de configuración**, no de constantes de código:

| Dato | Fuente |
|------|--------|
| Horarios de atención | `configuracion_citas_sucursal.horario_inicio / horario_fin` |
| Días disponibles | `configuracion_citas_sucursal.dias_disponibles` |
| Dirección y teléfono | `sucursales.direccion / telefono` |
| Responsable (asesor) | `ai_settings.escalation_assignee_id` |
| Buffer mínimo para hoy | `configuracion_citas_sucursal` (TODO: agregar columna) |
| Umbral de confianza IA | `ai_settings.confidence_threshold` |
| Horario del bot | `ai_settings` (activo/inactivo, hora_inicio, hora_fin) |
| Permisos por módulo | `configuracion` / `permisos` (pendiente FASE 4) |

---

## 6. Estado Actual (2026-04-28)

| Componente | Estado |
|------------|--------|
| Steps A+B deterministas (nombre + vehículo) | ✅ P0.2.1 |
| Hard gates (vehiculo_id + servicio no null) | ✅ P0.2.1 |
| Disponibilidad hoy filtrada | ✅ P0.2.1 |
| Seguimiento citas existentes (P0.1) | ✅ |
| Sucursal info en contexto | ✅ P0.2 |
| Cerebro operativo documental | ✅ P0.3 (este documento) |
| Motor de automatizaciones | ⬜ Pendiente |
| OCR tarjeta de circulación | ⬜ Futuro |
| Widget flotante global | ⬜ Futuro |
| Permisos por rol en Bandeja | ⬜ Pendiente FASE 4 |
| Búsqueda por placa/VIN | ⬜ Pendiente |
| Aprendizaje supervisado (UI) | ⬜ Pendiente |

---

## 7. Próximos Pasos

1. **Demo re-prueba** con teléfono `5511118888` usando checklist PENDIENTES.md
2. **Migración 019** ejecutar en Supabase (cita_id en actividades)
3. **ai_settings** configurar `escalation_assignee_id`
4. **Búsqueda por placa/VIN** — `buscarVehiculoPorPlaca()` en bot-crm.ts
5. **Motor de automatizaciones** — `automation_rules` engine
6. **Vistas de Citas** — Hoy / Semana / Mes / Todas
7. **Widget global BotIA** — botón flotante en todas las pantallas
---

## Addendum P0.5 â€” BotIA asistente de agencia

- BotIA ya no debe presentarse como asistente exclusivo de citas. A nivel operativo es asistente de agencia para: `citas`, `taller`, `refacciones`, `atencion_clientes`, `ventas`, `csi` y `seguros`.
- Las acciones crÃ­ticas siguen siendo determinÃ­sticas. P0.5 no reemplaza los hard gates de P0.2.1.
- Si el cliente pide refacciones, BotIA debe pedir datos mÃ­nimos (`pieza/refaccion`, `vehiculo`, `placa/VIN si existe`) y canalizar a Refacciones. No debe cerrar la conversaciÃ³n ni responder "solo citas".
- Si el cliente acepta fecha/hora pero pide llamada o confirmaciÃ³n humana, la cita debe quedar `pendiente_contactar`, con actividad para asesor y thread `waiting_agent`.
- Si el cliente confirma explÃ­citamente, la cita sÃ­ queda `confirmada`.
- La placa se pide de forma preferente. Si el cliente no la tiene a la mano, el flujo puede continuar con `placa_pendiente`.
- La polÃ­tica de recordatorio debe reflejar el sistema real: WhatsApp un dÃ­a antes solo si la automatizaciÃ³n estÃ¡ activa; llamada solo si existe actividad para asesor. Llamada automÃ¡tica IA sigue siendo futuro.

## Addendum P0.6 — estado inicial de citas y duplicados

- **Todas las citas nuevas creadas por BotIA tienen `estado=pendiente_contactar`.** Esto aplica en todos los paths: flujo determinista (isAfirmacionFlow, pendingConf), step-5c (slot detection fallback), y tool `crear_cita` del LLM.
- **Solo `confirmarCitaBot` produce `estado=confirmada`.** Este helper se invoca exclusivamente cuando el cliente confirma asistencia a una cita que ya existe en BD (paso de seguimiento, no booking inicial).
- **Guarda de duplicados en `crearCitaBot`:** antes de crear una cita, verifica si el cliente ya tiene una cita activa en la misma fecha (estados distintos a cancelada/no_show). Si existe, retorna error descriptivo para que el bot pregunte al cliente si quiere confirmar la existente o cambiar de fecha.
- **Placa ask-once:** si el bot ya esta en `step=capturar_placa` y el cliente responde sin placa valida ni frase explicita de no tenerla, se marca `placa_pendiente=true` y se avanza. No hay loop infinito de preguntas de placa.
