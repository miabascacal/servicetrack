# BotIA — Slot Rules

> Reglas de slots obligatorios por flujo.
> **Última actualización:** 2026-04-28 — P0.3

---

## Flujo: Agendar Cita

### Orden obligatorio de resolución

```
1. resolver_cliente    → whatsapp (primario) / email / placa / VIN
2. resolver_nombre     → nombre real (no placeholder CLIENTE/DEMO)
3. resolver_vehiculo   → vehiculo_id con marca/modelo/año; placa preferente
4. capturar_servicio   → tipo de servicio normalizado
5. capturar_fecha      → YYYY-MM-DD, validar disponibilidad del día
6. capturar_hora       → HH:MM, validar slot libre
7. confirmar_resumen   → presentar todos los datos antes de crear
8. crear_cita          → INSERT en citas con vehiculo_id + servicio NOT NULL
9. crear_actividad     → best-effort, no bloquea
10. responder          → confirmación con fecha/hora legibles SOLO si cita_id existe
```

### Slots obligatorios

| Slot | Fuente | Hard gate |
|------|--------|-----------|
| `cliente_id` | BD — resolución por WA | Sí (en simularMensajeAction) |
| `nombre real` | `isClientePlaceholder() = false` | Sí (Step A bandeja.ts) |
| `whatsapp` | Mensaje entrante | Sí |
| `vehiculo_id` | BD / creación | **Sí — `crearCitaBot()` rechaza null** |
| `servicio` | `parsearServicio()` + confirmación | **Sí — `crearCitaBot()` rechaza null** |
| `fecha` | `parsearFecha()` | Sí (Step C) |
| `hora` | `parsearHora()` + `buscarDisponibilidad()` | Sí (Step C) |
| `sucursal_id` | Session/auth | Sí (de ensureUsuario) |

### Slots opcionales

| Slot | Cómo se obtiene | Default |
|------|----------------|---------|
| `asesor_id` | `ai_settings.escalation_assignee_id` | NULL (bot configurable) |
| `notas` | Texto libre del cliente | NULL |
| `placa` del vehículo | Proporcionada por cliente | NULL (preferente, no bloquea) |

---

## Reglas de Resolución

### Cliente

- **WhatsApp es la llave primaria.** Siempre buscar por `+52XXXXXXXXXX` primero.
- **email es complemento.** Solo si WA no da resultado.
- **nombre NO es llave.** Solo sirve para mostrar. Dos clientes pueden llamarse igual.
- **`cliente_id` existente ≠ cliente resuelto.** Usar `isClientePlaceholder()`.
- Si el registro tiene `nombre='CLIENTE'` y `apellido='DEMO'` (u otros placeholders) → entrar en Step A (captura de nombre real).

### Vehículo

- **Buscar primero en `vehiculo_personas` del cliente** antes de pedir datos.
- Si tiene 1 vehículo → confirmar.
- Si tiene múltiples → presentar lista numerada y pedir selección.
- Si no tiene → pedir datos: marca, modelo, año y placa si la tiene.
- **placa es preferente.** Pedirla explícitamente si el cliente no la mencionó.
- Si cliente dice "no tengo la placa" → continuar sin placa (no bloquear).
- **Vehículo es OBLIGATORIO.** `isNegacion` en `capturar_vehiculo` mantiene al cliente en el mismo paso.
- Futuro: buscar por placa/VIN en `vehiculos` antes de crear uno nuevo.

### Servicio

- Usar `BOTIA_SERVICE_SYNONYMS` para normalizar variantes ("aceite" → "Cambio de aceite").
- Si el cliente dice "me toca servicio de 50 mil" → "Servicio 50 mil km".
- Si el cliente dice "check engine" / "testigo" → "Diagnóstico — testigo encendido".
- Si el cliente dice solo "revisión" → "Revisión general".
- Si no se puede inferir → preguntar: `"¿Qué servicio necesitas? (cambio de aceite, revisión, diagnóstico, frenos...)"`

### Fecha

- No puede ser pasado → rechazar con mensaje.
- "Hoy" → aplicar filtro de hora actual + buffer 30 min.
- "La próxima semana" → ir al lunes siguiente.
- Si el día solicitado no está en `dias_disponibles` → informar y ofrecer siguiente día disponible.

### Hora

- **Siempre** verificar con `buscarDisponibilidad()` antes de confirmar.
- Si hora ocupada → ofrecer alternativas disponibles → NO escalar si hay opciones.
- Solo escalar si no hay disponibilidad Y el cliente rechaza todas las alternativas.
- Mostrar máximo 8 horarios para no abrumar.

### Confirmación

- **Resumen obligatorio** antes de crear:
  ```
  "Confirmo los datos:
  Cliente: [nombre]
  Vehículo: [marca modelo año (placa)]
  Servicio: [servicio]
  Fecha: [día legible]
  Hora: [hora]
  ¿Confirmas tu cita?"
  ```
- Solo crear cita con afirmación explícita del cliente.
- Guardar `confirmacion_pendiente` en metadata → pre-check determinístico.

---

## Regla de No-Repetición

Si el cliente dice "ya te dije" / "ya lo dije" / "eso ya lo puse":

1. Revisar `metadata.appointment_flow` para el dato.
2. Si el dato está en metadata → avanzar al siguiente paso sin repetir pregunta.
3. Si el dato NO está en metadata (genuinamente faltante) → pedir solo ese dato con disculpa:
   `"Disculpa, no encontré ese dato. ¿Me puedes confirmar [solo el dato faltante]?"`

---

## Estado Actual de Implementación

| Regla | Implementada | Archivo |
|-------|-------------|---------|
| Step A determinista (nombre) | ✅ P0.2.1 | bandeja.ts |
| Step B determinista (vehículo) | ✅ P0.2.1 | bandeja.ts |
| Hard gate vehiculo_id | ✅ P0.2.1 | bot-tools.ts |
| Hard gate servicio | ✅ P0.2.1 | bot-tools.ts |
| Filtro disponibilidad hoy | ✅ P0.2.1 | bot-tools.ts |
| isClientePlaceholder() | ✅ P0.2.1 | appointment-flow.ts |
| Búsqueda por placa/VIN | ⬜ Pendiente | bot-crm.ts |
| Normalización BOTIA_SERVICE_SYNONYMS | ✅ P0.3 (botia-brain.ts) | — |
| Resumen antes de confirmar | ✅ Step C bandeja.ts | bandeja.ts |
| No repetición con metadata | ⬜ Parcial — frustración detectada pero no smart-lookup | bandeja.ts |
