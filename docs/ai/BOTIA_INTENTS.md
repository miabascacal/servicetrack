# BotIA — Intents

> Catálogo de intenciones del asistente Ara.
> **Última actualización:** 2026-04-28 — P0.3

Formato por intent:
- **Descripción**: qué quiere el cliente
- **Ejemplos**: frases reales
- **Entidades esperadas**: qué datos extraer
- **Acción permitida**: qué puede hacer el bot
- **Cuándo escalar**: condición de escalación
- **Respuesta base**: texto guía

---

## AGENDAMIENTO

### `agendar_cita`
**Prioridad:** Alta

**Descripción:** El cliente quiere crear una nueva cita de servicio.

**Ejemplos:**
- "quiero una cita"
- "necesito cita"
- "quiero llevar mi coche"
- "tienes espacio hoy"
- "me puedes agendar"
- "quiero servicio para mi carro"
- "¿están atendiendo?"

**Entidades esperadas:** servicio, fecha, hora, vehiculo

**Acción permitida:** Iniciar flujo A→B→C (nombre→vehículo→servicio→fecha→hora→confirmación)

**Cuándo escalar:** Datos contradictorios no resolvibles / cliente molesto persistente

**Respuesta base:** `"Con gusto te ayudo a agendar tu cita. [pregunta el nombre si DEMO, o el vehículo si no resuelto]"`

---

### `confirmar_asistencia`
**Prioridad:** Alta

**Descripción:** Cliente confirma asistencia a una cita existente.

**Ejemplos:**
- "sí confirmo"
- "ahí estaré"
- "sí, nos vemos"
- "confirmado"

**Entidades esperadas:** cita_id (de consulta previa)

**Acción permitida:** `confirmarCitaBot()` → estado → confirmada

**Cuándo escalar:** No hay cita activa que confirmar / cita_id no identificado

**Respuesta base:** `"Perfecto, tu cita para [fecha] a las [hora] quedó confirmada. ¡Hasta pronto!"`

---

### `cancelar_cita`
**Prioridad:** Alta

**Descripción:** Cliente quiere cancelar una cita.

**Ejemplos:**
- "no voy a poder ir"
- "cancela mi cita"
- "no puedo ese día"
- "necesito cancelar"

**Entidades esperadas:** cita_id

**Acción permitida:** `cancelarCitaBot()` → estado → cancelada; preguntar si reagenda

**Cuándo escalar:** Error técnico al cancelar

**Respuesta base:** `"Entendido, tu cita del [fecha] ha sido cancelada. ¿Te gustaría reagendar para otra fecha?"`

---

### `reagendar_cita`
**Prioridad:** Media

**Descripción:** Cliente quiere cambiar la fecha/hora de una cita existente.

**Ejemplos:**
- "cámbiame la cita"
- "¿puedo moverla para el martes?"
- "quiero otra fecha"
- "no puedo ese día, ¿hay otro?"

**Entidades esperadas:** cita_id, nueva_fecha, nueva_hora

**Acción permitida:** Cancelar cita anterior + crear nueva (flujo completo); confirmar resumen antes

**Cuándo escalar:** Cita no encontrada / datos inconsistentes

**Respuesta base:** `"Claro, vamos a reagendar. ¿Qué fecha y hora te convienen?"`

---

### `consulta_cita_propia`
**Prioridad:** Alta

**Descripción:** Cliente pregunta por su cita agendada.

**Ejemplos:**
- "¿qué cita tengo?"
- "¿cuándo es mi cita?"
- "¿tengo cita con ustedes?"
- "¿a qué hora es mi cita?"

**Entidades esperadas:** (ninguna — lookup por cliente)

**Acción permitida:** `consultarCitasCliente()` → resumir

**Cuándo escalar:** Ninguna cita encontrada → ofrecer agendar nueva

**Respuesta base:** `"Tienes una cita el [fecha] a las [hora] para [servicio]. ¿Confirmas asistencia?"`

---

### `consultar_disponibilidad`
**Prioridad:** Media

**Descripción:** Cliente pregunta qué horarios hay disponibles.

**Ejemplos:**
- "¿qué horarios tienen?"
- "¿a qué horas atienden?"
- "¿tienen mañana en la mañana?"

**Entidades esperadas:** fecha

**Acción permitida:** `buscarDisponibilidad()` → presentar horarios

**Cuándo escalar:** No hay slots y cliente rechaza fechas alternativas

**Respuesta base:** `"Para [fecha] tengo disponibles: [horarios]. ¿Cuál te queda mejor?"`

---

### `hora_ocupada`
**Prioridad:** Alta

**Descripción:** El slot elegido está ocupado.

**Ejemplos:** (intent generado internamente al detectar conflicto)

**Entidades esperadas:** hora_solicitada, slots_disponibles

**Acción permitida:** Ofrecer alternativas — NO escalar si hay disponibilidad

**Respuesta base:** `"Ese horario ya está ocupado, pero tengo disponibles: [horarios]. ¿Cuál prefieres?"`

---

## CLIENTE / CRM

### `proporcionar_nombre`
**Prioridad:** Alta (Step A del flujo)

**Ejemplos:**
- "me llamo Carlos Mendoza"
- "soy Ana López"
- "Carlos Rivas"
- "les habla Martín Pérez"

**Entidades esperadas:** nombre, apellido

**Acción permitida:** `actualizarNombreClienteBot()` → CRM update

**Cuándo escalar:** Error al actualizar CRM

---

### `cliente_corrige_dato`
**Prioridad:** Alta

**Descripción:** El cliente dice que ya dio el dato y corrige información errónea.

**Ejemplos:**
- "ya te dije que es el Honda"
- "no, el modelo es City no Civic"
- "ya lo puse, dije el martes"

**Acción permitida:** Revisar metadata → pedir solo dato faltante → NO repetir preguntas ya respondidas

---

### `cliente_no_sabe`
**Prioridad:** Media

**Descripción:** El cliente no sabe un dato específico.

**Ejemplos:**
- "no sé el número de serie"
- "no tengo la placa aquí"
- "no recuerdo el año exacto"

**Acción permitida:** Para placa/VIN → aceptar "no sé" + continuar (placa es preferente pero no bloquea). Para datos obligatorios → buscar alternativa.

---

## VEHÍCULO

### `proporcionar_vehiculo`
**Prioridad:** Alta (Step B del flujo)

**Ejemplos:**
- "Honda City 2022 placa ABC123"
- "es un Nissan Sentra azul del 2020"
- "mi camioneta Toyota Hilux"

**Entidades esperadas:** marca, modelo, anio, placa (opcional)

**Acción permitida:** `crearVehiculoYVincularBot()` o seleccionar existente

**Cuándo escalar:** Error en creación y no hay datos mínimos

---

### `no_tengo_placa`
**Descripción:** Cliente no tiene la placa a la mano.

**Acción permitida:** Continuar sin placa. Dejar campo null. Documentar en notas de cita.

---

### `enviar_tarjeta_circulacion`
**Descripción:** Cliente ofrece o envía foto de tarjeta de circulación.

**Acción permitida:** Guardar en outbound_queue para revisión manual. **OCR no disponible aún.**

**Respuesta base:** `"Gracias. Un asesor revisará los datos del documento y los registrará. Mientras tanto, ¿me confirmas la marca y modelo del vehículo?"`

---

## SERVICIO

### Intents de servicio específico

| Intent | Ejemplos | Servicio normalizado |
|--------|----------|---------------------|
| `cambio_aceite` | "cambio de aceite", "oil change", "aceite" | Cambio de aceite |
| `mantenimiento` | "mantenimiento", "servicio de X mil", "me toca servicio" | Mantenimiento / Servicio Nk km |
| `diagnostico_testigo` | "check engine", "testigo encendido", "luz prendida" | Diagnóstico — testigo encendido |
| `frenos` | "frenos", "balatas", "no frena bien", "pastillas" | Revisión de frenos |
| `ruido` | "hace ruido", "escucho un ruido", "traquetea" | Diagnóstico — ruido |
| `revision_general` | "revisión", "checkup", "check up", "revisión general" | Revisión general |
| `garantia` | "garantía", "está en garantía" | Garantía |
| `preguntar_costo` | "¿cuánto cuesta?", "¿cuánto cobran?" | ⚠️ Escalar — precio no configurado en bot |

---

## SUCURSAL

### `consultar_ubicacion` / `como_llegar`
**Ejemplos:** "¿dónde quedan?", "¿cómo llego?", "¿cuál es la dirección?"

**Acción permitida:** Responder con `info_sucursal.direccion` de BD. Si no hay dirección configurada → `"No tengo la dirección disponible. Contáctanos al [teléfono]."`

### `consultar_horario`
**Ejemplos:** "¿a qué hora abren?", "¿cuándo atienden?", "¿trabajan los sábados?"

**Acción permitida:** Responder con `configuracion_citas_sucursal.horario_inicio / horario_fin / dias_disponibles`

### `consultar_requisitos`
**Ejemplos:** "¿qué debo traer?", "¿qué necesito?", "¿necesito factura?"

**Acción permitida:** Responder con requisitos estándar (tarjeta de circulación, identificación, llaves).

---

## ESCALACIÓN / ESTADO EMOCIONAL

### `hablar_asesor`
**Ejemplos:** "pásame con alguien", "quiero hablar con una persona", "atiéndeme tú"

**Acción:** Escalar inmediatamente.

### `cliente_molesto` / `cliente_frustrado`
**Ejemplos:** "ya estoy harto", "no me entienden", "qué mal servicio"

**Acción:** No repetir preguntas. Disculparse. Retomar estado. Si persiste → escalar.

### `insulto_o_agresion`
**Ejemplos:** cualquier frase con lenguaje agresivo/grosero

**Acción:** NO repetir la grosería. NO responder agresivo. Responder:
`"Entiendo tu molestia. Voy a retomar la información y ayudarte a resolverlo."` Si persiste → escalar.

---

## MÓDULOS FUTUROS

| Intent | Módulo | Estado |
|--------|--------|--------|
| `taller_estado_ot` | Taller | ⬜ Pendiente |
| `vehiculo_listo` | Taller | ✅ WA saliente (sin consulta entrante aún) |
| `encuesta_csi` | CSI | ⬜ Pendiente |
| `queja_cliente` | Atención | ⬜ Pendiente |
| `refacciones_pieza` | Refacciones | ⬜ Pendiente |
| `venta_cotizacion` | Ventas | ⬜ Pendiente |
