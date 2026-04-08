# INSTRUCCIONES PARA CLAUDE CODE
# Plataforma SaaS de Gestión de Servicio Postventa Automotriz
# Leer este archivo PRIMERO antes de tocar cualquier código.

---

## CONTEXTO GENERAL

Estamos construyendo un SaaS vertical para concesionarios automotrices en México.
El producto gestiona el ciclo completo de postventa: citas, taller, refacciones, ventas y comunicación.

**Lo que ya existe (no necesita construirse desde cero):**
- Definición completa del producto → PRODUCT_MASTER.md
- Schema de base de datos → SUPABASE_SCHEMA.sql
- Decisiones técnicas → TECH_STACK.md
- Mockup funcional del producto → mockup_producto.html
- Workflow Studio con todos los flujos → crm_v4.html

**Lo que necesita construirse:**
- El proyecto Next.js 14 completo
- Integración con Supabase
- Componentes UI según el mockup
- Automatizaciones n8n
- Integración Claude API

---

## CÓMO ARRANCAR (primera sesión)

1. Inicializar proyecto Next.js:
```bash
npx create-next-app@latest autoserv-crm --typescript --tailwind --eslint --app --src-dir=false
cd autoserv-crm
```

2. Instalar dependencias principales:
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @anthropic-ai/sdk
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge table tabs dialog sheet
npm install lucide-react
npm install @dnd-kit/core @dnd-kit/sortable  # para el Kanban drag & drop
npm install react-hot-toast                   # notificaciones
npm install date-fns                          # manejo de fechas
npm install xlsx                              # lectura de archivos Excel
npm install papaparse                         # lectura de archivos CSV
```

3. Configurar Supabase:
```bash
npm install -g supabase
supabase init
supabase login
# Ejecutar SUPABASE_SCHEMA.sql en el SQL Editor de Supabase
```

4. Crear .env.local con las variables del TECH_STACK.md

---

## PRIORIDAD DE DESARROLLO (Fase 1)

### Sprint 1 — Estructura base (días 1-3)
- [ ] Layout principal: Sidebar + Topbar + AppShell
- [ ] Autenticación con Supabase Auth
- [ ] Middleware de rutas protegidas
- [ ] Tema oscuro configurado en Tailwind

### Sprint 2 — CRM básico (días 4-7)
- [ ] Lista de clientes con búsqueda
- [ ] Perfil del cliente (Driver 360)
- [ ] CRUD de vehículos
- [ ] Vista de actividades del cliente

### Sprint 3 — CITAS (días 8-14)
- [ ] Kanban de citas con 5 columnas
- [ ] Timer de 15 minutos en tarjetas pendientes
- [ ] Importador de archivos CSV/Excel
- [ ] Integración básica con n8n para WA

---

## REGLAS CRÍTICAS PARA ESTE PROYECTO

### 1. El Kanban de CITAS es el corazón del MVP
El timer de 15 minutos debe ser visible y funcional desde el día 1.
Si la encargada no actúa en 15 min → n8n dispara el WA al cliente.

### 2. Nunca duplicar clientes
Al importar cualquier archivo, siempre verificar:
- ¿Existe el WA en la BD? → actualizar
- ¿Existe el VIN? → actualizar vehículo
- Solo si no existe nada → crear nuevo

### 3. Toda actividad se vincula
Cualquier función que cree una actividad debe vincularla a:
`usuario_asignado_id` (obligatorio) + `cliente_id` + al menos uno de: vehículo, OT, cita

### 4. Horario del bot
Antes de enviar cualquier WA o notificación, verificar que estén dentro del horario.
Ver función `lib/utils/horario-bot.ts`

### 5. El link de seguimiento de OT es público
La ruta `/seguimiento/[token]` NO requiere autenticación.
El cliente puede ver el estado de su vehículo sin tener cuenta.

---

## COMPONENTES CLAVE A CONSTRUIR

### KanbanBoard.tsx (genérico)
```typescript
interface KanbanBoardProps<T> {
  columnas: KanbanColumna[]        // definición de columnas con colores y labels
  items: T[]                       // los registros a mostrar
  getColumna: (item: T) => string  // qué columna le corresponde al item
  renderCard: (item: T) => ReactNode // cómo se ve la tarjeta
  onMover: (item: T, nuevaColumna: string) => Promise<void> // drag & drop
}
```

### Timer15min.tsx
```typescript
// Muestra barra de progreso que va de verde → amarillo → rojo
// según los minutos transcurridos desde contacto_asignado_at
// Cuando llega a 0 → dispara evento para que n8n envíe el WA
interface Timer15minProps {
  inicio: Date        // contacto_asignado_at
  limite: Date        // contacto_limite_at (inicio + 15 min)
  onVencido: () => void // callback cuando el timer llega a 0
}
```

### ActividadTimeline.tsx
```typescript
// Muestra cronológicamente todas las actividades de un cliente
// Incluye: llamadas, WA, citas, OTs, cotizaciones, CSI
// Filtrable por tipo, módulo y fecha
interface ActividadTimelineProps {
  clienteId: string
  filtros?: {
    tipo?: TipoActividad[]
    modulo?: ModuloOrigen[]
    fechaDesde?: Date
    fechaHasta?: Date
  }
}
```

---

## FLUJOS N8N A CONFIGURAR (en orden de prioridad)

### n8n-001 — Timer 15 min CITAS
```
Trigger: Cron cada 1 minuto
→ Query Supabase: citas en estado 'pendiente_contactar' donde contacto_limite_at < NOW()
→ Por cada cita:
   → Marcar contacto_bot = true en Supabase
   → Obtener datos: nombre cliente, fecha cita, hora, sucursal, maps_url
   → Enviar WA: "Hola [nombre], tu cita en [sucursal] es el [fecha] a las [hora]. 📍 [maps_url]"
   → Crear actividad en Supabase: tipo='wa_enviado', cliente_id, cita_id, modulo_origen='citas'
   → Cambiar estado cita a 'contactada'
```

### n8n-002 — Recordatorios 24h y 2h
```
Trigger: Cron diario a las 9:00 AM
→ Query: citas confirmadas para mañana sin recordatorio_24h_enviado_at
→ Por cada cita: enviar WA 24h
→ Trigger: Cron cada hora
→ Query: citas en las próximas 2h sin recordatorio_2h_enviado_at
→ Por cada cita: enviar WA 2h
```

### n8n-003 — Pieza llegó → notificar cliente
```
Trigger: Webhook desde Supabase cuando piezas_ot.estado cambia a 'recibida'
→ Obtener datos de la pieza y del cliente
→ Enviar WA con botón interactivo: "¡La pieza llegó! ¿Quieres agendar?"
→ Guardar notificación en Supabase
→ Esperar respuesta del cliente (webhook de respuesta WA)
→ Si responde "Sí":
   → Bot responde: "Perfecto, en breve te contactamos"
   → Crear actividad en Supabase para encargada de citas
   → Enviar WA a encargada
   → Enviar email a encargada
   → Crear evento en Outlook de la encargada (Microsoft Graph API)
```

### n8n-004 — Escalación OT
```
Trigger: Cron cada 30 minutos
→ Query: OTs activas con horas_sin_actualizar >= 4
→ Nivel 1 (4h): WA al asesor asignado
→ Nivel 2 (6h): WA al gerente + actualizar nivel_escalacion=2
→ Nivel 3 (7h): bot envía WA al cliente con último estado + actualizar nivel_escalacion=3
```

### n8n-005 — CSI Post-servicio
```
Trigger: Cron diario a las 10:00 AM
→ Query: OTs en estado 'entregado' hace exactamente 48h sin csi_enviado_at
  (O bien: trigger por lectura del archivo de CSI que envíe el DMS)
→ Por cada OT:
   → Si condicion_csi = 'feliz' o csi_calificacion >= 7:
     → Bot WA: "¿Nos dejarías una reseña? [link Google]"
     → Marcar resena_google_solicitada = true
   → Si condicion_csi = 'no_feliz' o csi_calificacion < 7:
     → Crear actividad urgente para agente MK
     → WA al agente MK
     → Email al agente MK
     → Crear evento en Outlook del agente MK
```

### n8n-006 — Outlook Calendar Sync
```
Trigger: Webhook desde Supabase cuando se crea/actualiza una actividad
→ Obtener usuario asignado y su outlook_refresh_token
→ Microsoft Graph API:
   → Si outlook_event_id es null: crear evento
   → Si existe: actualizar evento
   → Si actividad cancelada: eliminar evento
→ Guardar outlook_event_id en Supabase
```

---

## REFERENCIAS DE DISEÑO

El mockup completo está en `mockup_producto.html` — ábrelo en el browser para ver
exactamente cómo se debe ver cada pantalla. El color scheme es:

```javascript
// Colores por módulo (usar en TailwindCSS con clases personalizadas)
const COLORES = {
  crm: '#3b82f6',        // azul
  citas: '#1db870',      // verde
  taller: '#8b5cf6',     // morado
  refacciones: '#f59e0b', // ámbar
  ventas: '#f43f5e',     // rojo
  bandeja: '#06b6d4',    // cian
}

// Tema base (dark)
const TEMA = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#1c2128',
  border: '#21262d',
  text: '#e6edf3',
  muted: '#8b949e',
}
```

---

## PREGUNTAS FRECUENTES PARA CLAUDE CODE

**P: ¿Cuándo debo enviar un WA?**
R: Siempre verificar primero `lib/utils/horario-bot.ts` — si está fuera del horario (8am-7:30pm),
guardar en `notificaciones_encoladas` con `enviar_at` del siguiente día a las 8am.

**P: ¿Cómo evitar duplicar clientes?**
R: Buscar primero por `whatsapp + sucursal_id`. Si no hay → buscar por `vin` en vehículos.
Solo crear nuevo si definitivamente no existe.

**P: ¿Qué actividades debo crear automáticamente?**
R: Toda acción importante del sistema genera una actividad en CRM:
- Bot envía WA → actividad tipo 'wa_enviado'
- Bot actúa por encargada → actividad tipo 'contacto' con creada_por=bot
- Pieza llega → actividad tipo 'tarea' para encargada
- CSI bajo → actividad tipo 'llamada' urgente para MK

**P: ¿Cómo funciona el link de seguimiento de OT?**
R: Cada OT tiene un `token_seguimiento` único (UUID random). 
La ruta pública `/seguimiento/[token]` no requiere auth y muestra el estado actual.
El cliente recibe este link por WA cuando lleva su vehículo.

