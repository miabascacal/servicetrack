export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// --- ENUMS ---
export type RolVehiculo = 'dueno' | 'conductor' | 'otro'
export type EstadoVerificacion = 'vigente' | 'por_vencer' | 'vencida' | 'no_aplica'
export type EstadoCita =
  | 'pendiente_contactar'
  | 'contactada'
  | 'confirmada'
  | 'en_agencia'
  | 'show'
  | 'no_show'
  | 'cancelada'
export type EstadoOT =
  | 'recibido'
  | 'diagnostico'
  | 'en_reparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado'
export type ModuloPermiso =
  | 'crm'
  | 'citas'
  | 'taller'
  | 'refacciones'
  | 'ventas'
  | 'bandeja'
  | 'atencion_clientes'
  | 'csi'
  | 'seguros'
  | 'usuarios'
  | 'reportes'

// --- DATABASE TYPES ---
export interface Grupo {
  id: string
  nombre: string
  rfc?: string
  logo_url?: string
  activo: boolean
  created_at: string
}

export interface Sucursal {
  id: string
  grupo_id: string
  nombre: string
  direccion?: string
  telefono?: string
  activo: boolean
  created_at: string
}

export interface Usuario {
  id: string
  grupo_id: string
  sucursal_id?: string
  nombre: string
  apellido: string
  email: string
  whatsapp?: string
  activo: boolean
  created_at: string
}

export interface Empresa {
  id: string
  grupo_id: string
  nombre: string
  rfc?: string
  telefono?: string
  email?: string
  activo: boolean
  created_at: string
}

export interface Cliente {
  id: string
  grupo_id: string
  empresa_id?: string
  nombre: string
  apellido: string
  apellido_2?: string
  email?: string
  email_2?: string
  telefono_contacto?: string
  telefono_alterno?: string
  whatsapp: string
  activo: boolean
  created_at: string
}

export interface Vehiculo {
  id: string
  grupo_id: string
  vin?: string
  placa?: string
  marca: string
  modelo: string
  anio: number
  color?: string
  km_actual?: number
  km_garantia?: number
  fecha_compra?: string
  fecha_fin_garantia?: string
  garantia_ext_inicio?: string
  garantia_ext_fin?: string
  intervalo_servicio_meses: number
  proxima_servicio?: string
  fecha_verificacion?: string
  proxima_verificacion?: string
  estado_verificacion: EstadoVerificacion
  activo: boolean
  created_at: string
}

export interface VehiculoPersona {
  vehiculo_id: string
  cliente_id: string
  rol_vehiculo: RolVehiculo
  created_at: string
}

export interface Rol {
  id: string
  grupo_id: string
  nombre: string
  descripcion?: string
  es_super_admin: boolean
  activo: boolean
  created_at: string
}

export interface RolPermiso {
  id: string
  rol_id: string
  modulo: ModuloPermiso
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

export interface Cita {
  id: string
  grupo_id: string
  sucursal_id: string
  cliente_id: string
  vehiculo_id: string
  asesor_id?: string
  fecha_cita: string
  hora_cita: string
  estado: EstadoCita
  motivo?: string
  notas_previas?: string
  activa: boolean
  created_at: string
}

export interface OrdenTrabajo {
  id: string
  grupo_id: string
  sucursal_id: string
  cita_id?: string
  cliente_id: string
  vehiculo_id: string
  asesor_id?: string
  estado: EstadoOT
  km_ingreso?: number
  diagnostico?: string
  notas_internas?: string
  created_at: string
  updated_at: string
}

// --- HELPER TYPES ---
export interface PermisoModulo {
  puede_ver: boolean
  puede_crear: boolean
  puede_editar: boolean
  puede_eliminar: boolean
  puede_exportar: boolean
}

export interface UserSession {
  id: string
  email: string
  grupo_id: string
  sucursal_id?: string
  nombre: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    page: number
    total: number
    limit: number
  }
}
