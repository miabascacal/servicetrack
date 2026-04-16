import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import { CitasKanban } from '@/app/_components/citas/CitasKanban'
import type { EstadoCita } from '@/types/database'

export default async function CitasPage() {
  // createClient() aplica RLS — solo devuelve citas de la sucursal del usuario autenticado
  const supabase = await createClient()

  const { data: citas } = await supabase
    .from('citas')
    .select(`
      id, fecha_cita, hora_cita, estado, servicio, notas,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      vehiculo:vehiculos ( id, marca, modelo, anio, placa )
    `)
    .order('fecha_cita', { ascending: true })
    .order('hora_cita', { ascending: true })

  type CitaRow = {
    id: string
    fecha_cita: string
    hora_cita: string
    estado: EstadoCita
    servicio: string | null
    notas: string | null
    cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
    vehiculo: { id: string; marca: string; modelo: string; anio: number; placa: string | null } | null
    asesor?: null
  }

  const typedCitas = (citas as unknown as CitaRow[]) ?? []

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Citas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {typedCitas.length} cita{typedCitas.length !== 1 ? 's' : ''} activa{typedCitas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/citas/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nueva Cita
        </Link>
      </div>

      {/* Kanban */}
      <CitasKanban citas={typedCitas} />
    </div>
  )
}
