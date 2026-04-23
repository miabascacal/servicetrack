import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LeadDetailClient from './LeadDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from('leads')
    .select(`
      id, nombre, whatsapp, email, estado, fuente, vehiculo_interes,
      presupuesto_estimado, necesidad, notas, creado_at, actualizado_at,
      cliente:clientes ( id, nombre, apellido, whatsapp ),
      asesor:usuarios!leads_asesor_id_fkey ( id, nombre, apellido )
    `)
    .eq('id', id)
    .single()

  if (!lead) notFound()

  return <LeadDetailClient lead={lead as unknown as LeadFull} />
}

export type LeadFull = {
  id: string
  nombre: string | null
  whatsapp: string | null
  email: string | null
  estado: string
  fuente: string | null
  vehiculo_interes: string | null
  presupuesto_estimado: number | null
  necesidad: string | null
  notas: string | null
  creado_at: string
  actualizado_at: string | null
  cliente: { id: string; nombre: string; apellido: string; whatsapp: string } | null
  asesor: { id: string; nombre: string; apellido: string } | null
}
