# PRODUCT_MASTER.md
# Plataforma SaaS de Gestión de Servicio Postventa Automotriz
# Versión 1.4 — Marzo 2026

---

## 1. VISIÓN DEL PRODUCTO

Software SaaS vertical para concesionarios y grupos automotrices en México y LATAM.
Gestiona el ciclo completo de postventa: citas, taller, refacciones, ventas y comunicación con el cliente — con automatización por WhatsApp, IA transversal y sincronización con Outlook y Gmail.

**Diferenciadores clave vs competencia:**
- Lee archivos de Salesforce, Seekop, ClearMechanic, Autoline y Google Drive — sin integración técnica compleja
- Flujo "encargada tiene 15 min o el bot actúa" — único en el mercado
- WA con mapa de Google Maps integrado en el mensaje de confirmación de cita
- **Recepción Express** — check-in digital vía WA/QR, asesor espera al cliente en puerta, sin kiosco ni hardware
- Escalación automática en 3 niveles si el asesor no actualiza la OT
- Venta perdida con recuperación automática vinculada a CITAS
- Actividades 100% vinculadas a usuario + cliente + vehículo + empresa + Outlook
- **Atención a Clientes** — módulo independiente, cualquier área levanta quejas, flujo completo con encargado AC → gerente → cliente → validación → cierre
- Diseñado para México: WhatsApp-first, DMS mexicanos, horario laboral configurable

---

## 2. ARQUITECTURA DE MÓDULOS

Cada módulo incluye su propio sub-módulo de **📊 Reportes** (dashboard + constructor + exportación).

```
┌──────────────────────────────────────────────┐
│              MÓDULO CITAS                     │  SF · Seekop · ClearMechanic · Drive
│  Kanban · Contacto · Recordatorios           │  6 flujos (incl. Recepción Express)
│  📊 Reportes: no-shows, tiempos, fuentes     │
└──────────────┬───────────────────────────────┘
               │ Vehículo ingresa
               ▼
┌──────────────────────────────────────────────┐     ┌─────────────────────────────────┐
│           MÓDULO TALLER (PDV)                 │────▶│     MÓDULO REFACCIONES          │
│  OT · Seguimiento · Piezas · CSI             │     │  Partes · PDF · Cotiz.          │
│  7 flujos (incl. Venta Perdida)              │     │  3 flujos                       │
│  📊 Reportes: OTs, CSI, ventas perdidas      │     │  📊 Reportes: cotiz., piezas    │
└──────────────┬───────────────────────────────┘     └─────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│                    CRM (CORAZÓN)                              │
│  Clientes · Empresas · Vehículos · Historial                 │
│  Agenda · Actividades · Outlook/Gmail Sync                   │
│  5 flujos                                                    │
│  📊 Reportes: actividades, quejas, retención, Driver 360     │
└──────────────────────────┬───────────────────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐  ┌────────────────────────────────┐
│   MÓDULO VENTAS              │  │     BANDEJA + IA               │
│  Pipeline · Leads            │  │  WA · FB · IG · Email          │
│  4 flujos                    │  │  5 flujos                      │
│  📊 Reportes: pipeline, conv.│  │  📊 Reportes: canales, tiempos │
└──────────────────────────────┘  └────────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────────────┐
│   ⭐ CSI                     │  │   🛡️ SEGUROS                         │
│  Encuestas · NPS · Score     │  │  Pólizas · Vigencias · Alertas       │
│  4 flujos                    │  │  2 flujos                            │
│  📊 Reportes: NPS, tendencias│  │  📊 Reportes: vencimientos           │
│  Score bajo → Queja auto ↗   │  │                                      │
└──────────────────────────────┘  └──────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│   MÓDULO ATENCIÓN A CLIENTES  (botón flotante en TODOS los   │
│   módulos — cualquier usuario puede levantar una queja)      │
│  Quejas · Seguimientos · Flujo AC→Gerente→Cliente→Cierre     │
│  📊 Reportes: quejas por área, tiempos resolución, SLA       │
└──────────────────────────────────────────────────────────────┘
```

### Sistema de Reportes — arquitectura transversal

- **Componente único** `<ReportBuilder />` construido en Sprint 2, reutilizado en todos los módulos
- **Tabla `reportes_guardados`** almacena la configuración de cada reporte como JSONB
- **Visibilidad configurable**: privado / compartir con sucursal / compartir con grupo
- **Permisos por rol**: cada rol solo ve los campos y módulos que le corresponden
- **Exportación**: Excel (.xlsx) y PDF desde cualquier reporte
- **Sin sprint dedicado**: cada módulo incluye su sub-módulo de reportes en su mismo sprint

---

## 3. MÓDULO CRM — Corazón del sistema

El CRM es el **hub central** de la plataforma. Todos los módulos (Citas, Taller, Refacciones, Ventas, Bandeja+IA, Seguros, Atención a Clientes) se conectan al CRM para obtener y registrar información de cliente, empresa y vehículo. No se puede operar ningún módulo sin un registro de cliente y vehículo en el CRM.

### 3.1 Entidades principales y reglas de negocio

**Clientes**
- Persona física o moral, con todos sus datos de contacto y preferencias
- Nivel: Grupo → un cliente es único a nivel Grupo, sin duplicados entre sucursales

**Empresas**
- Para flotillas y negocios. Un cliente puede pertenecer a una empresa
- **Regla**: toda empresa debe tener mínimo 1 cliente vinculado (el contacto principal)
- **Regla**: máximo 10 clientes vinculados por empresa (por ahora)

**Vehículos**
- Vinculados al cliente, con historial completo de servicios
- **Regla**: todo vehículo debe tener siempre al menos 1 cliente con rol **Dueño**
- Un vehículo puede tener hasta 3 tipos de personas vinculadas:
  - **Dueño** — propietario del vehículo (obligatorio, mínimo 1)
  - **Conductor** — quien maneja el vehículo cotidianamente (opcional)
  - **Otro** — contacto adicional (asistente, familiar, etc.) (opcional)
- Al crear un vehículo, el cliente que lo registra se asigna automáticamente como Dueño
- No se puede eliminar al último Dueño de un vehículo
- **Verificación vehicular**: fecha de verificación, próxima verificación y estado (vigente / por vencer / vencida / no aplica)
- **Extensión de garantía**: fecha inicio y fecha fin de la garantía extendida (independiente de la garantía de fábrica)

**Actividades**
- Toda interacción queda registrada y vinculada al cliente, vehículo, empresa y usuario asignado

### 3.2 Flujos CRM

**F01 — Perfil único del cliente y vehículo (Driver 360)**
- Registro llega por cualquier vía: archivo, DMS, captura manual o desde otro módulo
- CRM crea un registro único. Si VIN o WA ya existe → actualiza, no duplica
- Historial del vehículo crece con cada visita: km, servicio, piezas, garantías, asesor
- Resultado: cualquier asesor ve el historial completo al abrir una nueva atención

**F02 — Agenda interna + actividades + Calendar sync (Outlook y Gmail)**
- Se crea una actividad y se asigna al usuario correspondiente
- Tipos: Llamada · Contacto · Seguimiento · Recordatorio · Tarea · Reunión
- Bot WA al usuario asignado: "Tienes una actividad pendiente: [descripción] — [hora]"
- Actividad visible en agenda personal del usuario en CRM
- Sync automático con el calendario preferido del usuario: **Outlook Calendar** o **Google Calendar (Gmail)** — configurable por usuario (outlook / google / ambos / ninguno)
- Bidireccional: eventos creados en CRM aparecen en el calendario, cambios externos se reflejan en CRM
- Usuario marca como completada → historial del cliente actualizado
- **Aplica para TODOS los usuarios**: citas, asesores, MK, gerencia, ventas

**F03 — Lectura y procesamiento de archivos externos**
- Soporta: CSV, Excel, exportaciones de SF/Seekop/ClearMechanic/Autoline/Drive
- Valida: campos obligatorios, duplicados, formato WA, lada, VIN
- Crea si no existe, actualiza si ya existe — sin duplicados
- Datos disponibles en todos los módulos al instante

**F04 — Modelo de actividades vinculadas (arquitectura transversal)**
Toda actividad en CRM se vincula a:
1. Usuario asignado → agenda CRM + Outlook/Gmail sync + WA recordatorio
2. Cliente → historial en su expediente
3. Vehículo → si aplica, trazado en historial del vehículo
4. Empresa → si es flotilla, aparece en expediente de la empresa
5. Vista resumen "Actividades del cliente" → cronológica, filtrable, exportable

**F06 — CRM como hub central**
Todos los módulos consumen y escriben en el CRM para información de cliente, empresa y vehículo:
- **Citas** → usa datos del CRM para confirmaciones, crea/actualiza perfil de cliente al agendar
- **Taller** → lee vehículo y propietario del CRM, escribe historial de OT y km
- **Refacciones** → lee cliente y vehículo del CRM para cotizaciones
- **Ventas** → usa leads y empresas del CRM, escribe resultado de oportunidades
- **Bandeja+IA** → enriquece contactos del CRM desde WA/FB/IG/email
- **Seguros** → lee vehículo y Dueño del CRM para pólizas
- **Atención a Clientes** → accede al expediente del cliente desde cualquier módulo
- Resultado: vista unificada Driver 360 — historial completo en un solo expediente

### 3.3 📊 Sub-módulo Reportes CRM

**Dashboard fijo (KPIs):**
- Clientes nuevos por período
- Actividades completadas vs pendientes por asesor
- Quejas abiertas / resueltas / tiempo promedio de resolución
- Vehículos próximos a mantenimiento (por km y fecha)
- Retención de clientes (volvieron vs no volvieron)
- Top clientes por número de visitas / gasto histórico

**Campos disponibles en el constructor:**
- Cliente: nombre, tipo, canal preferido, fecha registro, asesor asignado
- Vehículo: marca, modelo, año, km actuales, fecha última visita
- Empresa: nombre, RFC, contacto
- Actividad: tipo, estado, usuario, fecha, duración, módulo origen
- Queja: tipo, estado, tiempo de resolución, compensación, satisfacción final

**Acceso por rol:** admin y gerente ven todos los asesores · asesor_servicio solo sus propios registros

**F05 — Acceso rápido a Atención a Clientes**

Desde cualquier pantalla del CRM (y de cualquier módulo) existe un botón fijo **"Atención a Clientes"** que lleva directamente al módulo para levantar una queja. Ver Sección 11 — Módulo Atención a Clientes para el flujo completo.

---

## 4. MÓDULO CITAS

### 4.1 Fuentes de datos
- Salesforce (SF) — exportación CSV/Excel
- Seekop — exportación directa
- ClearMechanic — exportación directa
- Google Drive — archivo manual compartido
- El sistema lee CUALQUIER formato estándar sin integración técnica compleja

### 4.2 Vista Kanban — 6 columnas
1. **Pendiente de contactar** — con timer de 15 min visible
2. **Contactada** — encargada actuó antes de los 15 min
3. **Confirmada** — cliente confirmó por WA o llamada
4. **En agencia** *(Recepción Express)* — cliente hizo check-in, asesor pendiente de salir — timer de espera visible
5. **Show / Llegó** — asesor recibió al cliente, inspección completa, OT abierta
6. **No-show** — cliente no llegó, bot activa recuperación

### 4.3 Flujos CITAS

**F01 — Lectura del archivo de citas agendadas**
- Archivo llega del Drive/SF/Seekop/ClearMechanic
- Sistema extrae: nombre cliente, WA con lada, fecha/hora, servicio, sucursal, dirección
- CRM crea o actualiza registro del cliente y vehículo
- Cita aparece en agenda CRM de la encargada como "Contacto pendiente"
- Evento creado en Outlook de la encargada automáticamente

**F02 — Contacto de confirmación (el flujo de los 15 minutos)**
- Encargada tiene 15 min desde que se asignó el contacto para actuar
- Si actúa: marca como realizado, bot NO interviene
- Si NO actúa en 15 min: bot lanza WA personalizado al cliente con:
  - Nombre del cliente, fecha y hora de la cita, nombre de la sucursal
  - Link de Google Maps con la ubicación exacta de la sucursal
- CRM registra el contacto como "realizado por sistema"
- Actividad marcada en agenda de la encargada: bot actuó por ella

**F03 — Recordatorio 24h y 2h antes**
- Bot WA 24h antes: "¿Confirmas tu cita de mañana?" con mapa de la sucursal
- Cliente responde SÍ / NO / no contesta
- Bot WA 2h antes si no confirmó aún: recordatorio urgente con mapa
- CRM actualiza estado: Confirmada / Sin confirmar / No-show pendiente

**F04 — No-show: recuperación automática**
- Encargada marca no-show con 1 clic
- Bot WA empático 2h después con 2-3 fechas disponibles
- Sin respuesta 48h: actividad en agenda de la encargada + WA a la encargada + Outlook
- CRM registra resultado: reagendado / cancelado / sin contacto

**F05 — Campaña proactiva de mantenimiento**
- Sistema analiza CRM y detecta vehículos próximos a mantenimiento (km, meses, garantía)
- Bot WA personalizado al cliente
- Sin respuesta 3 días: actividad en agenda de encargada con guión IA
- Si agenda → cita vinculada al expediente
- Si no → recordatorio automático a 30 días

### 4.4 📊 Sub-módulo Reportes Citas

**Dashboard fijo (KPIs):**
- Citas del día / semana / mes por estado
- Tasa de show vs no-show por período y fuente
- Tiempo promedio de contacto (desde asignación hasta confirmación)
- Veces que el bot actuó por encargada (timer 15 min)
- Citas recuperadas desde no-show
- Fuentes de citas: SF / Seekop / Manual / Bot / Web
- Tiempo promedio en estado "En agencia" (Recepción Express)

**Campos disponibles en el constructor:**
- Fecha cita, hora, sucursal, asesor, encargada
- Cliente, vehículo, tipo de servicio
- Fuente, estado, canal de contacto
- Duración de espera en agencia, método check-in
- Confirmación 24h / 2h, resultado no-show

**F06 — Recepción Express (check-in digital sin kiosco)**

*Fase 1 — Pre-llegada (WA la noche anterior o 30 min antes):*
- Bot WA al cliente: "Para agilizar tu recepción, ¿cuántos km tiene tu auto? ¿Algo adicional que revisar? ¿Necesitas auto de cortesía?"
- Cliente responde por WA → sistema captura: `prellegada_km`, `prellegada_notas`, `prellegada_cortesia`
- Asesor ve en su panel la info pre-capturada antes de que el cliente llegue

*Fase 2 — Check-in al llegar:*
- Bot WA 30 min antes: "¿Ya vas en camino? Toca cuando llegues y tu asesor saldrá a recibirte"
- **Opción A**: cliente toca "Ya llegué" en el WA
- **Opción B**: QR físico impreso en la entrada de la agencia → link en el teléfono del cliente → confirma con un tap
- Al check-in: `cita.estado → 'en_agencia'`, notificación inmediata al asesor con KM y notas
- Timer visible en Kanban: cuántos minutos lleva el cliente esperando
- Si asesor no confirma salida en X minutos → escalación a encargada de citas

*Fase 3 — Recepción Express (asesor en estacionamiento):*
- Asesor ve datos pre-llenados en su app (KM, notas, solicitud cortesía)
- Realiza checklist de inspección visual con fotos desde su celular
- Cliente firma digitalmente en la pantalla del asesor (o link WA al propio teléfono del cliente)
- Asesor confirma → **OT se crea automáticamente** con todos los datos
- WA al cliente: "✅ Tu vehículo está en taller. OT #XXXXX. Sigue tu servicio en tiempo real: [link]"
- `cita.estado → 'show'`, `cita.ot_creada_auto = true`

*Sin hardware, sin fila, sin papel. El asesor espera al cliente en la puerta.*

---

## 5. MÓDULO TALLER (PDV)

### 5.1 Vista Kanban — 5 columnas
1. **Recibido** — vehículo en recepción
2. **Diagnóstico** — técnico evaluando
3. **En reparación** — trabajo en proceso
4. **Listo** — listo para entrega
5. **Entregado** — cliente recogió, CSI activado

### 5.2 Flujos TALLER

**F01 — Seguimiento activo del vehículo**
- Asesor recibe: fotos + checklist + promesa de entrega
- Bot WA al cliente: "Tu vehículo fue recibido" + link de seguimiento sin app ni login
- Asesor actualiza estado desde celular → bot WA automático al cliente
- Escalación automática 3 niveles si asesor no actualiza en 4h:
  - Nivel 1 (+4h): alerta al asesor
  - Nivel 2 (+2h): alerta al gerente
  - Nivel 3 (+1h): bot actúa por el asesor
- Entrega: firma digital + CSI activado automáticamente

**F02 — Pieza no disponible con fecha estimada (flujo crítico — 28% de los casos)**
- Asesor abre expediente: número de parte + proveedor + ETA
- Bot WA al cliente:
  - Con ETA: "La pieza llegará aprox. el [fecha]"
  - Sin ETA: "Seguimos coordinando con el proveedor"
  - Seguimiento cada 3 días si no hay novedad
- Pieza llega → asesor registra con 1 clic → estado: recibida
- Bot WA inmediato al cliente: "¡Buenas noticias! La pieza llegó. ¿Quieres agendar?"
  + Botón: [Sí, quiero agendar]
- Cliente toca "Sí, quiero agendar"
- Bot responde inmediatamente: "Perfecto, en breve un asesor de citas te contactará"
- CRM crea actividad automática asignada a encargada de citas:
  - Tipo: "Agendar instalación de pieza"
  - Datos: nombre cliente, WA, vehículo, número de parte, descripción
- Encargada recibe simultáneamente:
  ① WA urgente con todos los datos
  ② Email con los mismos datos
  ③ Actividad en su agenda CRM
  ④ Evento en su Outlook
- Encargada llama → agenda la cita → flujo normal de confirmación toma el control
- Si cliente NO responde: bot reintenta a 3 días, luego actividad directa a encargada

**F03 — Trabajo adicional detectado**
- Técnico/asesor detecta problema extra + toma foto
- Bot WA al cliente: foto + descripción simple + costo + botones (Autorizo / No / Más info)
- Cliente decide desde su teléfono en minutos
- Aprueba → trabajo suma a OT + nuevo tiempo estimado
- Rechaza → documentado + recordatorio automático a 30 días en CRM

**F04 — Garantía formal con la marca**
- Sistema verifica vigencia automáticamente (km + fecha de compra del CRM)
- Asesor abre expediente con foto + código de falla DTC
- Bot IA hace seguimiento cada 2 días con la marca
- WA informativo al cliente cada 3 días
- Aprobada → reparación agendada
- Rechazada → presupuesto al cliente
- Trazabilidad completa en CRM

**F05 — Diagnóstico realizado, reparación pendiente**
- Asesor registra diagnóstico
- Bot WA con resumen en lenguaje simple (no técnico)
- Sistema activa flujo según motivo: Pieza / Garantía / Decisión cliente
- Recordatorio automático a 30 / 60 / 90 días
- Nada queda en el olvido

**F06 — Venta perdida: recuperación de reparación rechazada**
- Cliente rechazó trabajo adicional → CRM registra como "Venta Perdida"
- Datos guardados: reparación, fecha, OT, cliente, vehículo
- Archivo de ventas perdidas llega al sistema (por los mismos medios que otros archivos)
- Bot WA personalizado al cliente: "[nombre], hace [X tiempo] detectamos que tu [vehículo]
  necesitaba [reparación]. Es importante atenderlo. ¿Quieres agendar?"
  + Botón: [Agendar servicio]
- Cliente toca "Agendar" → Bot responde: "Perfecto, en breve un asesor te contactará"
- CRM crea actividad en agenda de la encargada de citas:
  - Tipo: "Llamada recuperación venta perdida"
  - Descripción: cliente, vehículo, reparación pendiente
- Encargada recibe: WA urgente + Outlook + actividad en CRM
- Encargada llama → agenda cita → flujo normal toma el control
- Si cliente no responde: bot reintenta a 3 días, luego actividad directa
- Estados: detectada → registrada → contacto_enviado → cliente_interesado → cita_agendada → cerrada

**F07 — CSI post-servicio (48h después)**
- Archivo post-servicio llega al sistema: nombre, WA, OT, asesor, condición del cliente
- Sistema evalúa condición de cada cliente:
  - Cliente feliz → bot WA automático: "¿Nos dejarías una reseña?" + link Google
  - Cliente no feliz → actividad en agenda de MK/Atención:
    "Llamar a [nombre] · OT #[número] · Motivo: cliente insatisfecho"
    + WA urgente al agente MK
    + Evento en Outlook del agente MK
- Agente MK realiza la llamada → marca actividad como realizada → notas en CRM
- Ningún cliente insatisfecho queda sin contacto
- KPIs: CSI promedio, reseñas Google generadas, actividades MK realizadas

### 5.3 📊 Sub-módulo Reportes Taller

**Dashboard fijo (KPIs):**
- OTs abiertas / cerradas / en proceso por período
- Tiempo promedio de permanencia del vehículo en taller
- Ingresos por mano de obra y refacciones por período
- CSI promedio por asesor y por período
- Reseñas Google generadas
- Ventas perdidas: detectadas / recuperadas / sin recuperar
- Escalaciones por nivel (1 / 2 / 3) por asesor
- OTs por tipo de servicio (mantenimiento, garantía, correctivo, campaña)

**Campos disponibles en el constructor:**
- OT: número, fecha recepción, fecha entrega, días en taller
- Asesor, técnico asignado, sucursal
- Cliente, vehículo (marca, modelo, año, km entrada/salida)
- Total mano de obra, total refacciones, total OT
- Estado, nivel de escalación, CSI, condición cliente
- Venta perdida vinculada: monto rechazado, estado recuperación
- Campaña / garantía aplicada

**Acceso por rol:** gerente ve todos los asesores y técnicos · asesor_servicio solo sus OTs · tecnico solo sus líneas

---

## 6. MÓDULO REFACCIONES

**F01 — Maestro de partes inteligente**
- Asesor busca número de parte en el sistema
- Sistema busca primero en maestro DMS (Autoline)
- Si no encuentra → scraping automático del portal de la marca:
  imagen OEM + número + precio + disponibilidad
- Todo en segundos, sin salir del sistema

**F02 — Cotización PDF con imagen OEM**
- Asesor genera cotización con 1 clic
- Sistema genera PDF: foto OEM + número de parte + precio + vigencia + logo concesionario
- Cliente recibe PDF por WA
- Sistema detecta si el cliente lo abrió (tracking de apertura)
- Asesor sabe si fue leída

**F03 — Seguimiento de presupuesto pendiente**
- Bot WA 24h: "¿Pudiste revisar la cotización?"
- Bot WA 48h: segundo intento con mensaje diferente
- Sin respuesta 72h: actividad en agenda del asesor + WA recordatorio + Outlook
- Aprueba → orden de pedido
- Rechaza → recordatorio automático a 30 días en CRM

### 6.2 📊 Sub-módulo Reportes Refacciones

**Dashboard fijo (KPIs):**
- Cotizaciones enviadas / aprobadas / rechazadas / vencidas por período
- Tasa de conversión de cotizaciones por asesor
- Piezas pendientes de llegada (ETA vencido o próximo)
- Partes más cotizadas (top 20)
- Tiempo promedio de respuesta del cliente a cotización
- Valor total de cotizaciones aprobadas por período

**Campos disponibles en el constructor:**
- Cotización: número, fecha, estado, total, tipo (servicio/refacciones/mixta)
- Pieza: número de parte, descripción, proveedor, precio, ETA
- Cliente, vehículo, asesor, sucursal
- Tracking: fecha apertura por cliente, respuesta, seguimientos enviados

---

## 7. MÓDULO VENTAS

**F01 — Captación de lead**
- Lead llega por WA, FB, IG, o formulario web
- Bot IA responde en <60 segundos y califica la necesidad
- CRM crea lead con: fuente, canal, necesidad, datos de contacto
- Asigna automáticamente al asesor según reglas definidas
- Asesor recibe WA de notificación + actividad en agenda

**F02 — Seguimiento del pipeline**
- Vista Kanban: Nuevo → Contactado → Cotizado → Negociando → Cerrado
- CRM registra automáticamente cada interacción
- Bot alerta si el asesor lleva +X horas sin actualizar el lead

**F03 — Cruce servicio → oportunidad de venta nueva**
- IA detecta en CRM: vehículo >4 años o alto historial de servicio
- Asesor de ventas recibe sugerencia con historial del cliente
- Si asesor aprueba: bot WA con oferta de renovación

**F04 — Actividades y recordatorios con Outlook sync**
- Asesor o sistema crea actividad de seguimiento
- Bot WA recordatorio antes de la actividad
- Sync con Outlook del asesor de ventas
- Actividad marcada como completada → historial actualizado

### 7.2 📊 Sub-módulo Reportes Ventas

**Dashboard fijo (KPIs):**
- Leads nuevos por período y por fuente (WA / FB / IG / Web)
- Tasa de conversión por etapa del pipeline
- Leads por asesor: nuevos, contactados, cerrados
- Tiempo promedio de cierre por fuente
- Leads cruzados desde taller (servicio → venta nueva)
- Oportunidades perdidas: motivo y frecuencia

**Campos disponibles en el constructor:**
- Lead: fecha, fuente, canal, estado, necesidad, presupuesto estimado
- Asesor, sucursal
- Cliente, vehículo de interés
- Tiempo sin actualizar, último contacto
- Cruce desde OT (si aplica)

---

## 8. MÓDULO BANDEJA + IA

**F01 — Conversación entrante multicanal**
- Cliente escribe por WA / FB / IG / Email
- Llega a la bandeja unificada vinculada al expediente en CRM
- Asesor responde desde un solo lugar con historial visible
- Conversación registrada en CRM

**F02 — Escalación automática 3 niveles**
- 4h sin actualizar OT → Nivel 1: alerta al asesor
- +2h sin acción → Nivel 2: alerta al gerente
- +1h más → Nivel 3: bot actúa por el asesor (WA con último estado)
- Todo registrado en CRM

**F03 — Supervisión del Key User / Gerente**
- Vista global de todas las conversaciones de todos los asesores
- KPI: tiempo sin respuesta por asesor y canal
- Gerente puede intervenir directamente
- Auditoría permanente exportable

**F04 — Transferencia entre asesores**
- Gerente selecciona conversaciones del asesor ausente
- Nuevo asesor ve historial completo + nota de contexto
- Cliente no nota el cambio
- Registro de transferencia en CRM

**F05 — Venta cruzada inteligente + alerta garantía**
- IA analiza historial: km, modelo, año, servicios anteriores
- Asesor recibe sugerencia en pantalla al atender
- Bot WA post-servicio con oferta personalizada si no compró
- IA mejora sugerencias con cada visita

### 8.2 📊 Sub-módulo Reportes Bandeja + IA

**Dashboard fijo (KPIs):**
- Mensajes entrantes por canal (WA / FB / IG / Email) por período
- Tiempo promedio de primera respuesta por asesor y canal
- Conversaciones sin respuesta +X horas
- Transferencias realizadas entre asesores
- Intervenciones del gerente
- Sugerencias IA aceptadas vs ignoradas por asesor

**Campos disponibles en el constructor:**
- Mensaje: fecha, canal, dirección (entrante/saliente), asesor
- Tiempo de respuesta, leído por cliente
- Conversación vinculada a: OT / Cita / Lead / Cliente
- Enviado por bot vs enviado por asesor

---

## 9. MÓDULO SEGUROS

Módulo para registrar y gestionar las pólizas de seguro vinculadas a cada vehículo.

**Regla de negocio:** Seguro → siempre ligado a un Vehículo → que siempre está ligado a un Cliente.

### Entidades
- **Compañías Aseguradoras** — catálogo de aseguradoras (código 2 chars + nombre)
- **Pólizas de Seguro** — múltiples pólizas por vehículo (historial)

### Vista en CRM
- Accesible desde el expediente del vehículo
- Lista de historial de pólizas: fecha fin, aseguradora, N° póliza, totales, estado
- Formulario de detalle con todos los campos

### Campos principales de la póliza
- Compañía aseguradora, N° póliza, propietario de la póliza (puede diferir del dueño del vehículo)
- Fecha inicio / Fecha fin (con alerta automática 30 días antes de vencer)
- Tipo de póliza: NF (nuevo pago completo) / NP (nuevo pago periódico) / XF (renovación completo) / XP (renovación periódico)
- Estado: M (memorándum) → N (nuevo) → C (confirmado) → I (facturado)
- Coberturas Grupo 1 (Terceros): terceros, robo, roce, no avería, otros 1
- Coberturas Grupo 2 (Vehículo): daño vehículo, parabrisas, pasajero, ext. terceros, otros 2
- Total 1, Total 2, referencia, referencia cliente

### Flujos
**F01 — Registro de póliza**
- Asesor abre el vehículo en CRM → sección Seguros → Nueva póliza
- Llena los campos, estado inicia en N (nuevo)
- Historial de todas las pólizas siempre visible

**F02 — Alerta de vencimiento**
- 30 días antes de `fecha_fin`: actividad automática asignada al asesor responsable
- Bot WA recordatorio al cliente: "Tu póliza de [aseguradora] vence el [fecha]. ¿Quieres renovarla?"

### 📊 Sub-módulo Reportes Seguros

**Dashboard fijo (KPIs):**
- Pólizas por vencer en los próximos 30 / 60 / 90 días
- Pólizas por estado (memorándum / nuevo / confirmado / facturado)
- Pólizas por aseguradora
- Alertas enviadas vs renovaciones concretadas
- Valor total asegurado por período

**Campos disponibles en el constructor:**
- Póliza: número, aseguradora, tipo, estado, fecha inicio, fecha fin
- Propietario de póliza, cliente, vehículo
- Coberturas activas, totales Grupo 1 y 2
- Alerta enviada, resultado (renovó / no renovó)

---

## 10. IA TRANSVERSAL

La IA opera en todos los módulos con las siguientes capacidades:

1. **Clasificación de mensajes entrantes** — detecta intención: cita, queja, consulta, venta
2. **Generación de WA personalizados** — usa nombre, vehículo, historial del cliente
3. **Sugerencias de venta cruzada** — basadas en km, modelo y servicios anteriores
4. **Guiones de llamada** — para BDC y encargada de citas según el perfil del cliente
5. **CSI inteligente** — clasifica clientes como feliz/no feliz y activa el flujo correcto
6. **Control de horario** — 8:00 AM – 7:30 PM, mensajes fuera de horario se encolan
7. **Escalación automática** — 3 niveles según tiempo sin actualización

---

## 10. ARQUITECTURA DE ACTIVIDADES (Regla universal del CRM)

Toda actividad en CRM, sin importar qué módulo la genera, se vincula a:

```
Actividad {
  id: uuid
  tipo: llamada | contacto | seguimiento | tarea | reunion | recordatorio | cita | cotizacion
  titulo: string
  descripcion: string
  fecha_programada: timestamptz
  fecha_realizada: timestamptz | null
  estado: pendiente | en_proceso | realizada | cancelada
  resultado: string | null
  notas: string | null
  prioridad: normal | alta | urgente

  -- Vínculos obligatorios
  usuario_asignado_id: FK → usuarios
  cliente_id: FK → clientes
  
  -- Vínculos opcionales (según contexto)
  vehiculo_id: FK → vehiculos | null
  empresa_id: FK → empresas | null
  ot_id: FK → ordenes_trabajo | null
  cita_id: FK → citas | null
  
  -- Notificaciones y sync
  outlook_event_id: string | null
  wa_enviado: boolean
  email_enviado: boolean
  
  -- Auditoría
  creada_por_id: FK → usuarios
  modulo_origen: crm | citas | taller | refacciones | ventas | bandeja | ia
  creada_at: timestamptz
}
```

**Vista "Actividades del cliente":**
- Cronológica, todas las interacciones del cliente en un solo lugar
- Filtrable por: tipo, usuario, fecha, módulo de origen
- Exportable para reportes
- Incluye: llamadas, WA, citas, OTs, cotizaciones, resultados de CSI

---

## 11. MÓDULO ATENCIÓN A CLIENTES

Módulo independiente accesible desde **cualquier pantalla** de la app mediante un botón flotante fijo. Cualquier usuario — de cualquier área — puede levantar una queja en el momento en que la detecta.

### Actores del flujo

| Actor | Rol en el flujo |
|-------|----------------|
| **Receptor** | Cualquier usuario que recibe o detecta la queja |
| **Encargado AC** | Responsable del módulo Atención a Clientes — gestiona y canaliza |
| **Gerente de área** | Investiga internamente con el empleado involucrado |
| **Persona involucrada** | El empleado señalado en la queja |
| **Cliente** | Valida al final si la solución es aceptable |

### Flujo principal

```
[Cualquier módulo / cualquier usuario]
  ↓ pulsa botón "Atención a Clientes"

PASO 1 — RECEPCIÓN
  Receptor captura:
  • Área involucrada (Servicio / Refacciones / Citas / Ventas N / Ventas U / Admon / Otro)
  • Tipo de queja
  • Voz del cliente (exactamente lo que dijo)
  • Fecha y hora de recepción
  • Persona involucrada (empleado señalado)
  • Módulo origen + referencia (OT, cita, cotización, lead — si aplica)
  ↓ Guarda

PASO 2 — ASIGNACIÓN AL ENCARGADO AC
  → Notificación automática al Encargado de Atención a Clientes:
    ① WA con folio + resumen
    ② Email con detalle completo
    ③ Actividad en su agenda CRM
    ④ Evento en su Outlook
  Encargado AC revisa → pulsa "Dar seguimiento"

PASO 3 — CANALIZACIÓN AL GERENTE DE ÁREA
  Encargado AC asigna al gerente correspondiente:
  → Notificación al gerente:
    ① WA con folio + contexto
    ② Actividad en su agenda CRM vinculada a la queja
    ③ Evento en su Outlook
  Estado: en_seguimiento → con_gerente

PASO 4 — INVESTIGACIÓN INTERNA
  Gerente habla con la persona involucrada
  Gerente registra en el sistema:
  • Qué pasó (hallazgo interno)
  • Solución que se va a proponer al cliente
  • Compensación si aplica (descuento, cortesía, retrabajo)

PASO 5 — PROPUESTA DE SOLUCIÓN AL CLIENTE
  Gerente va con el cliente y presenta la solución
  Gerente registra en el sistema:
  • Solución propuesta
  • Respuesta inicial del cliente
  Estado: solucion_propuesta

PASO 6 — VALIDACIÓN POR ENCARGADO AC
  → Notificación al Encargado AC para validar con el cliente:
    ① WA al encargado
    ② Actividad en su agenda
  Encargado AC contacta al cliente para confirmar satisfacción

  6a. Cliente acepta → queja.estado = 'cerrada'
      → WA de cierre al cliente: "Gracias por tu confianza..."
      → Actividades de toda la cadena marcadas como completadas
      → Queja visible en historial del cliente en CRM

  6b. Cliente NO acepta → queja.estado = 'reabierta'
      → ciclo++ (contador de ciclos)
      → Regresa al PASO 3 con nuevo seguimiento
      → Encargado AC y gerente notificados del rechazo
```

### Folio automático

Cada queja recibe un folio único: **AC-2026-0001** (año + consecutivo por sucursal). Generado automáticamente por trigger en BD.

### Visibilidad de la cadena

Toda la cadena de seguimientos es visible en un solo lugar:

```
Queja AC-2026-0047
├── [✅] Recepción — Juan López (Asesor Servicio) — 15 Mar 10:32
├── [✅] Asignación AC — María Torres — 15 Mar 10:45
├── [✅] Canalización gerente — María Torres → Carlos Ruiz — 15 Mar 11:00
├── [✅] Investigación — Carlos Ruiz — 16 Mar 09:00
├── [✅] Propuesta solución — Carlos Ruiz → Cliente — 16 Mar 14:00
├── [⏳] Validación cliente — María Torres — pendiente
└── [ ] Cierre
```

Cada paso tiene su actividad vinculada en las agendas de los responsables.

### Áreas que pueden levantar quejas

Servicio · Refacciones · Citas · Ventas Nuevas · Ventas Usadas · Administración · Otro

### 📊 Sub-módulo Reportes Atención a Clientes

**Dashboard fijo (KPIs):**
- Quejas por estado (abiertas / en proceso / cerradas)
- Quejas por área y tipo
- Tiempo promedio de resolución por área y por ciclo
- Quejas que requirieron más de 1 ciclo (rechazos de solución)
- Tasa de satisfacción del cliente al cierre
- Compensaciones otorgadas por tipo y monto

**Campos disponibles en el constructor:**
- Queja: folio, área, tipo, estado, ciclo, fecha recepción, fecha cierre
- Receptor, encargado AC, gerente área, persona involucrada
- Solución propuesta, compensación, cliente satisfecho
- Tiempo total de resolución, tiempo por paso

---

## 12. MÓDULO CSI — CUSTOMER SATISFACTION INDEX (Sprint 10)

El CSI mide satisfacción de forma **proactiva** — tú preguntas antes de que el cliente se queje. Complementa directamente a Atención a Clientes: un score bajo dispara una queja automática.

### Diferencia clave con Atención a Clientes

| CSI | Atención a Clientes |
|---|---|
| Proactivo — tú preguntas | Reactivo — cliente se queja |
| Post-servicio / post-venta | Cualquier momento |
| Score, NPS, tendencias | Resolución del problema |
| Alimenta quejas automáticas | Recibe quejas del CSI |

### Tipos de preguntas
- **Estrellas** — 1 a 5 (más intuitivo para WA)
- **NPS** — 0 a 10 ("¿Recomendarías la agencia?")
- **Texto libre** — comentario abierto
- **Sí/No** — preguntas directas

### Flujos CSI

**F01 — Envío automático post-OT**
- OT se cierra en Taller → n8n espera N días (configurable)
- WA al cliente con link personalizado y seguro (sin login)
- "¿Cómo calificarías tu experiencia en [Sucursal]? [link]"
- Link abre mini-encuesta optimizada para móvil

**F02 — Recordatorios automáticos**
- Si no responde en 48h → recordatorio 1
- Si no responde en otras 48h → recordatorio 2
- Máximo de recordatorios configurable por encuesta

**F03 — Score bajo → Queja automática**
- Si score promedio ≤ umbral configurado (default: 3/5)
- Sistema crea automáticamente una queja en Atención a Clientes
- Encargado AC recibe notificación y contacta al cliente
- Captas insatisfacción antes de que llegue a Google o redes

**F04 — Constructor de encuestas**
- Admin crea plantillas de encuesta por módulo: Taller / Ventas / Citas
- Configura preguntas, orden, tipo y obligatoriedad
- Configura días de espera, recordatorios y umbral de alerta

### 📊 Sub-módulo Reportes CSI

**Dashboard fijo:**
- NPS por sucursal / asesor / período
- Score promedio por tipo de servicio y marca
- Tasa de respuesta (enviadas vs respondidas)
- Quejas generadas desde CSI (score bajo)
- Tendencia mensual de satisfacción

---

## 13. MÓDULO SOPORTE (Sprint 7+ — pendiente de implementar)

### Contexto
Módulo interno para que los concesionarios (clientes de ServiceTrack) levanten tickets de soporte al equipo de ServiceTrack.

**Fases:**
- **Fase 1 (ahora):** Soporte manual por Miguel. Tickets documentados en Notion.
- **Fase 2:** n8n + Claude API responden automáticamente los tickets comunes.
- **Fase 3 (Sprint 7+):** Módulo propio integrado en ServiceTrack.

### Roles
- `key_user` / `admin` del concesionario → crea y consulta tickets
- Equipo ServiceTrack → gestiona y resuelve

### Schema BD (futuro)

```sql
tickets_soporte(
  id uuid PK,
  grupo_id FK → grupos,
  sucursal_id FK → sucursales (nullable),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  modulo text,  -- 'auth' | 'citas' | 'taller' | 'refacciones' | 'ventas' | 'crm' | 'seguros' | 'otro'
  tipo text,    -- 'bug' | 'consulta' | 'configuracion' | 'capacitacion' | 'mejora'
  prioridad text DEFAULT 'media',  -- 'alta' | 'media' | 'baja'
  estado text DEFAULT 'abierto',   -- 'abierto' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado'
  resuelto_at timestamptz,
  creado_por_id FK → usuarios,
  creado_at timestamptz DEFAULT now()
)

comentarios_ticket(
  id uuid PK,
  ticket_id FK → tickets_soporte,
  autor_id FK → usuarios,
  mensaje text NOT NULL,
  es_interno boolean DEFAULT false,  -- nota interna vs respuesta al cliente
  adjunto_url text,
  creado_at timestamptz DEFAULT now()
)
```

### Flujos (Fase 3)

**F01 — Levantar ticket**
- key_user abre ticket desde el dashboard → selecciona módulo, describe problema
- Sistema notifica a soporte ServiceTrack via WA/email

**F02 — Respuesta y resolución**
- Equipo soporte responde desde el panel interno
- Cliente recibe WA con la respuesta
- Al cerrar → tiempo de resolución queda registrado

**F03 — IA responde (Fase 2, via n8n)**
- n8n detecta ticket nuevo en Notion
- Claude API clasifica el tipo y busca respuesta en knowledge base
- Si confianza > 80% → responde automáticamente
- Si no → escala a soporte humano

---

## 11. LAYOUT DE IMPORTACIÓN (campos mínimos para el piloto)

### Citas (desde SF / Seekop / ClearMechanic / Drive)
```
nombre_cliente, whatsapp (con lada), fecha_cita, hora_cita,
tipo_servicio, sucursal, vin (opcional), modelo_vehiculo (opcional)
```

### OTs / Taller (desde Autoline)
```
numero_ot, vin, nombre_cliente, whatsapp, numero_parte,
descripcion_pieza, fecha_pedido, eta, asesor_asignado
```

### Venta Perdida (layout externo)
```
numero_ot_origen, nombre_cliente, whatsapp, vin, 
descripcion_reparacion, monto_rechazado, fecha_rechazo, asesor
```

### CSI Post-servicio (48h después de salida)
```
nombre_cliente, whatsapp, numero_ot, asesor, 
condicion: feliz | no_feliz, fecha_salida
```

---

## 12. MODELO DE NEGOCIO Y PRECIOS

### Planes (orientativos — MXN/mes por sucursal)
| Plan | Módulos | Precio |
|------|---------|--------|
| Arranque | CRM + CITAS | $4,500–$6,000 |
| Servicio | + TALLER + REFACCIONES | $8,000–$12,000 |
| Completo | Todos los módulos | $14,000–$18,000 |
| Empresa/Grupo | Multi-sucursal + VENTAS | A negociar |

### Piloto
- Duración: 3 meses
- Costo: simbólico o sin costo a cambio de: feedback, caso de éxito, reseña
- DMS: Autoline confirmado
- Horario bot: 8:00 AM – 7:30 PM confirmado

### Decisiones pendientes para el piloto
- [ ] Nombre del producto
- [ ] Usuarios y roles exactos
- [ ] Precio final del piloto
- [ ] Reunión de validación con el concesionario

---

## 13. DIFERENCIADORES VS COMPETENCIA

| Capacidad | Nuestro sistema | GoHighLevel | ClearMechanic | Salesforce |
|-----------|----------------|-------------|----------------|------------|
| Lee archivos Drive/SF/Seekop | ✅ | ❌ | ❌ | ❌ |
| 15 min o bot actúa | ✅ | ❌ | ❌ | ❌ |
| Mapa en WA de confirmación | ✅ | ❌ | ❌ | ❌ |
| Historial del vehículo (Driver 360) | ✅ | ❌ | Parcial | ✅ |
| Venta perdida → recuperación auto | ✅ | ❌ | ❌ | ❌ |
| Escalación 3 niveles automática | ✅ | Parcial | ❌ | Parcial |
| Actividades vinculadas + Outlook | ✅ | Parcial | ❌ | ✅ |
| DMS automotriz mexicano | ✅ Autoline | ❌ | Parcial | Parcial |
| WhatsApp-first | ✅ | Parcial (SMS) | ❌ | ❌ |
| Precio accesible LATAM | ✅ | $97-497 USD | Alto | Muy alto |

