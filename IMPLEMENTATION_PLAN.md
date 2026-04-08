# IMPLEMENTATION PLAN — ServiceTrack

**Proyecto**: SaaS de gestión de postventa automotriz para México
**Stack**: Next.js + Supabase (PostgreSQL + Auth + RLS) + shadcn/ui + n8n + Claude API
**Modelo**: Automatización de procesos por IA + WhatsApp

---

## 📅 SPRINTS (11 total)

### **SPRINT 1 — AUTH + LAYOUT (Semana 1-2)**
**Objetivo**: Base segura, multi-tenant, acceso controlado

**Tareas**:
- [ ] Setup Next.js + Supabase proyecto
- [ ] Migraciones SQL: grupos, razones_sociales, sucursales, usuarios
- [ ] Auth: login/logout con Supabase Auth
- [ ] RLS policies: get_mi_grupo_id(), get_mi_sucursal_id()
- [ ] Sidebar: nav con enlaces a módulos
- [ ] Layout base: header, sidebar collapsible
- [ ] Context/Provider: usuario logueado, grupo, sucursal
- [ ] Tests: auth flow, RLS en query
- [ ] Deploy: branch main → Vercel

**Dependencias**: ninguna (primer sprint)
**Riesgo**: RLS policies complejas, testing en Supabase

---

### **SPRINT 2 — USUARIOS & PERMISOS (Semana 3-4)**
**Objetivo**: Control granular: roles, permisos por módulo, overrides

**Tareas**:
- [ ] Migraciones SQL: roles, rol_permisos, usuario_roles, usuario_permisos_override
- [ ] Componentes: crear rol, asignar permisos matriz
- [ ] Hook: usePermisos() — valida permisos para acción
- [ ] Middleware: protege rutas según rol + módulo
- [ ] UI Admin: gestión de roles y usuarios
- [ ] Validación: no dejar crear permisos inválidos
- [ ] Tests: permisos por rol, override precedencia
- [ ] RLS: admin solo puede gestionar su grupo

**Dependencias**: Sprint 1
**Riesgo**: Override logic compleja

---

### **SPRINT 3 — CRM (Semana 5-7)**
**Objetivo**: Hub central: clientes universales, vehículos, actividades

**Tareas**:
- [ ] Migraciones SQL: clientes, empresas, vehículos, vehiculo_personas, actividades
- [ ] CRUD clientes: crear, editar, buscar por WA/VIN
- [ ] CRUD vehículos: registro con Dueño automático, multi-persona
- [ ] Validaciones: empresa min 1 cliente, vehículo min 1 Dueño
- [ ] Triggers: crear_dueno_vehiculo, validar_dueno_vehiculo, validar_max_clientes
- [ ] Driver 360: timeline historial cliente
- [ ] Actividades: crear, asignar, vincular a usuario/cliente/vehículo
- [ ] Sincronización Outlook: guardar refresh token, crear evento
- [ ] Sincronización Gmail: grabar token, crear evento en Google Calendar
- [ ] UI: vistas cliente, vehículo, actividades
- [ ] Tests: CRUD, validaciones, triggers
- [ ] Performance: índices en whatsapp, vin, cliente_id

**Dependencias**: Sprint 1, Sprint 2
**Riesgo**: Sincronización Outlook/Gmail, triggers complejos

---

### **SPRINT 4 — CITAS (Semana 8-10)**
**Objetivo**: Kanban, confirmación automática, Recepción Express

**Tareas**:
- [ ] Migraciones SQL: citas, inspecciones_vehiculo
- [ ] Kanban: 6 columnas, drag-drop
- [ ] Estados: pendiente → contactada → confirmada → en_agencia → show → no-show
- [ ] F01 Lectura archivos: CSV/Excel → importar citas
- [ ] F02 Flujo 15 min: timer visible, bot WA si no actúa, marca como "realizado por bot"
- [ ] F03 Recordatorios: 24h + 2h antes automático por n8n
- [ ] F04 No-show recovery: bot WA con opciones de reagendamiento
- [ ] F05 Campaña proactiva: detectar vehículos próximos a mantenimiento, bot WA
- [ ] F06 Recepción Express:
  - Pre-llegada WA: km, notas, cortesía (campos: prellegada_km, prellegada_notas, prellegada_cortesia)
  - Check-in: cliente toca "Ya llegué" o QR → estado='en_agencia', timer visible, notificación asesor
  - Recepción: asesor ve datos pre-llenados, inspección digital + fotos, cliente firma, OT creada automáticamente
- [ ] Reportes CSI: show-rate, tiempos, fuentes
- [ ] UI: Kanban, detalles cita, check-in form mobile
- [ ] Tests: estados, timers, n8n triggers
- [ ] N8N flows: 15min timer, recordatorios, bot WA confirmación

**Dependencias**: Sprint 3
**Riesgo**: Timing n8n (15min exacto), QR check-in mobile, sync OT creation

---

### **SPRINT 5 — TALLER (Semana 11-13)**
**Objetivo**: Órdenes de trabajo, líneas, seguimiento en tiempo real

**Tareas**:
- [ ] Migraciones SQL: ordenes_trabajo, lineas_ot
- [ ] CRUD OT: crear manual o desde cita (Recepción Express)
- [ ] Líneas OT: agregar trabajo/partes, estado, aprobación cliente
- [ ] Estados OT: abierta → en_progreso → pausa → cerrada
- [ ] Cliente ve estado real: WA automático al cambiar estado
- [ ] Venta perdida: asesor descubre necesidad → se crea automáticamente, vinculada
- [ ] Escalación automática: OT >24h sin actualizar → notificación gerente
- [ ] CSI automático: OT cierra → encuesta en 1 día (enlaza Sprint 10)
- [ ] Reportes: OTs abiertas, tiempos promedio, CSI, venta perdida
- [ ] UI: creación OT, líneas, cliente timeline
- [ ] Tests: CRUD, validaciones, escalación automática
- [ ] N8N flows: cambios estado → WA cliente, escalación >24h, CSI trigger

**Dependencias**: Sprint 3, Sprint 4
**Riesgo**: Venta perdida logic, escalación timing

---

### **SPRINT 6 — REFACCIONES (Semana 14-15)**
**Objetivo**: Maestro de partes, cotizaciones, PDF automático

**Tareas**:
- [ ] Migraciones SQL: maestro_partes (ampliado: categoria, marca, numero_alterno, precio_costo, precio_venta, margen, proveedor, tiempo_entrega)
- [ ] CRUD partes: crear catálogo, buscar
- [ ] Cotizaciones: asesor selecciona partes desde OT, sistema suma margen
- [ ] PDF cotización: auto-generado con logo agencia, cliente firma digitalmente
- [ ] Aprobación cliente: cliente firma PDF → partes se agregan a OT automáticamente
- [ ] Reportes: cotizaciones aprobadas/rechazadas, margen promedio
- [ ] UI: selector de partes, preview cotización, firma digital
- [ ] Tests: cálculo margen, PDF generation
- [ ] N8N: PDF generado → WA a cliente

**Dependencias**: Sprint 5
**Riesgo**: PDF generation, firma digital legalmente válida

---

### **SPRINT 7 — VENTAS (Semana 16-17)**
**Objetivo**: Pipeline de autos, leads, cruce servicio→venta

**Tareas**:
- [ ] Migraciones SQL: leads, oportunidades_venta (enums estado, fuente)
- [ ] Pipeline Kanban: Lead → Contacto → Cotizado → Cerrado
- [ ] Importación leads: WA, FB, IG, web, Drive
- [ ] Cruce automático: cliente en taller con auto viejo → sugerencia seminuevo
- [ ] Bot captación: WA automático a leads sin actividad en 7 días
- [ ] Reportes: pipeline, tasa cierre, ingresos por período
- [ ] UI: Kanban, detalle lead, historial interacciones
- [ ] Tests: estados, automáticos
- [ ] N8N: lead sin actividad 7 días → bot WA

**Dependencias**: Sprint 3
**Riesgo**: Integración leads desde múltiples canales

---

### **SPRINT 8 — BANDEJA + IA (Semana 18-20)**
**Objetivo**: Mensajes unificados, Claude API responde automáticamente

**Tareas**:
- [ ] Migraciones SQL: mensajes_unificados, conversaciones (campos: canal, contenido, media_url, leido)
- [ ] Integraciones:
  - WhatsApp Business API: webhook entrada, envío
  - Facebook Graph API: comentarios/mensajes privados
  - Instagram: comentarios/DMs
  - Email: IMAP/SMTP
- [ ] Claude API integration: recibe mensaje → IA genera respuesta automática
- [ ] Configuración IA: prompts custom por módulo (qué puede responder automáticamente)
- [ ] Escalación: si IA no sabe responder → marca para asesor
- [ ] Bandeja unificada: todos los mensajes en 1 lugar, filtro por canal/estado
- [ ] Reportes: mensajes por canal, tiempo respuesta bot vs humano
- [ ] UI: Bandeja, conversación, compose multi-canal
- [ ] Tests: integraciones API, prompt quality, escalation logic
- [ ] Security: rate limiting, prompt injection prevention

**Dependencias**: Sprint 3
**Riesgo**: Integraciones API externas, calidad respuestas IA, legal (GDPR, LGPD México)

---

### **SPRINT 9 — ATENCIÓN A CLIENTES (Semana 21-23)**
**Objetivo**: Quejas independiente, flujo escalación, ciclo reapertura

**Tareas**:
- [ ] Migraciones SQL: quejas (ampliado), seguimientos_queja, reglas_escalacion
- [ ] Enums: tipo_queja, area_queja, estado_queja, paso_seguimiento
- [ ] Botón flotante: en TODOS los módulos, crea queja rápido
- [ ] Flujo escalación:
  - Receptor registra
  - Encargado AC asignado automáticamente
  - Gerente área notificado si escala
  - Cliente se contacta con solución
  - Validación cliente (acepta/rechaza)
  - Cierre automático si no responde 48h
  - Reapertura si cliente rechaza
- [ ] Folio automático: AC-YYYY-NNNN (trigger)
- [ ] Seguimientos: cada paso registra actividad, responsable, timestamp
- [ ] Reportes: quejas por área, tiempos resolución, SLA, compensaciones
- [ ] UI: crear queja, timeline escalación, cliente view (estado)
- [ ] Tests: flujo completo, validaciones, SLA
- [ ] N8N: notificaciones cambio estado, escalación automática

**Dependencias**: Sprint 3
**Riesgo**: Folio uniqueness, SLA cálculos

---

### **SPRINT 10 — CSI (Semana 24-25)**
**Objetivo**: Encuestas automáticas, score bajo → queja automática

**Tareas**:
- [ ] Migraciones SQL: csi_encuestas, csi_preguntas, csi_envios, csi_respuestas
- [ ] Constructor encuestas: admin crea por módulo (taller, ventas, citas)
- [ ] Tipos pregunta: estrellas (1-5), NPS (0-10), texto, sí/no
- [ ] Token seguro: link personalizado sin login para responder
- [ ] Envío automático:
  - Post-OT: espera N días → WA con link
  - Post-venta: espera N días → WA con link
  - Post-cita: espera N días → WA con link
- [ ] Recordatorios: si no responde → recordatorio 48h, máximo 2 recordatorios
- [ ] Score bajo → queja automática: trigger crea queja en Atención a Clientes (enlaza Sprint 9)
- [ ] Reportes: NPS por sucursal/asesor, score promedio, tasa respuesta, tendencias
- [ ] UI: responder encuesta (mobile-first), ver resultados (admin)
- [ ] Tests: token uniqueness, autoencuesta logic, score calculation
- [ ] N8N: envío WA, recordatorios

**Dependencias**: Sprint 5 (taller), Sprint 7 (ventas), Sprint 4 (citas), Sprint 9 (queja automática)
**Riesgo**: Trigger CSI→Queja debe funcionar sin fallos

---

### **SPRINT 11 — SEGUROS (Semana 26-27)**
**Objetivo**: Pólizas, coberturas, alertas vencimiento

**Tareas**:
- [ ] Migraciones SQL: seguros_vehiculo, companias_seguro
- [ ] CRUD póliza: crear desde expediente vehículo
- [ ] Campos Autoline: cobertura terceros, daño vehículo, parabrisas, etc.
- [ ] Estados: M→N→C→I (Vencimiento, Novedad, Cancelación, Inactiva)
- [ ] Alertas: 30 días antes de vencer → actividad CRM + WA cliente
- [ ] Multi-aseguradora: 1 vehículo puede tener múltiples pólizas
- [ ] Reportes: pólizas por vencer, por aseguradora, alertas enviadas
- [ ] UI: registro póliza, detalles, alertas
- [ ] Tests: vencimiento alertas, triggers
- [ ] N8N: alerta 30 días → actividad CRM + WA

**Dependencias**: Sprint 3
**Riesgo**: Cálculo de vencimiento, alertas timing

---

## 🎯 POST-MVP (Sprints 12+)

- **Sprint 12**: Módulo CONFIGURACIÓN (bot scripts, schedules, escalation rules)
- **Sprint 13**: Dashboard centralizado con todos los KPIs
- **Sprint 14**: Integración DMS (Autoline, Seekop, ClearMechanic)
- **Sprint 15**: Mobile app (clientes ven estado, asesores manejan OT desde celular)

---

## 📊 ESTIMACIONES

| Sprint | Semanas | Dev | Testing | Deploy |
|---|---|---|---|---|
| 1 | 2 | 60h | 20h | 5h |
| 2 | 2 | 50h | 15h | 5h |
| 3 | 3 | 100h | 30h | 5h |
| 4 | 3 | 90h | 40h | 5h |
| 5 | 3 | 80h | 35h | 5h |
| 6 | 2 | 60h | 20h | 5h |
| 7 | 2 | 70h | 25h | 5h |
| 8 | 3 | 120h | 50h | 5h |
| 9 | 3 | 100h | 40h | 5h |
| 10 | 2 | 70h | 30h | 5h |
| 11 | 2 | 60h | 25h | 5h |
| **TOTAL** | **27 semanas** | **860h** | **330h** | **55h** |

**Equipo recomendado**: 2 devs full-time (Sprint 1-11) + 1 QA (Sprint 3+)

---

## ⚠️ RIESGOS CRÍTICOS

1. **Supabase RLS**: policies complejas pueden tener bugs. Solución: audits temprano en Sprint 1
2. **Integraciones externas**: Outlook, Gmail, WhatsApp, Facebook. Solución: usar librerías probadas
3. **N8N timing**: flujos que deben ejecutarse exactamente en tiempo X. Solución: tests exhaustivos
4. **Escalabilidad**: si crece a 100k+ mensajes/día. Solución: monitorear desde Sprint 8+
5. **Compliance legal**: GDPR, LGPD México para datos clientes. Solución: consultar legal desde Sprint 1

---

## 🚀 DEFINICIÓN DE LISTO

Cada sprint termina cuando:
- [ ] Todas las tareas ✅
- [ ] Tests ≥80% coverage
- [ ] Code review aprobado
- [ ] Deploy a staging exitoso
- [ ] Validación manual por PM/stakeholder
- [ ] Documentación actualizada
