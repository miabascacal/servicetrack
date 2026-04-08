# N8N_WORKFLOWS.md
# Automatizaciones n8n — Plataforma SaaS Postventa Automotriz
# Configurar en n8n antes de activar el producto con el piloto.

---

## CONFIGURACIÓN GLOBAL n8n

### Variables de entorno en n8n
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
WA_API_URL=https://api.twilio.com/...   (o proveedor elegido)
WA_API_TOKEN=
WA_FROM_NUMBER=+52...
MICROSOFT_GRAPH_TOKEN_URL=https://login.microsoftonline.com/.../oauth2/v2.0/token
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_MAPS_BASE_URL=https://maps.google.com/?q=
APP_BASE_URL=https://tuapp.vercel.app
```

### Credenciales a crear en n8n
- **Supabase**: HTTP Request con header `apikey` y `Authorization: Bearer`
- **WhatsApp**: HTTP Request con auth del proveedor elegido
- **Microsoft Graph**: OAuth2 para Outlook Calendar sync
- **Claude API**: HTTP Request con `x-api-key` header

---

## WORKFLOW 001 — Timer 15 min CITAS
**Trigger**: Cron cada 1 minuto  
**Propósito**: Si la encargada no contactó al cliente en 15 min, el bot actúa por ella

```
[Cron: cada 1 min]
    ↓
[HTTP: GET Supabase]
  Query: SELECT c.*, cl.nombre, cl.whatsapp, s.maps_url, s.nombre as sucursal_nombre,
                s.horario_bot_inicio, s.horario_bot_fin
         FROM citas c
         JOIN clientes cl ON cl.id = c.cliente_id
         JOIN sucursales s ON s.id = c.sucursal_id
         WHERE c.estado = 'pendiente_contactar'
           AND c.contacto_limite_at < NOW()
           AND c.contacto_bot = false
    ↓
[IF: ¿Hay citas vencidas?]
  No → Stop
  Sí → continuar
    ↓
[Split In Batches: una cita a la vez]
    ↓
[IF: ¿Está dentro del horario del bot?]
  Fuera de horario → [Supabase: INSERT notificaciones_encoladas]
  Dentro de horario → continuar
    ↓
[HTTP: POST WhatsApp API]
  Mensaje: "Hola {nombre}, te confirmamos tu cita en {sucursal_nombre} 
  el {fecha_cita formateada} a las {hora_cita}. ¡Te esperamos! 
  📍 Cómo llegar: {maps_url}"
    ↓
[HTTP: PATCH Supabase — actualizar cita]
  contacto_bot = true
  contacto_realizado_at = NOW()
  estado = 'contactada'
    ↓
[HTTP: POST Supabase — crear actividad]
  tipo = 'wa_enviado'
  titulo = 'Contacto de confirmación — Bot actuó por encargada'
  estado = 'realizada'
  modulo_origen = 'citas'
  cliente_id = {cliente_id}
  cita_id = {cita_id}
  wa_enviado = true
  creada_por_id = null (sistema)
```

---

## WORKFLOW 002 — Recordatorio 24h antes de cita
**Trigger**: Cron diario a las 8:30 AM  
**Propósito**: Recordatorio automático con mapa 24h antes de cada cita

```
[Cron: 8:30 AM diario]
    ↓
[HTTP: GET Supabase]
  Query: citas confirmadas o contactadas para MAÑANA
         donde recordatorio_24h_enviado_at IS NULL
    ↓
[Split: una cita a la vez]
    ↓
[HTTP: POST WhatsApp]
  Mensaje: "Hola {nombre}, te recordamos que mañana tienes cita 
  en {sucursal} a las {hora} para {tipo_servicio}. 
  ¿Confirmas tu asistencia? Responde SÍ o NO 🙏
  📍 Ubicación: {maps_url}"
    ↓
[HTTP: PATCH Supabase]
  recordatorio_24h_enviado_at = NOW()
```

---

## WORKFLOW 003 — Recordatorio 2h antes de cita
**Trigger**: Cron cada hora  
**Propósito**: Recordatorio urgente 2h antes

```
[Cron: cada hora]
    ↓
[HTTP: GET Supabase]
  Query: citas sin recordatorio_2h_enviado_at
         donde fecha_cita BETWEEN NOW() AND NOW() + 2h
    ↓
[HTTP: POST WhatsApp]
  Mensaje: "¡Hola {nombre}! En 2 horas tienes tu cita en {sucursal} 
  a las {hora}. ¡Te esperamos! 📍 {maps_url}"
    ↓
[HTTP: PATCH Supabase]
  recordatorio_2h_enviado_at = NOW()
```

---

## WORKFLOW 004 — Webhook respuesta cliente a WA
**Trigger**: Webhook POST — recibe respuestas de clientes al WA  
**Propósito**: Procesar SÍ/NO de confirmaciones y botones interactivos

```
[Webhook: POST /webhook/whatsapp-respuesta]
    ↓
[Switch: tipo de mensaje]
  
  CASO A — Respuesta a recordatorio de cita (SÍ):
    → PATCH cita: confirmacion_cliente=true, confirmacion_at=NOW(), estado='confirmada'
    → POST WhatsApp: "¡Perfecto! Tu cita está confirmada. ¡Hasta mañana!"
  
  CASO B — Respuesta a recordatorio (NO):
    → PATCH cita: confirmacion_cliente=false
    → POST WhatsApp: "Entendemos. ¿Quieres reagendar? Dinos qué fecha te viene mejor."
    → Crear actividad para encargada: "Cliente canceló — ofrecer reagendar"
  
  CASO C — Botón "Sí, quiero agendar" (pieza llegó):
    → Buscar pieza_ot_id en contexto del mensaje
    → PATCH piezas_ot: cliente_respondio_agendar=true, cliente_respondio_at=NOW()
    → POST WhatsApp: "Perfecto {nombre}, en breve un asesor de citas se 
       pondrá en contacto contigo para confirmar fecha y hora. ¡Gracias!"
    → Obtener datos: cliente, vehículo, pieza
    → POST Supabase — crear actividad para encargada de citas:
        tipo = 'tarea'
        titulo = 'Agendar instalación de pieza — cliente confirmó interés'
        descripcion = 'Cliente: {nombre} | Vehículo: {vehiculo} | Pieza: {descripcion_pieza} | WA: {whatsapp}'
        prioridad = 'alta'
        estado = 'pendiente'
        usuario_asignado_id = {id_encargada_citas}
        cliente_id = {cliente_id}
        vehiculo_id = {vehiculo_id}
        pieza_ot_id = {pieza_ot_id}
        modulo_origen = 'taller'
    → POST WhatsApp a encargada: 
        "⚡ Actividad urgente: {nombre} quiere agendar instalación de 
        {descripcion_pieza}. WA: {whatsapp}. Ya confirmó interés."
    → POST Email a encargada con los mismos datos
    → CALL Workflow 008 (Outlook sync) con la actividad creada
  
  CASO D — Botón "Agendar servicio" (venta perdida):
    → POST WhatsApp al cliente: "Perfecto, en breve te contactamos."
    → Crear actividad urgente para encargada de citas
    → Notificar a encargada (WA + email + Outlook)
  
  CASO E — Respuesta de texto libre:
    → Claude API: clasificar intención del mensaje
    → Rutear según clasificación al asesor correspondiente
    → Registrar en mensajes (bandeja unificada)
```

---

## WORKFLOW 005 — Escalación automática OTs
**Trigger**: Cron cada 30 minutos  
**Propósito**: Niveles de escalación si el asesor no actualiza la OT

```
[Cron: cada 30 min]
    ↓
[HTTP: GET Supabase]
  Query: OTs activas (estado NOT IN ('entregado','cancelado'))
         con ultima_actualizacion_at < NOW() - 4h
         agrupadas por horas sin actualizar
    ↓
[Switch: horas_sin_actualizar]

  NIVEL 1 (4-6h) — nivel_escalacion = 0:
    → POST WhatsApp al asesor:
        "⚠️ La unidad de {cliente_nombre} ({vehiculo}) lleva 
        {horas}h sin actualización. OT #{numero_ot}"
    → PATCH ot: nivel_escalacion = 1
  
  NIVEL 2 (6-7h) — nivel_escalacion = 1:
    → POST WhatsApp al gerente:
        "🔴 Alerta: La OT #{numero_ot} de {cliente_nombre} lleva 
        {horas}h sin actualizar. Asesor: {asesor_nombre}"
    → PATCH ot: nivel_escalacion = 2
  
  NIVEL 3 (7h+) — nivel_escalacion = 2:
    → POST WhatsApp al cliente:
        "Hola {nombre}, tu vehículo sigue en proceso de servicio. 
        Estado actual: {ultimo_estado_conocido}. 
        Te contactamos pronto con más información."
    → Crear actividad: "Bot actuó — OT sin actualizar 7h+"
    → PATCH ot: nivel_escalacion = 3
```

---

## WORKFLOW 006 — CSI Post-servicio 48h
**Trigger**: Cron diario a las 10:00 AM  
**Propósito**: Enviar encuesta CSI y actuar según resultado

```
[Cron: 10:00 AM diario]
    ↓
[HTTP: GET Supabase]
  Query: OTs en estado='entregado' 
         donde fecha_entrega BETWEEN NOW()-49h AND NOW()-47h
         y csi_enviado_at IS NULL
    ↓
[Split: una OT a la vez]
    ↓
[Switch: condicion_csi del archivo recibido]

  CASO — feliz (o sin evaluar, usar calificación si existe):
    → POST WhatsApp al cliente:
        "Hola {nombre}, fue un placer atenderte en {sucursal}. 
        ¿Nos dejarías una reseña de tu experiencia? 
        Solo toma 1 minuto 🙏 {link_google_reviews}"
    → PATCH ot: csi_enviado_at=NOW(), resena_google_solicitada=true
  
  CASO — no_feliz (o calificación <= 6):
    → POST Supabase — crear actividad urgente para MK:
        tipo = 'llamada'
        titulo = 'CSI bajo — Llamar al cliente HOY'
        descripcion = 'Cliente: {nombre} | OT: {numero_ot} | 
                       Asesor: {asesor_nombre} | Calificación: {csi_calificacion}'
        prioridad = 'urgente'
        estado = 'pendiente'
        usuario_asignado_id = {id_agente_mk}
        cliente_id = {cliente_id}
        vehiculo_id = {vehiculo_id}
        ot_id = {ot_id}
        modulo_origen = 'taller'
    → POST WhatsApp al agente MK:
        "🔴 CSI bajo: {nombre} tuvo una mala experiencia en OT #{numero_ot}. 
        Llámale hoy. WA: {whatsapp}"
    → POST Email al agente MK con todos los datos
    → CALL Workflow 008 (Outlook sync) con la actividad
    → PATCH ot: csi_enviado_at=NOW()
```

---

## WORKFLOW 007 — Seguimiento de cotizaciones
**Trigger**: Cron diario a las 9:00 AM  
**Propósito**: Seguimiento automático de cotizaciones sin respuesta

```
[Cron: 9:00 AM diario]
    ↓
[HTTP: GET Supabase]
  Query: cotizaciones en estado='enviada'
         agrupadas por días desde enviada_at
    ↓
[Switch: días transcurridos]

  1 día sin respuesta (seguimiento_24h_at IS NULL):
    → POST WhatsApp al cliente:
        "Hola {nombre}, ayer te enviamos una cotización para {descripcion}. 
        ¿Pudiste revisarla? Estamos para cualquier duda."
    → PATCH cotizacion: seguimiento_24h_at=NOW()
  
  2 días sin respuesta:
    → POST WhatsApp al cliente (mensaje diferente)
    → PATCH cotizacion: seguimiento_48h_at=NOW()
  
  3 días sin respuesta:
    → Crear actividad para el asesor:
        tipo = 'llamada'
        titulo = 'Llamar — cotización sin respuesta 72h'
        descripcion = '{descripcion_piezas} | ${total} MXN'
        prioridad = 'alta'
    → POST WhatsApp al asesor: "Llamar a {cliente} — cotización sin respuesta 3 días"
    → CALL Workflow 008 (Outlook sync)
    → PATCH cotizacion: seguimiento_72h_at=NOW()
```

---

## WORKFLOW 008 — Outlook Calendar Sync
**Trigger**: Webhook POST desde Supabase (database webhook en tabla actividades)  
**Propósito**: Crear/actualizar/cancelar eventos en Outlook del usuario asignado

```
[Webhook: POST /webhook/actividad-sync]
  Payload: {actividad_id, usuario_asignado_id, accion: 'created'|'updated'|'deleted'}
    ↓
[HTTP: GET Supabase — obtener actividad completa + usuario con outlook_refresh_token]
    ↓
[IF: usuario tiene outlook_refresh_token?]
  No → Stop (usuario no conectó Outlook)
  Sí → continuar
    ↓
[HTTP: POST Microsoft Graph — refresh access token]
  URL: {MICROSOFT_GRAPH_TOKEN_URL}
  Body: grant_type=refresh_token, refresh_token={outlook_refresh_token}, ...
    ↓
[Switch: accion]

  'created':
    → POST https://graph.microsoft.com/v1.0/me/events
      Body: {
        subject: "{titulo}",
        body: { contentType: "HTML", content: "{descripcion}<br>{nombre_cliente}<br>{whatsapp}" },
        start: { dateTime: "{fecha_programada}", timeZone: "America/Mexico_City" },
        end: { dateTime: "{fecha_programada + 30min}", timeZone: "America/Mexico_City" },
        reminderMinutesBeforeStart: 30
      }
    → PATCH Supabase actividades: outlook_event_id={nuevo_event_id}, outlook_synced_at=NOW()
  
  'updated':
    → PATCH https://graph.microsoft.com/v1.0/me/events/{outlook_event_id}
      (mismos campos actualizados)
  
  'deleted':
    → DELETE https://graph.microsoft.com/v1.0/me/events/{outlook_event_id}
    → PATCH Supabase: outlook_event_id=null
```

---

## WORKFLOW 009 — Cola de mensajes fuera de horario
**Trigger**: Cron diario a las 8:05 AM  
**Propósito**: Enviar los mensajes que se generaron fuera del horario del bot

```
[Cron: 8:05 AM diario]
    ↓
[HTTP: GET Supabase]
  Query: notificaciones_encoladas 
         donde estado='encolada' 
         y enviar_at <= NOW()
    ↓
[Split: una notificación a la vez]
    ↓
[Switch: tipo]
  'wa' → POST WhatsApp API
  'email' → POST Email API
    ↓
[PATCH Supabase notificaciones_encoladas]
  estado = 'enviada'
  enviada_at = NOW()
```

---

## WORKFLOW 010 — Venta perdida: recuperación automática
**Trigger**: Webhook desde Supabase cuando se crea un registro en ventas_perdidas  
O bien: Cron cuando se procesa el archivo de ventas perdidas  
**Propósito**: Contactar al cliente que rechazó una reparación adicional

```
[Trigger: nueva venta_perdida o procesamiento de archivo]
    ↓
[Calcular días desde fecha_rechazo]
    ↓
[IF: dentro del horario del bot?]
  No → encolar para las 8am
  Sí → continuar
    ↓
[Claude API — generar mensaje personalizado]
  Prompt: "Genera un WA empático para recordarle a {nombre} que su 
  {vehiculo} necesitaba {descripcion_reparacion}. 
  Han pasado {dias} días desde que lo pospuso. 
  Tono: amable, no presionante. Máximo 3 líneas. 
  Incluir botón de respuesta: 'Agendar servicio'"
    ↓
[POST WhatsApp con botón interactivo]
    ↓
[PATCH ventas_perdidas: estado='contacto_enviado', contacto_wa_enviado_at=NOW()]
    ↓
[Esperar respuesta → manejada por Workflow 004, Caso D]
```

---

## WORKFLOW 011 — Importación de archivos
**Trigger**: Webhook POST cuando se sube un archivo desde el frontend  
**Propósito**: Procesar CSV/Excel y actualizar el CRM

```
[Webhook: POST /webhook/importar-archivo]
  Payload: {archivo_url, tipo, sucursal_id, usuario_id}
    ↓
[HTTP: GET archivo desde Storage]
    ↓
[Código: parsear CSV o Excel]
  - Detectar columnas automáticamente
  - Mapear a campos del CRM según tipo (citas|ot|csi|venta_perdida|clientes)
    ↓
[Loop: por cada registro]
  → Verificar duplicado por whatsapp + sucursal_id
  → Si existe: UPDATE
  → Si no existe: INSERT
  → Si error: registrar en errores[]
    ↓
[PATCH Supabase archivos_importados]
  estado = 'completado'
  total_registros, registros_creados, registros_actualizados, registros_con_error
  errores = {json con detalles}
    ↓
[POST WebSocket / Supabase Realtime]
  Notificar al frontend que el proceso terminó
```

---

## NOTAS DE IMPLEMENTACIÓN

### Horario del bot — función helper n8n
```javascript
// Usar en todos los workflows antes de enviar WA
function dentroDelHorario(horaInicio, horaFin, timezone) {
  const ahora = new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  return ahora >= horaInicio && ahora <= horaFin;
}
// horaInicio = '08:00', horaFin = '19:30' (configurable por sucursal)
```

### Mensajes WA — reglas de formato
- Siempre usar el nombre del cliente (nunca "estimado cliente")
- Incluir el nombre del vehículo cuando aplique
- Máximo 3 párrafos cortos
- Emojis: máximo 2 por mensaje, solo donde aporten claridad
- Link de Maps siempre en la última línea de mensajes de citas

### Orden de configuración recomendado
1. Workflow 008 (Outlook sync) — base para todo
2. Workflow 001 (Timer 15 min) — el más crítico del MVP
3. Workflow 004 (Respuesta cliente) — receptor central
4. Workflow 011 (Importación archivos) — para alimentar el CRM
5. Workflow 002 y 003 (Recordatorios)
6. Workflow 005 (Escalación OTs)
7. Workflow 006 (CSI)
8. Workflow 007 (Cotizaciones)
9. Workflow 009 (Cola mensajes)
10. Workflow 010 (Venta perdida)
