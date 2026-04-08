# TECH_STACK.md — Decisiones técnicas confirmadas

## Stack completo

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Frontend | Next.js 14 (App Router) | SSR, RSC, file-based routing |
| Lenguaje | TypeScript estricto | Sin `any`, tipos en todo |
| Estilos | TailwindCSS + shadcn/ui | Dark theme, componentes listos |
| Base de datos | Supabase (PostgreSQL) | Auth, RLS, Realtime, Storage |
| Automatizaciones | n8n (self-hosted o cloud) | Lectura archivos, WA, CSI, escalaciones |
| IA | Claude API (claude-sonnet-4-20250514) | Clasificación, WA personalizados, sugerencias |
| WhatsApp | Por definir: Twilio / 360dialog / Meta Business | WA Business API |
| Email | Resend o SendGrid | Transaccionales + notificaciones |
| Deploy | Vercel | Next.js nativo, edge functions |
| Dev env | GitHub Codespaces / Cursor local | |
| Control de versiones | GitHub | |

## Estructura de carpetas del proyecto

```
/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Rutas de autenticación
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Rutas protegidas del producto
│   │   ├── layout.tsx            # Sidebar + Topbar
│   │   ├── dashboard/
│   │   ├── crm/
│   │   │   ├── page.tsx          # Lista de clientes
│   │   │   └── [id]/page.tsx     # Perfil del cliente
│   │   ├── citas/
│   │   │   ├── page.tsx          # Kanban de citas
│   │   │   └── calendario/page.tsx
│   │   ├── taller/
│   │   │   ├── page.tsx          # Kanban de OTs
│   │   │   └── [id]/page.tsx     # Detalle de OT
│   │   ├── refacciones/
│   │   ├── ventas/
│   │   ├── bandeja/
│   │   ├── reportes/
│   │   └── agenda/
│   ├── seguimiento/[token]/      # Link público sin auth (estado OT)
│   └── api/                      # API routes
│       ├── webhooks/
│       │   ├── whatsapp/route.ts
│       │   └── n8n/route.ts
│       ├── citas/route.ts
│       └── ot/route.ts
├── components/
│   ├── ui/                       # shadcn/ui base
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── AppShell.tsx
│   ├── crm/
│   │   ├── ClienteCard.tsx
│   │   ├── ClientePerfil.tsx
│   │   ├── VehiculoCard.tsx
│   │   └── ActividadTimeline.tsx
│   ├── citas/
│   │   ├── KanbanCitas.tsx
│   │   ├── CitaCard.tsx          # con timer de 15 min
│   │   ├── CalendarioCitas.tsx
│   │   └── ImportarArchivo.tsx
│   ├── taller/
│   │   ├── KanbanOTs.tsx
│   │   ├── OTCard.tsx
│   │   └── OTDetalle.tsx
│   ├── bandeja/
│   │   ├── BandejaUnificada.tsx
│   │   └── ChatWindow.tsx
│   └── shared/
│       ├── KanbanBoard.tsx       # componente genérico de Kanban
│       ├── Timer15min.tsx        # timer visual con barra de color
│       ├── StatusBadge.tsx
│       └── ActivityForm.tsx      # formulario de nueva actividad
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # cliente browser
│   │   ├── server.ts             # cliente server
│   │   └── admin.ts              # cliente admin (service role)
│   ├── claude/
│   │   └── client.ts             # cliente Claude API
│   ├── n8n/
│   │   └── webhooks.ts           # funciones para disparar webhooks n8n
│   ├── outlook/
│   │   └── sync.ts               # Outlook Calendar sync
│   └── utils/
│       ├── archivos.ts           # parser de CSV/Excel
│       ├── whatsapp.ts           # helpers WA
│       └── horario-bot.ts        # validar si está en horario del bot
├── hooks/
│   ├── useCitas.ts
│   ├── useOTs.ts
│   ├── useActividades.ts
│   └── useRealtime.ts            # subscripciones Supabase Realtime
├── types/
│   ├── database.ts               # tipos generados por Supabase
│   └── app.ts                    # tipos del dominio
├── constants/
│   └── index.ts                  # estados, módulos, enums
├── CLAUDE.md                     # instrucciones para Claude Code
├── PRODUCT_MASTER.md             # documento maestro del producto
├── SUPABASE_SCHEMA.sql           # schema completo de BD
├── TECH_STACK.md                 # este archivo
└── .env.local                    # variables de entorno (NO subir a git)
```

## Convenciones de código

### Nomenclatura
- Componentes: PascalCase (`CitaCard.tsx`)
- Hooks: camelCase con `use` (`useCitas.ts`)
- Funciones utilitarias: camelCase (`parsearArchivoCitas`)
- Tipos: PascalCase con prefijo según capa (`DbCita`, `AppCita`)
- Constantes: UPPER_SNAKE_CASE (`ESTADOS_CITA`)

### Componentes
- Server Components por defecto
- `'use client'` solo cuando se necesite interactividad
- Props tipadas siempre con interface o type explícito

### Base de datos
- RLS activo en todas las tablas desde el inicio
- Todas las queries a través de Supabase client (nunca directo)
- Usar `supabase.from('tabla').select()` con tipos generados

### n8n — Automatizaciones principales a configurar
1. **Lectura de archivos**: trigger por archivo en Drive → parse → update Supabase
2. **Timer 15 min citas**: cron cada 1 min → check citas pendientes → si +15 min → enviar WA bot
3. **Seguimiento OTs**: cron cada 30 min → check OTs sin actualizar → escalación
4. **Recordatorios citas**: cron 8am → enviar WA 24h antes de citas del día siguiente
5. **CSI 48h**: cron diario → check OTs entregadas hace 48h → procesar archivo CSI
6. **Seguimiento cotizaciones**: cron diario → check cotizaciones sin respuesta → bot WA
7. **Outlook sync**: webhook activado desde Supabase → crear/actualizar evento en Outlook
8. **Cola de mensajes fuera de horario**: cron 8am → enviar mensajes encolados del día anterior

## Variables de entorno (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# n8n
N8N_WEBHOOK_BASE_URL=https://n8n.tudominio.com
N8N_API_KEY=

# WhatsApp
WA_PROVIDER=twilio              # twilio | 360dialog | meta
WA_API_URL=
WA_API_TOKEN=
WA_PHONE_NUMBER_ID=

# Google Maps (para links en WA)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Microsoft Graph API (Outlook sync)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=

# App
NEXT_PUBLIC_APP_URL=https://tuapp.com
BOT_HORA_INICIO=08:00           # hora local de la sucursal
BOT_HORA_FIN=19:30              # 7:30 PM
```
