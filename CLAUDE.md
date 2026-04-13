# CLAUDE.md — ServiceTrack
## Plataforma SaaS de Gestión de Servicio Postventa Automotriz

Este archivo es la ÚNICA fuente de verdad para Claude Code.
Lee también: PRODUCT_MASTER.md · SUPABASE_SCHEMA.sql · TECH_STACK.md · N8N_WORKFLOWS.md · INSTRUCCIONES_PROYECTO_CLAUDE.md

---

## IDENTIDAD DEL PROYECTO

- **Nombre**: ServiceTrack (nombre de trabajo — definir nombre comercial al terminar el producto)
- **Repo**: github.com/miabascacal/servicetrack
- **Deploy**: servicetrack-one.vercel.app
- **Tipo**: SaaS vertical automotriz — gestión de postventa para concesionarios en México
- **Stack**: Next.js 14 + TypeScript + TailwindCSS + Supabase + Claude API + n8n + shadcn/ui + Vercel
- **DMS piloto**: Autoline (exporta CSV/Excel)
- **Horario del bot**: 8:00 AM – 7:30 PM hora México (mensajes fuera de horario se encolan para el día siguiente)
- **WhatsApp-first**: toda comunicación con el cliente es por WA como canal principal

---

## ARQUITECTURA DE 6 MÓDULOS

```
CRM (corazón) ← todos los módulos leen y escriben aquí
├── CITAS        — SF · Seekop · ClearMechanic · Drive → Kanban 5 columnas → timer 15 min
├── TALLER       — OTs · seguimiento · piezas · CSI · venta perdida · escalación 3 niveles
├── REFACCIONES  — maestro partes · cotización PDF OEM · seguimiento bot
├── VENTAS       — pipeline Kanban · leads · cruce servicio→venta
└── BANDEJA+IA   — WA · FB · IG · Email unificados · bot activo · supervisión
```

**Regla de oro**: ningún módulo funciona solo — todo converge en el CRM.

---

## REGLAS DE DESARROLLO — OBLIGATORIAS

1. **Nunca romper funcionalidad existente** — solo agregar o mejorar
2. **TypeScript estricto** — prohibido usar `any`
3. **shadcn/ui** como base de todos los componentes UI
4. **TailwindCSS dark theme** — `#0d1117` como fondo base
5. **Supabase** para todo: auth, BD, storage, realtime, edge functions
6. **RLS activo** en todas las tablas desde el inicio — nunca desactivar
7. **n8n** para automatizaciones — nunca lógica de WA dentro de Next.js directamente
8. **Claude API** para: clasificar mensajes, generar WA personalizados, sugerencias IA
9. Cada variable nueva lleva **comentario inline** explicando su propósito
10. Antes de enviar cualquier WA: **verificar horario del bot** (8am–7:30pm)

---

## COLORES POR MÓDULO (usar siempre estos, no inventar otros)

```typescript
const MODULE_COLORS = {
  crm:         '#3b82f6',  // azul
  citas:       '#1db870',  // verde
  taller:      '#8b5cf6',  // morado
  refacciones: '#f59e0b',  // ámbar
  ventas:      '#f43f5e',  // rojo
  bandeja:     '#06b6d4',  // cian
} as const
```

Fondo base del tema:
```typescript
const THEME = {
  bg:       '#0d1117',
  surface:  '#161b22',
  surface2: '#1c2128',
  border:   '#21262d',
  text:     '#e6edf3',
  muted:    '#8b949e',
} as const
```

---

## FLUJOS CRÍTICOS — LOS MÁS IMPORTANTES DEL MVP

### 1. Timer 15 min — CITAS (el más importante)
- Cuando se importa una cita, se crea un "Contacto pendiente" en la agenda de la encargada
- Tiene 15 minutos para llamar o enviar WA al cliente
- Si no actúa en 15 min → n8n envía WA automático al cliente con:
  nombre, fecha, hora, sucursal y **link de Google Maps**
- CRM registra si lo hizo la encargada o el bot
- Ver: `lib/utils/horario-bot.ts`

### 2. Pieza llega → encargada agenda cita
- Asesor registra llegada de pieza con 1 clic
- Bot WA al cliente con botón interactivo [Sí, quiero agendar]
- Cliente toca el botón → Bot responde: "Perfecto, en breve te contactamos"
- CRM crea actividad urgente para encargada de citas
- Encargada recibe: WA urgente + Email + actividad en agenda CRM + evento Outlook

### 3. CSI Post-servicio (48h)
- Archivo llega con condición: feliz | no_feliz
- Feliz → Bot WA con link de reseña Google
- No feliz → Actividad urgente para MK + WA + Email + Outlook

### 4. Venta perdida → recuperación
- Cliente rechazó reparación adicional → queda en "Venta Perdida"
- Bot WA con botón [Agendar servicio] según timing (30/60/90 días)
- Si cliente responde → actividad en agenda encargada + WA + Outlook

### 5. Escalación OT — 3 niveles
- 4h sin actualizar → WA al asesor
- +2h → WA al gerente
- +1h → Bot actúa por el asesor (WA al cliente con último estado)

---

## MODELO DE ACTIVIDADES (regla universal)

Toda actividad creada en CRM se vincula SIEMPRE a:
- `usuario_asignado_id` (obligatorio)
- `cliente_id` (obligatorio)
- `vehiculo_id` (si aplica)
- `empresa_id` (si es flotilla)
- `ot_id` / `cita_id` / `cotizacion_id` (según contexto)
- `outlook_event_id` (sync automático con Outlook del usuario)

La vista "Actividades del cliente" muestra TODO cronológicamente:
llamadas, WA, citas, OTs, cotizaciones, CSI — filtrable y exportable.

---

## PRIORIDAD DE DESARROLLO

### ✅ Ya existe (no reconstruir)
- Proyecto Next.js 14 inicializado
- Estructura de carpetas: `app/`, `hooks/`, `lib/`, `types/`, `scripts/`, `supabase/`
- `middleware.ts` con auth Supabase
- Configuraciones: `next.config.ts`, `tsconfig.json`, `vercel.json`, `eslint.config.mjs`
- Documentación: `PRODUCT_MASTER.md`, `SUPABASE_SCHEMA.sql`, `TECH_STACK.md`, `N8N_WORKFLOWS.md`
- Mockups: `mockup_producto.html`, `crm_v4.html`
- Deploy activo en Vercel: `servicetrack-one.vercel.app`

### 🔲 Sprint actual — CRM base
- [ ] Layout principal: Sidebar + Topbar + AppShell (dark theme)
- [ ] Auth: login / logout con Supabase Auth
- [ ] Dashboard con KPIs del día
- [ ] CRM: lista de clientes con búsqueda
- [ ] CRM: perfil del cliente (Driver 360) con vehículos y actividades

### 🔲 Siguiente — CITAS
- [ ] Kanban de citas con 5 columnas drag & drop
- [ ] Timer de 15 minutos visible con barra de color (verde→amarillo→rojo)
- [ ] Importador de archivos CSV/Excel
- [ ] n8n: WA de confirmación + Google Maps
- [ ] Outlook sync para agenda de la encargada

### 🔲 Después — TALLER
- [ ] Kanban de OTs con 5 estados
- [ ] Link público de seguimiento `/seguimiento/[token]` (sin auth)
- [ ] Bot WA por cambio de estado
- [ ] Escalación automática 3 niveles
- [ ] Flujo pieza pendiente → notificación encargada
- [ ] CSI 48h post-entrega

---

## ESTRUCTURA DE CARPETAS ESPERADA

```
app/
├── (auth)/login/           — página de login
├── (dashboard)/
│   ├── layout.tsx          — Sidebar + Topbar
│   ├── dashboard/          — KPIs generales
│   ├── crm/                — lista y perfil de clientes
│   ├── citas/              — Kanban + calendario
│   ├── taller/             — Kanban OTs
│   ├── refacciones/        — cotizaciones + partes
│   ├── ventas/             — pipeline
│   ├── bandeja/            — mensajes unificados
│   └── agenda/             — actividades del usuario
├── seguimiento/[token]/    — página pública sin auth
└── api/
    ├── webhooks/whatsapp/  — respuestas de clientes
    └── webhooks/n8n/       — triggers de automatizaciones

components/
├── ui/                     — shadcn/ui base
├── layout/                 — Sidebar, Topbar, AppShell
├── crm/                    — ClienteCard, ClientePerfil, ActividadTimeline
├── citas/                  — KanbanCitas, CitaCard, Timer15min, ImportarArchivo
├── taller/                 — KanbanOTs, OTCard, OTDetalle
└── shared/                 — KanbanBoard, StatusBadge, ActivityForm
```

---

## VARIABLES DE ENTORNO REQUERIDAS (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# n8n
N8N_WEBHOOK_BASE_URL=
N8N_API_KEY=

# WhatsApp (Twilio / 360dialog / Meta — por definir)
WA_PROVIDER=
WA_API_URL=
WA_API_TOKEN=
WA_PHONE_NUMBER_ID=

# Google Maps (para links en WA de confirmación de citas)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Microsoft Graph API (Outlook Calendar sync)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
```

---

## REFERENCIAS DE DISEÑO

- **mockup_producto.html** — cómo se deben ver las 9 pantallas del producto
- **crm_v4.html** — Workflow Studio con todos los flujos y sus conexiones
- Abre estos archivos en el browser para ver el diseño exacto antes de codificar

---

## PREGUNTAS FRECUENTES PARA CLAUDE CODE

**¿Cuándo enviar un WA?**
Siempre verificar `lib/utils/horario-bot.ts`. Si está fuera del horario (8am–7:30pm hora México), guardar en `notificaciones_encoladas` con `enviar_at` del siguiente día a las 8am.

**¿Cómo evitar duplicar clientes?**
Buscar primero por `whatsapp + sucursal_id`. Si no → buscar por `vin` en vehículos. Solo crear nuevo si definitivamente no existe.

**¿Qué actividades crear automáticamente?**
Toda acción importante del sistema genera una actividad:
- Bot envía WA → `tipo: 'wa_enviado'`
- Bot actúa por encargada → `tipo: 'contacto', creada_por: null (sistema)`
- Pieza llega → `tipo: 'tarea'` urgente para encargada
- CSI bajo → `tipo: 'llamada'` urgente para MK

**¿Cómo funciona el link de seguimiento de OT?**
Cada OT tiene `token_seguimiento` (UUID random único). La ruta `/seguimiento/[token]` NO requiere auth. El cliente recibe este link por WA al llevar su vehículo.

**¿Dónde están los flujos completos del producto?**
En `PRODUCT_MASTER.md` — 26 flujos documentados con todos los pasos, bifurcaciones y KPIs.

**¿Dónde están las automatizaciones de n8n?**
En `N8N_WORKFLOWS.md` — 11 workflows con la lógica paso a paso lista para configurar.
