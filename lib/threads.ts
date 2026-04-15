/**
 * lib/threads.ts
 * Utilidad central para resolver o crear conversation_threads.
 *
 * Usado por:
 *   - lib/whatsapp.ts  (mensajes salientes)
 *   - app/api/webhooks/whatsapp/route.ts  (mensajes entrantes — Sprint 8 Fase 2)
 *
 * Estados activos confirmados por los índices parciales únicos de 003_ai_foundation.sql:
 *   'open' | 'waiting_customer' | 'waiting_agent'
 *
 * Unicidad de hilos activos (enforced por BD):
 *   - Con contexto_id:  (cliente_id, canal, contexto_tipo, contexto_id) WHERE estado activo
 *   - Sin contexto_id: (cliente_id, canal, contexto_tipo) WHERE estado activo AND contexto_id IS NULL
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ── Tipos exportados ───────────────────────────────────────────────────────

export type ThreadCanal = 'whatsapp' | 'email' | 'facebook' | 'instagram' | 'interno'

/**
 * Contextos de Phase 1. 'postventa' existe en BD pero se reserva para fases posteriores.
 */
export type ThreadContextoTipo = 'general' | 'cita' | 'ot' | 'cotizacion' | 'lead'

export interface GetOrCreateThreadParams {
  sucursal_id:   string
  cliente_id:    string
  canal:         ThreadCanal
  contexto_tipo?: ThreadContextoTipo   // default: 'general'
  contexto_id?:  string               // sin valor → hilo sin contexto específico
  assignee_id?:  string               // asesor asignado al crear el hilo
}

export interface GetOrCreateThreadResult {
  thread_id: string
  created:   boolean
}

// ── Constantes ─────────────────────────────────────────────────────────────

/**
 * Estados que definen un hilo como activo.
 * Confirmados por uq_thread_activo_con_contexto y uq_thread_activo_general en 003.
 */
const ACTIVE_STATES = ['open', 'waiting_customer', 'waiting_agent'] as const

// ── Función principal ──────────────────────────────────────────────────────

/**
 * Devuelve el hilo activo existente para el cliente+canal+contexto,
 * o crea uno nuevo si no existe.
 *
 * Maneja race conditions: si dos llamadas concurrentes intentan crear el mismo
 * hilo, la que pierda la carrera recibe un error de unicidad (23505) y reintenta
 * el lookup en lugar de propagar el error.
 *
 * Lanza error real si:
 *   - El INSERT falla por una razón distinta a conflicto de unicidad
 *   - El reintento post-conflicto tampoco encuentra el hilo
 */
export async function getOrCreateThread(
  params: GetOrCreateThreadParams,
): Promise<GetOrCreateThreadResult> {
  const supabase      = createAdminClient()
  const contexto_tipo = params.contexto_tipo ?? 'general'

  // ── 1. Buscar hilo activo existente ───────────────────────────────────
  const existing = await findActiveThread(supabase, params, contexto_tipo)
  if (existing) {
    return { thread_id: existing.id, created: false }
  }

  // ── 2. Crear hilo nuevo ────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('conversation_threads')
    .insert({
      sucursal_id:  params.sucursal_id,
      cliente_id:   params.cliente_id,
      canal:        params.canal,
      contexto_tipo,
      contexto_id:  params.contexto_id  ?? null,
      thread_origin: 'outbound_manual',
      estado:       'open',
      assignee_id:  params.assignee_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // Conflicto de unicidad = race condition. Otra llamada concurrente ganó.
    if (error.code === '23505') {
      const retried = await findActiveThread(supabase, params, contexto_tipo)
      if (retried) {
        return { thread_id: retried.id, created: false }
      }
      // Si el reintento tampoco devuelve nada, hay un estado inconsistente real.
      throw new Error(`getOrCreateThread: conflicto de unicidad pero no se encontró el hilo tras reintento. sucursal=${params.sucursal_id} cliente=${params.cliente_id} canal=${params.canal}`)
    }
    throw new Error(`getOrCreateThread: ${error.message}`)
  }

  return { thread_id: data.id, created: true }
}

// ── Helper interno ─────────────────────────────────────────────────────────

async function findActiveThread(
  supabase:      ReturnType<typeof createAdminClient>,
  params:        GetOrCreateThreadParams,
  contexto_tipo: ThreadContextoTipo,
): Promise<{ id: string } | null> {
  let query = supabase
    .from('conversation_threads')
    .select('id')
    .eq('sucursal_id', params.sucursal_id)
    .eq('cliente_id',  params.cliente_id)
    .eq('canal',       params.canal)
    .eq('contexto_tipo', contexto_tipo)
    .in('estado', [...ACTIVE_STATES])

  if (params.contexto_id) {
    query = query.eq('contexto_id', params.contexto_id)
  } else {
    query = query.is('contexto_id', null)
  }

  const { data } = await query.maybeSingle()
  return data
}
