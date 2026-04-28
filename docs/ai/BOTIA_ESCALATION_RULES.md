# BotIA — Escalation Rules

> Cuándo y cómo escalar a un asesor humano.
> **Última actualización:** 2026-04-28 — P0.3

---

## Cuándo ESCALAR

| Condición | Razón |
|-----------|-------|
| Cliente pide asesor o humano explícitamente | `hablar_asesor` |
| Cliente molesto después de 2 disculpas sin avance | `cliente_molesto_persiste` |
| Cliente insulta por segunda vez | `insulto_o_agresion` |
| Datos contradictorios no resolvibles | `datos_contradictorios` |
| No hay disponibilidad Y cliente rechaza alternativas | `sin_disponibilidad_y_rechaza` |
| Falla técnica en herramienta/DB/API | `falla_tecnica` |
| Falta configuración crítica en `ai_settings` | `falta_configuracion_critica` |
| Cliente pregunta precio no configurado | `costo_no_configurado` |
| Queja compleja o solicitud legal | `queja_compleja` |
| Solicitud fuera del alcance del bot | `solicitud_fuera_de_alcance` |
| No se puede identificar al cliente | `cliente_no_identificado` |
| Error al actualizar CRM (nombre/vehículo) | `error_crm_update` |

---

## Cuándo NO ESCALAR

| Situación | Acción correcta |
|-----------|----------------|
| Hora ocupada pero hay alternativas | Ofrecer horarios disponibles |
| Falta nombre (placeholder) | Step A — pedir nombre directamente |
| Falta vehículo | Step B — resolver vehículo |
| Falta servicio | Preguntar el servicio |
| Cliente dice "ya te dije" | Revisar metadata → pedir solo lo faltante |
| Cliente pregunta ubicación/horario con config disponible | Responder con datos de BD |
| Cliente no sabe la placa | Continuar sin placa |
| Cliente da datos ambiguos | Pedir aclaración una vez |

---

## Qué Crea la Escalación

Cuando se escala:

1. **Estado del thread** → `waiting_agent`
2. **Bandeja UI** → conversación aparece con badge "⚡ Requiere asesor" y borde naranja
3. **Actividad para asesor** (pendiente implementar) → `tipo='escalacion_bot'` en actividades
4. **Metadata** → `escalation_reason` guardado en `conversation_threads.metadata`
5. **Respuesta al cliente** → `"Voy a conectarte con un asesor que podrá ayudarte mejor."`

---

## Flujo de Escalación Actual (implementado)

```
handoff = true en simularMensajeAction / procesarMensajeAction
    │
    ▼
supabase.update conversation_threads
  SET estado = 'waiting_agent'
    │
    ▼
Respuesta al cliente:
  "Entiendo. Voy a conectarte con un asesor."
    │
    ▼
Bandeja muestra conversación con:
  - Borde naranja izquierdo
  - Badge "⚡ Requiere asesor"
  - Visible en filtro "Requiere asesor"
```

---

## Flujo de Escalación Pendiente (futuro)

```
escalacion detectada
    │
    ├── INSERT actividades (tipo='escalacion_bot', asignada a responsable)
    ├── INSERT outbound_queue (notificación WA al asesor si tiene WA activo)
    └── Notificación push/email al asesor (config pendiente)
```

---

## Criterios de Intensidad

| Nivel | Condición | Acción |
|-------|-----------|--------|
| **Suave** | Cliente confundido / repite | Disculparse + retomar estado |
| **Media** | Frustrado con avance | Confirmar datos existentes + pedir solo faltante |
| **Alta** | Molesto o insulta 1 vez | Disculpa + retomar + tono neutro |
| **Escalación** | Insulta 2 veces / pide humano / falla técnica | `handoff=true` → `waiting_agent` |

---

## Configuración Futura

Las siguientes reglas deben venir de `ai_settings`, no del código:

| Parámetro | Descripción | Default actual |
|-----------|-------------|---------------|
| `max_reintentos_bot` | Cuántas veces puede preguntar lo mismo antes de escalar | 3 (hardcoded) |
| `umbral_frustracion_escalacion` | N mensajes frustrados antes de escalar | 2 (hardcoded) |
| `escalation_assignee_id` | UUID del responsable que recibe escalaciones | NULL |
| `notificar_asesor_wa` | Enviar WA al asesor cuando se escala | false |
| `notificar_asesor_email` | Enviar email al asesor cuando se escala | false |
