# PENDIENTES — ServiceTrack
_Actualizado: 2026-04-13 — análisis completo de código vs IMPLEMENTATION_PLAN.md_

---

## 📊 AVANCE REAL POR SPRINT (basado en código, no en MD)

| Sprint | Nombre | % real | Estado |
|--------|--------|--------|--------|
| Sprint 1 | AUTH + LAYOUT | 80% | 🟡 Casi completo |
| Sprint 2 | USUARIOS & PERMISOS | 20% | 🔴 Incompleto |
| Sprint 3 | CRM | 65% | 🟡 En progreso |
| Sprint 4 | CITAS | 35% | 🟡 Base construida |
| Sprint 5 | TALLER | 25% | 🔴 Base construida |
| Sprint 6 | REFACCIONES | 30% | 🔴 Base construida |
| Sprint 7 | VENTAS | 2% | 🔴 Placeholder |
| Sprint 8 | BANDEJA + IA | 5% | 🔴 UI mock sin datos reales |
| Sprint 9 | ATENCIÓN A CLIENTES | 0% | ⬜ Sin empezar |
| Sprint 10 | CSI | 0% | ⬜ Sin empezar |
| Sprint 11 | SEGUROS | 0% | ⬜ Sin empezar |

**Avance global: ~24% del producto completo.**

---

## ✅ COMPLETADO (historial)

- [x] Búsqueda multi-palabra ("Miguel Abascal" funciona)
- [x] Vehículos duplicados en tarjetas de búsqueda
- [x] Página `/crm/vehiculos/[id]` — detalle con verificación, empresa, personas
- [x] Página `/crm/vehiculos/[id]/editar` — todos los campos
- [x] Página `/crm/clientes/[id]/editar`
- [x] Página `/crm/empresas/[id]` — detalle con clientes vinculados
- [x] Página `/crm/empresas/[id]/editar` — **SÍ EXISTE** (PENDIENTES anterior decía que daba 404 — ya estaba resuelto)
- [x] Campos verificación en vehículo: fecha, próxima, lugar, versión
- [x] `empresa_id` en `vehiculos`
- [x] Sección Empresa en perfil del cliente (vincular/desvincular)
- [x] Sección Vehículos en perfil del cliente (vincular/desvincular)
- [x] Sección Empresa en detalle del vehículo
- [x] Al vincular empresa→cliente con vehículos: checkboxes para elegir cuáles vincular
- [x] Agenda: actividades ahora se muestran (RLS fix → admin client)
- [x] Citas: error al crear arreglado
- [x] Campos obligatorios en form **editar** vehículo: color, placa, VIN (17 chars)
- [x] Intervalo de servicio en form editar vehículo
- [x] `lib/whatsapp.ts` — Meta Cloud API implementado
- [x] `lib/email.ts` — Resend implementado
- [x] Cron de recordatorios de citas (`app/api/cron/recordatorios-citas/route.ts`)
- [x] Server Actions para citas (`app/actions/citas.ts`)
- [x] WA automático al confirmar/cancelar cita
- [x] Refacciones: `/partes` conectado a Supabase (`maestro_partes`)
- [x] Refacciones: `/cotizaciones` conectado a Supabase (`cotizaciones`)

---

## 🔴 PENDIENTE — SOLICITADO Y NO IMPLEMENTADO

### 1. Campos obligatorios en forms de CREAR (no solo editar)

**Vehículo — `/crm/vehiculos/nuevo`:**
- color, placa, VIN (17 chars) — NO son obligatorios. Solo en editar.

**Cliente — `/crm/clientes/nuevo`:**
- email → pediste que sea obligatorio. Actualmente NO lo es.

**Empresa — `/crm/empresas/nuevo`:**
- RFC → pediste obligatorio. NO lo es.
- Contacto vinculado → pediste obligatorio al crear. NO lo es.

---

### 2. Detección de duplicados en tiempo real (onBlur)

Al salir del campo, buscar si ya existe:
- **Cliente:** teléfono → "⚠ Ya existe [Nombre] con este teléfono"
- **Cliente:** email → "⚠ Ya existe [Nombre] con este email"
- **Vehículo:** placa → "⚠ Ya existe [Marca Modelo año] con esta placa"
- **Vehículo:** VIN → "⚠ Ya existe [Marca Modelo año] con este VIN"

Aplica crear y editar. No bloquea guardado, solo advierte.

---

### 3. Permisos para eliminar registros

Solo `admin` o `gerente` pueden eliminar.
- Verificar rol en server action antes de DELETE
- Botón eliminar visible solo si `usuario.rol in ['admin', 'gerente']`

---

### 4. Sistema de permisos — pantalla "¿Qué permisos tengo?"

- Pantalla `/usuarios/mi-perfil` — rol del usuario + tabla de qué puede hacer
- Admin cambia rol de usuarios de su sucursal desde `/usuarios`
- Nuevo rol `super_admin` — ve todos los grupos

**Jerarquía:** `super_admin > admin > gerente > asesor_servicio > viewer`

---

### 5. Módulo de Auditoría

Historial de cambios: quién editó qué campo, valor anterior vs nuevo.
Mínimo últimos 5 cambios por registro.

**SQL a correr:**
```sql
CREATE TABLE auditoria (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),
  tabla TEXT NOT NULL,
  registro_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  accion TEXT NOT NULL, -- 'insert' | 'update' | 'delete'
  creado_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_auditoria_registro ON auditoria(tabla, registro_id);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
```

**Implementación:** server actions — antes de UPDATE leer valores actuales, guardar diff.

---

### 6. Módulo Configuración en sidebar

Nuevo ítem ⚙ Configuración con:
- **Usuarios y Permisos** → mover `/usuarios` aquí
- **Auditoría** → ver punto 5
- **Mi Sucursal** → editar nombre, teléfono, whatsapp, horarios
- **Errores del sistema** → tabla `error_logs`

**SQL para errores:**
```sql
CREATE TABLE error_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id),
  usuario_id UUID REFERENCES usuarios(id),
  pagina TEXT,
  accion TEXT,
  mensaje TEXT NOT NULL,
  detalle TEXT,
  creado_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 7. Página editar cliente — sección vinculación

En `/crm/clientes/[id]/editar` NO hay sección para vincular/desvincular empresa o vehículos.
Esos controles solo están en el perfil (`/crm/clientes/[id]`).
_(Baja prioridad si ya accesibles desde perfil)_

---

## 🐛 BUGS / DEUDA TÉCNICA ENCONTRADA EN ANÁLISIS (2026-04-13)

### Bug 1 — AGENTS.md desactualizado
`AGENTS.md` todavía dice que Layout, CRM y Citas están "por construir" — llevan semanas construidos.
No afecta el código pero confunde a agentes de IA en sesiones nuevas.
→ Sugerir: ¿Actualizo AGENTS.md?

### Bug 2 — TECH_STACK.md menciona n8n como capa de automatización
El proyecto PIVOTÓ a código nativo (Next.js + Vercel Cron + lib/). TECH_STACK.md aún
documenta n8n como si fuera la decisión activa.
→ Sugerir: ¿Actualizo TECH_STACK.md con la decisión de código nativo?

### Bug 3 — Migración `002_email_config.sql` SIN EJECUTAR en Supabase
La tabla `email_config` NO existe en la BD todavía. La configuración de email desde UI
fallará silenciosamente.
→ **Ejecutar en Supabase SQL Editor antes de continuar con cualquier módulo de email.**

### Bug 4 — Bandeja (`/bandeja`) usa datos DEMO, no Supabase
El código tiene el comentario: "Demo data — in production this comes from Supabase mensajes table".
La bandeja NO está conectada a datos reales.
→ Sprint 8 pendiente por completo.

### Bug 5 — `hooks/` del proyecto tiene solo archivos de Next.js hooks (no app hooks)
TECH_STACK.md documenta `useCitas.ts`, `useOTs.ts`, `useActividades.ts`, `useRealtime.ts`
como existentes. El directorio `hooks/` NO contiene ninguno de esos archivos.

### Bug 6 — `components/` no existe como carpeta raíz
TECH_STACK.md documenta `components/ui/`, `components/layout/`, `components/crm/`, etc.
El proyecto real usa `app/_components/` en su lugar.
→ TECH_STACK.md desactualizado en la estructura de carpetas.

### Bug 7 — Sprint 2 (USUARIOS & PERMISOS) incompleto sin advertencia
Las tablas `roles`, `rol_permisos`, `usuario_roles`, `usuario_permisos_override` existen
en SUPABASE_SCHEMA.sql pero:
- No hay `usePermisos()` hook
- No hay middleware de protección por rol
- No hay validación de permisos en server actions
- Los botones de eliminar son visibles para cualquier usuario

### Bug 8 — OT: flujo nunca probado completamente
Per CLAUDE.md original: "OT — verificar flujo completo — nunca se probó después de los fixes de estado"
Sigue sin verificarse.

---

## ⚠️ DECISIONES TÉCNICAS REGISTRADAS

| Decisión | Descripción |
|----------|-------------|
| n8n → código nativo | Automatizaciones implementadas con Next.js + Vercel Cron + lib/ (NO n8n) |
| WA provider | Meta Cloud API directa (no Twilio / 360dialog) |
| Email | Resend (no SendGrid) |
| `components/` | Estructura real: `app/_components/` (no `/components` en raíz) |
| Admin client | Refacciones y taller usan `createAdminClient()` para evitar RLS en listados |

---

## 🟡 NO SOLICITADO TODAVÍA — SIGUIENTES PRIORIDADES NATURALES

### Por sprint (según IMPLEMENTATION_PLAN.md):

**Sprint 3 pendiente (CRM):**
- Driver 360: timeline cronológico del cliente
- Actividades: crear actividad desde cualquier módulo (NuevaActividad.tsx existe pero sin verificar integración)
- Outlook/Gmail sync (requiere Azure app + OAuth)
- Triggers BD: crear_dueno_vehiculo, validar_max_clientes

**Sprint 4 pendiente (CITAS):**
- F01 Importar archivos CSV/Excel de citas
- F02 Timer 15 min visible + bot actúa si encargada no contacta
- F04 No-show recovery: bot WA con opciones de reagendamiento
- F05 Campaña proactiva: detectar vehículos próximos a mantenimiento
- F06 Recepción Express completa: pre-llegada WA, check-in QR, firma digital

**Sprint 5 pendiente (TALLER):**
- Líneas OT (lineas_ot): agregar trabajo/partes a una OT
- WA automático al cliente al cambiar estado de OT
- Escalación automática: OT >4h sin actualizar → notificación asesor → gerente → bot
- Venta perdida: asesor detecta necesidad → flujo recuperación
- CSI automático al cerrar OT

**Sprint 6 pendiente (REFACCIONES):**
- PDF de cotización auto-generado con logo
- Firma digital del cliente para aprobar cotización
- Al aprobar → piezas se agregan a OT automáticamente

**Sprints 7-11:** Ventas, Bandeja+IA, Atención, CSI, Seguros — por completo.
