# BotIA — Entities

> Catálogo de entidades que el bot extrae e interpreta.
> **Última actualización:** 2026-04-28 — P0.3

---

## CLIENTE

### `cliente_id`
- **Tipo:** UUID
- **Fuente de verdad:** `clientes.id` en Supabase
- **Obligatoria:** Sí — se crea automáticamente si no existe (DEMO placeholder)
- **Puede inferirse:** No — se resuelve por whatsapp/email
- **Requiere confirmación:** No

### `nombre` / `apellido`
- **Tipo:** String
- **Fuente de verdad:** `clientes.nombre / apellido`
- **Obligatoria:** Sí (nombre real — no placeholder)
- **Puede inferirse:** No — cliente debe proporcionarlo
- **Requiere confirmación:** No (se actualiza directamente)
- **Normalización:** MAYÚSCULAS en BD
- **Ejemplos:** "me llamo Carlos Mendoza", "soy Ana García", "Carlos"
- **CRÍTICO:** nombre NO es llave única de cliente. Solo es dato auxiliar/display.

### `whatsapp`
- **Tipo:** String — formato `+52XXXXXXXXXX`
- **Fuente de verdad:** `clientes.whatsapp`
- **Obligatoria:** Sí — es la **llave primaria de resolución de cliente**
- **Puede inferirse:** Sí — viene del mensaje entrante (número de origen)
- **Requiere confirmación:** No

### `email`
- **Tipo:** String
- **Fuente de verdad:** `clientes.email`
- **Obligatoria:** No
- **Puede inferirse:** No — cliente debe proporcionarlo
- **Normalización:** lowercase

### `telefono_alterno`
- **Tipo:** String
- **Fuente de verdad:** `clientes.telefono`
- **Obligatoria:** No
- **Puede inferirse:** No

---

## VEHÍCULO

### `vehiculo_id`
- **Tipo:** UUID
- **Fuente de verdad:** `vehiculos.id`
- **Obligatoria:** Sí — **no crear cita sin vehiculo_id en flujo comercial**
- **Puede inferirse:** Sí — si cliente tiene 1 solo vehículo vinculado
- **Requiere confirmación:** Sí cuando hay múltiples opciones

### `marca`
- **Tipo:** String
- **Fuente de verdad:** `vehiculos.marca`
- **Obligatoria:** Sí (para crear vehículo)
- **Puede inferirse:** Con `parsearVehiculo()` — reconoce marcas conocidas
- **Normalización:** MAYÚSCULAS en BD
- **Ejemplos:** "Honda", "toyota", "NISSAN", "Mercedes Benz"

### `modelo`
- **Tipo:** String
- **Fuente de verdad:** `vehiculos.modelo`
- **Obligatoria:** Sí
- **Puede inferirse:** Palabras después de la marca en texto libre
- **Normalización:** MAYÚSCULAS en BD
- **Ejemplos:** "City", "Sentra", "CLA 200"

### `anio`
- **Tipo:** Integer (año 4 dígitos)
- **Fuente de verdad:** `vehiculos.anio`
- **Obligatoria:** Sí
- **Puede inferirse:** Regex `/(19|20)\d{2}/`
- **Fallback:** Año actual si no se menciona (con advertencia)
- **Ejemplos:** "2022", "del 2020", "año 2019"

### `placa`
- **Tipo:** String — formato variable (México: ABC-123)
- **Fuente de verdad:** `vehiculos.placa`
- **Obligatoria:** No — pero **PREFERENTE**
- **Puede inferirse:** Regex pattern `[A-Z]{2,3}-?\d{3,4}[A-Z]{0,2}`
- **Normalización:** MAYÚSCULAS, sin guiones
- **Uso crítico:** Permite buscar vehículo en CRM sin depender de marca/modelo
- **Ejemplos:** "ABC123", "TEST888", "placa ABC-123", "la placa es XY1234"

### `vin`
- **Tipo:** String — 17 caracteres VIN estándar
- **Fuente de verdad:** `vehiculos.vin`
- **Obligatoria:** No
- **Puede inferirse:** Regex `[A-HJ-NPR-Z0-9]{17}` (VIN sin I, O, Q)
- **Normalización:** MAYÚSCULAS

### `color`
- **Tipo:** String
- **Fuente de verdad:** `vehiculos.color`
- **Obligatoria:** No
- **Puede inferirse:** Colores comunes en texto libre

### `kilometraje`
- **Tipo:** Integer
- **Fuente de verdad:** `ordenes_trabajo.km_ingreso` / `vehiculos.km_actual`
- **Obligatoria:** No para cita; sí para OT
- **Ejemplos:** "tiene 50 mil km", "50000 kilómetros"

---

## CITA

### `cita_id`
- **Tipo:** UUID
- **Fuente de verdad:** `citas.id`
- **Obligatoria:** Sí para confirmar/cancelar
- **Puede inferirse:** De consulta `consultarCitasCliente()` previo

### `servicio`
- **Tipo:** String — label normalizado
- **Fuente de verdad:** `citas.servicio`
- **Obligatoria:** Sí — **no crear cita con servicio NULL**
- **Puede inferirse:** Con `parsearServicio()` / BOTIA_SERVICE_SYNONYMS
- **Ejemplos:** "mantenimiento", "cambio de aceite", "se prendió un testigo"

### `fecha`
- **Tipo:** String — formato `YYYY-MM-DD`
- **Fuente de verdad:** `citas.fecha_cita`
- **Obligatoria:** Sí
- **Puede inferirse:** Con `parsearFecha()` — soporta "hoy", "mañana", "lunes", "15 de mayo"
- **Validación:** No puede ser pasado; hoy requiere filtro de disponibilidad

### `hora`
- **Tipo:** String — formato `HH:MM`
- **Fuente de verdad:** `citas.hora_cita`
- **Obligatoria:** Sí
- **Puede inferirse:** Con `parsearHora()` — "a las 11", "11:30", "2pm"
- **Validación:** Debe estar disponible según `buscarDisponibilidad()`

### `estado`
- **Tipo:** ENUM — `pendiente_contactar | contactada | confirmada | en_agencia | show | no_show | cancelada`
- **Modificable por bot:** Solo hacia `confirmada` (confirmar) o `cancelada` (cancelar)

---

## TIEMPO

### `fecha_relativa`
- **Ejemplos:** "hoy", "mañana", "pasado mañana", "la próxima semana"
- **Resolución:** `parsearFecha()` → `YYYY-MM-DD` en timezone `America/Mexico_City`

### `hora_absoluta`
- **Ejemplos:** "a las 8", "11:30", "2pm", "las 10 de la mañana"
- **Resolución:** `parsearHora()` → `HH:MM`

### `rango_horario` / `preferencia_momento`
- **Ejemplos:** "en la mañana", "después de las 3", "primera hora", "al mediodía"
- **Resolución:** Usar `buscarDisponibilidad()` y filtrar por el rango implícito
- **Estado actual:** No implementado en parser — bot debe inferir del contexto

---

## SUCURSAL

### `nombre_sucursal` / `direccion` / `telefono` / `horario`
- **Fuente de verdad:** `sucursales` + `configuracion_citas_sucursal`
- **Cómo se usa:** `leerInfoSucursal(sucursal_id)` → `InfoSucursal`
- **CRÍTICO:** Nunca inventar. Si no está configurado → decir que no se tiene la info.

---

## CONVERSACIÓN

### `frustration_level`
- **Tipo:** Boolean (actual) / Integer 0–3 (futuro)
- **Detección:** `isFrustracion()` con `BOTIA_FRUSTRATION_PATTERNS`
- **Uso:** Cambiar tono de respuesta determinística + inject a LLM

### `escalation_reason`
- **Tipo:** String — ver `BOTIA_ESCALATION_REASONS`
- **Persiste en:** `conversation_threads.metadata.escalation_reason` (pendiente implementar)

### `missing_slots`
- **Tipo:** Array de strings
- **Uso:** Reportar qué datos faltan para completar el flujo
- **Útil para:** Respuestas de frustración ("ya te dije") — revisar metadata y pedir solo lo faltante
