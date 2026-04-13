<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — ServiceTrack
## Contexto del proyecto para agentes de IA

**Lee CLAUDE.md primero** — contiene todas las instrucciones de desarrollo.

## Qué es este proyecto

ServiceTrack es un SaaS vertical automotriz para gestión de postventa en México.
Gestiona: citas, taller, refacciones, ventas y comunicación — todo conectado al CRM central.

## Archivos de referencia obligatorios

Antes de escribir cualquier código, lee estos archivos en orden:

1. `CLAUDE.md` — instrucciones completas, reglas, módulos, colores, flujos críticos
2. `PRODUCT_MASTER.md` — los 26 flujos del producto con todos los pasos
3. `SUPABASE_SCHEMA.sql` — las 14 tablas de la BD con RLS y triggers
4. `TECH_STACK.md` — stack, estructura de carpetas y convenciones de código
5. `N8N_WORKFLOWS.md` — los 11 workflows de automatización para n8n
6. `mockup_producto.html` — abre en browser para ver el diseño exacto
7. `crm_v4.html` — abre en browser para ver todos los flujos conectados

## Estado actual del proyecto

- ✅ Next.js 14 inicializado con TypeScript y TailwindCSS
- ✅ Supabase conectado con middleware de auth
- ✅ Deploy en Vercel: servicetrack-one.vercel.app
- ✅ Documentación completa del producto en los archivos MD
- 🔲 Layout principal (Sidebar + Topbar) — por construir
- 🔲 Dashboard con KPIs — por construir
- 🔲 Módulo CRM — por construir
- 🔲 Módulo CITAS con Kanban — por construir

## Regla más importante

Nunca romper funcionalidad existente. Solo agregar o mejorar.
Siempre verificar el horario del bot antes de enviar WA (8am–7:30pm hora México).
Todas las actividades se vinculan a: usuario + cliente + vehículo + empresa + Outlook.
