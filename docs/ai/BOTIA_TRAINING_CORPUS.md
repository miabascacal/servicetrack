# BotIA — Training Corpus Inicial

> Ejemplos semilla para el corpus supervisado del asistente Ara.
> **Última actualización:** 2026-04-28 — P0.3
> Estos ejemplos son el bootstrap inicial. No están en BD aún.

Formato:
- `user_text`: frase literal del cliente
- `expected_intent`: intent esperado
- `expected_entities`: entidades a extraer
- `required_state_update`: qué campo de AppointmentFlowState actualizar
- `expected_response_behavior`: qué debe hacer el bot
- `allowed_action`: acción del sistema
- `escalation_required`: si debe escalar
- `notes`: observaciones

---

## AGENDAMIENTO

```yaml
- user_text: "quiero una cita"
  expected_intent: agendar_cita
  expected_entities: {}
  required_state_update: step=capturar_nombre (si DEMO) o step=capturar_servicio
  expected_response_behavior: Pedir nombre si placeholder; o pedir servicio si resuelto
  allowed_action: initFlow
  escalation_required: false
  notes: Intent más común de entrada al flujo

- user_text: "necesito cita"
  expected_intent: agendar_cita
  expected_entities: {}
  required_state_update: idem
  allowed_action: initFlow
  escalation_required: false

- user_text: "quiero llevar mi coche"
  expected_intent: agendar_cita
  expected_entities: {}
  allowed_action: initFlow
  escalation_required: false

- user_text: "tienes espacio hoy"
  expected_intent: agendar_cita / consultar_disponibilidad
  expected_entities: { fecha: "hoy" }
  allowed_action: buscarDisponibilidad → mostrar slots hoy
  escalation_required: false
  notes: fecha_relativa → hoy; verificar filtro de hora actual

- user_text: "me puedes agendar"
  expected_intent: agendar_cita
  expected_entities: {}
  allowed_action: initFlow
  escalation_required: false

- user_text: "mañana temprano"
  expected_intent: seleccionar_fecha / preferencia_hora
  expected_entities: { fecha: "mañana", preferencia_momento: "temprano" }
  allowed_action: buscarDisponibilidad → filtrar mañana/primera hora
  escalation_required: false
  notes: "temprano" no tiene parser aún — bot debe preguntar la hora

- user_text: "a las 8"
  expected_intent: seleccionar_hora
  expected_entities: { hora: "08:00" }
  required_state_update: hora="08:00"
  allowed_action: parsearHora → verificar disponibilidad
  escalation_required: false

- user_text: "después de las 3"
  expected_intent: seleccionar_hora / preferencia_hora
  expected_entities: { despues_de_hora: "15:00" }
  allowed_action: buscarDisponibilidad → filtrar ≥15:30
  escalation_required: false
  notes: No hay parser de "después de" aún

- user_text: "sí confirmo"
  expected_intent: confirmar_cita
  expected_entities: {}
  required_state_update: step=completado (si hay confirmacion_pendiente)
  allowed_action: crearCitaBot o confirmarCitaBot
  escalation_required: false
```

---

## SERVICIO AMBIGUO

```yaml
- user_text: "creo que me toca servicio"
  expected_intent: mantenimiento
  expected_entities: { servicio: "Mantenimiento" }
  required_state_update: servicio="Mantenimiento"
  expected_response_behavior: Confirmar y avanzar a fecha
  escalation_required: false

- user_text: "me toca mantenimiento"
  expected_intent: mantenimiento
  expected_entities: { servicio: "Mantenimiento" }
  escalation_required: false

- user_text: "servicio general"
  expected_intent: revision_general
  expected_entities: { servicio: "Revisión general" }
  escalation_required: false

- user_text: "revisión"
  expected_intent: revision_general
  expected_entities: { servicio: "Revisión general" }
  escalation_required: false

- user_text: "se prendió un testigo"
  expected_intent: diagnostico_testigo
  expected_entities: { servicio: "Diagnóstico — testigo encendido" }
  escalation_required: false
  notes: Muy común — asegurar normalización

- user_text: "hace ruido"
  expected_intent: ruido
  expected_entities: { servicio: "Diagnóstico — ruido" }
  escalation_required: false

- user_text: "vibra"
  expected_intent: ruido
  expected_entities: { servicio: "Diagnóstico — vibración" }
  escalation_required: false

- user_text: "no frena bien"
  expected_intent: frenos
  expected_entities: { servicio: "Revisión de frenos" }
  escalation_required: false

- user_text: "pierde potencia"
  expected_intent: diagnostico_testigo
  expected_entities: { servicio: "Diagnóstico — pérdida de potencia" }
  escalation_required: false

- user_text: "cambio de aceite"
  expected_intent: cambio_aceite
  expected_entities: { servicio: "Cambio de aceite" }
  escalation_required: false

- user_text: "me toca el de 50 mil"
  expected_intent: mantenimiento
  expected_entities: { servicio: "Servicio 50 mil km" }
  escalation_required: false
  notes: Regex \b(\d+)\s*(?:mil|k)\b ya lo cubre en parsearServicio
```

---

## VEHÍCULO

```yaml
- user_text: "Honda City 2026 placa TEST888"
  expected_intent: proporcionar_vehiculo
  expected_entities: { marca: "Honda", modelo: "City", anio: 2026, placa: "TEST888" }
  required_state_update: vehiculo_id (crear o buscar), vehiculo_resuelto=true
  escalation_required: false

- user_text: "Mercedes Benz CLA 2026"
  expected_intent: proporcionar_vehiculo
  expected_entities: { marca: "Mercedes", modelo: "CLA 2026", anio: 2026 }
  escalation_required: false

- user_text: "mi camioneta"
  expected_intent: proporcionar_vehiculo (insuficiente)
  expected_entities: {}
  expected_response_behavior: Pedir datos específicos
  escalation_required: false
  notes: No hay marca ni año — parsearVehiculo retorna null

- user_text: "no tengo la placa"
  expected_intent: no_tengo_placa
  expected_entities: {}
  required_state_update: continuar sin placa
  escalation_required: false
  notes: Vehículo sigue siendo obligatorio — solo placa es opcional

- user_text: "te mando foto de la tarjeta"
  expected_intent: enviar_tarjeta_circulacion
  expected_entities: {}
  expected_response_behavior: Informar que OCR no está disponible; pedir datos manualmente
  escalation_required: false
  notes: OCR es mejora futura

- user_text: "la placa es ABC123"
  expected_intent: proporcionar_placa
  expected_entities: { placa: "ABC123" }
  required_state_update: buscar vehiculo por placa
  escalation_required: false
  notes: Pendiente: buscarVehiculoPorPlaca() en bot-crm.ts

- user_text: "es el mismo de siempre"
  expected_intent: confirmar_vehiculo
  expected_entities: {}
  expected_response_behavior: Buscar vehículo más reciente del cliente
  escalation_required: false
  notes: parsearSeleccion puede manejar si hay 1 opción
```

---

## FRUSTRACIÓN / YA TE DIJE

```yaml
- user_text: "ya te dije"
  expected_intent: cliente_dice_ya_te_dije
  expected_entities: {}
  expected_response_behavior: Revisar metadata → pedir solo dato faltante → disculparse
  escalation_required: false
  notes: isFrustracion() detecta → respuesta determinística

- user_text: "ya te había dicho"
  expected_intent: cliente_dice_ya_te_dije
  expected_entities: {}
  expected_response_behavior: idem
  escalation_required: false

- user_text: "no me entiendes"
  expected_intent: cliente_frustrado
  expected_entities: {}
  expected_response_behavior: Disculparse + retomar datos + avanzar
  escalation_required: false

- user_text: "otra vez"
  expected_intent: cliente_dice_ya_te_dije
  expected_entities: {}
  escalation_required: false

- user_text: "eso ya lo puse"
  expected_intent: cliente_dice_ya_te_dije
  expected_entities: {}
  escalation_required: false

- user_text: "pásame con alguien"
  expected_intent: hablar_asesor
  expected_entities: {}
  expected_response_behavior: Escalar inmediatamente
  escalation_required: true
  notes: handoff=true → waiting_agent

- user_text: "no vas a terminar de atenderme"
  expected_intent: cliente_molesto
  expected_entities: {}
  expected_response_behavior: Disculpa + retomar; si es segunda vez → escalar
  escalation_required: depends_on_count
```

---

## UBICACIÓN / REQUISITOS

```yaml
- user_text: "dónde queda"
  expected_intent: consultar_ubicacion
  expected_entities: {}
  expected_response_behavior: Responder con sucursales.direccion
  escalation_required: false

- user_text: "cómo llego"
  expected_intent: como_llegar
  expected_entities: {}
  expected_response_behavior: Dirección + link Google Maps si está configurado
  escalation_required: false

- user_text: "qué llevo"
  expected_intent: consultar_requisitos
  expected_entities: {}
  expected_response_behavior: "Para recoger tu vehículo trae: tarjeta de circulación, identificación oficial y llaves"
  escalation_required: false

- user_text: "a qué hora abren"
  expected_intent: consultar_horario
  expected_entities: {}
  expected_response_behavior: Horario de BD (configuracion_citas_sucursal)
  escalation_required: false

- user_text: "qué documentos necesito"
  expected_intent: consultar_requisitos
  expected_entities: {}
  escalation_required: false
```

---

## HORA OCUPADA

```yaml
- user_text: "a las 8"
  context: slot solicitado, slot ocupado
  expected_intent: seleccionar_hora
  expected_entities: { hora: "08:00" }
  expected_response_behavior: "Ese horario está ocupado. Tengo: [alternativas]"
  allowed_action: buscarDisponibilidad → mostrar libres
  escalation_required: false
  notes: NUNCA escalar solo por hora ocupada

- user_text: "solo puedo después de la 1"
  expected_intent: preferencia_hora
  expected_entities: { despues_de_hora: "13:00" }
  expected_response_behavior: Filtrar slots ≥13:30
  escalation_required: false
  notes: Parser pendiente — bot puede pedir más precisión

- user_text: "no puedo en la mañana"
  expected_intent: preferencia_hora
  expected_entities: { preferencia_momento: "tarde" }
  expected_response_behavior: Mostrar solo slots de tarde
  escalation_required: false

- user_text: "entonces mañana primera hora"
  expected_intent: seleccionar_fecha / preferencia_hora
  expected_entities: { fecha: "mañana", preferencia_momento: "primera_hora" }
  expected_response_behavior: Disponibilidad de mañana mañana
  escalation_required: false
```
