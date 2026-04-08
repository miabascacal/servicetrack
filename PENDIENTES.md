# PENDIENTES — ServiceTrack
_Actualizado: 2026-04-08_

---

## ✅ COMPLETADO

- [x] Búsqueda multi-palabra ("Miguel Abascal" funciona)
- [x] Vehículos duplicados en tarjetas de búsqueda
- [x] Página `/crm/vehiculos/[id]` — detalle con verificación, empresa, personas
- [x] Página `/crm/vehiculos/[id]/editar` — todos los campos incluyendo versión, verificación
- [x] Página `/crm/clientes/[id]/editar`
- [x] Página `/crm/empresas/[id]` — detalle con clientes vinculados
- [x] Campos verificación en vehículo: `fecha_verificacion`, `proxima_verificacion`, `lugar_verificacion`, `version` (SQL + form + detalle)
- [x] `empresa_id` en `vehiculos` (SQL agregado)
- [x] Sección Empresa en perfil del cliente (vincular/desvincular con modal de búsqueda)
- [x] Sección Vehículos en perfil del cliente (vincular/desvincular con modal)
- [x] Sección Empresa en detalle del vehículo (vincular/desvincular)
- [x] Al vincular empresa→cliente con vehículos: pregunta si también vincular vehículo(s), con checkboxes para elegir cuáles
- [x] Agenda: actividades ahora se muestran (RLS fix → admin client)
- [x] Citas: error al crear arreglado + mensajes de error específicos
- [x] Campos obligatorios en form editar vehículo: color, placa, VIN (17 chars)
- [x] Intervalo de servicio en form editar vehículo

---

## 🔴 PENDIENTE — SOLICITADO Y NO IMPLEMENTADO

### 1. Campos obligatorios en forms de CREAR (no solo editar)

**Vehículo — form `/crm/vehiculos/nuevo`:**
El form actual NO tiene como obligatorios: color, placa, VIN, versión.
Solo son obligatorios en el form de editar. Hay que igualarlos.

**Cliente — form `/crm/clientes/nuevo`:**
- Email → pediste que sea obligatorio. Actualmente NO lo es.

**Empresa — form `/crm/empresas/nuevo`:**
- RFC → pediste que sea obligatorio. Actualmente NO lo es.
- Contacto vinculado → pediste que sea obligatorio al crear. Actualmente NO lo es.

---

### 2. Detección de duplicados en tiempo real

Al escribir en los inputs, al salir del campo (onBlur) buscar si ya existe:
- **Cliente:** teléfono → "⚠ Ya existe [Nombre Apellido] con este teléfono"
- **Cliente:** email → "⚠ Ya existe [Nombre Apellido] con este email"
- **Vehículo:** placa → "⚠ Ya existe [Marca Modelo año] con esta placa"
- **Vehículo:** VIN → "⚠ Ya existe [Marca Modelo año] con este VIN"

Aplica tanto en crear como en editar. NO bloquea el guardado, solo advierte.

---

### 3. Permisos para eliminar registros duplicados

Solo usuarios con rol `admin` o `gerente` pueden eliminar registros.
- Verificar rol en server action antes de DELETE
- Botón eliminar solo visible si `usuario.rol in ['admin', 'gerente']`

---

### 4. Sistema de permisos — "¿Qué permisos tengo?"

- Pantalla `/usuarios/mi-perfil` que muestre el rol del usuario logueado y qué puede hacer
- Tabla de permisos por rol (qué módulos puede ver/editar/eliminar)
- Admin puede cambiar rol de usuarios de su sucursal desde `/usuarios`
- Nuevo rol `super_admin` que ve todos los grupos (para ti como dueño del sistema)

**Jerarquía:** `super_admin > admin > gerente > asesor_servicio > viewer`

---

### 5. Módulo de Auditoría

Historial de cambios en cualquier registro: quién editó qué campo, valor anterior vs nuevo.
Mostrar mínimo los últimos 5 cambios por registro.

**SQL a correr primero:**
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

**Implementación:** desde server actions — antes de UPDATE leer valores actuales, después guardar diff en `auditoria`.

---

### 6. Módulo Configuración en sidebar

Nuevo item ⚙ Configuración con sub-módulos:
- **Usuarios y Permisos** → ya existe `/usuarios`, solo moverlo aquí
- **Auditoría** → ver punto 5
- **Mi Sucursal** → editar nombre, teléfono, whatsapp, horarios
- **Errores del sistema** → log técnico de errores (tabla `error_logs`)

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

### 7. Página editar empresa `/crm/empresas/[id]/editar`

El botón "Editar" en el detalle de empresa ya existe pero da 404.
Campos: nombre, RFC, teléfono, email.

---

### 8. Página editar cliente — sección vinculación

En `/crm/clientes/[id]/editar` actualmente NO hay sección para vincular/desvincular empresa o vehículos.
Esos controles solo existen en el perfil (`/crm/clientes/[id]`).
Pediste que también estén en la pantalla de edición.
_(Baja prioridad si ya están accesibles desde el perfil)_

---

## 🟡 NO SOLICITADO TODAVÍA (a futuro)

- Módulo Taller / OTs completo
- Módulo Cotizaciones completo
- Módulo Citas con kanban
- WhatsApp / Bandeja de mensajes
- CSI / Encuestas
- Reportes
- Ventas / Leads
