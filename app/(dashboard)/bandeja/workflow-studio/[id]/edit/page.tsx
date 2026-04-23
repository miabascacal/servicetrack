import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditarReglaForm from './EditarReglaForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarReglaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rule } = await supabase
    .from('automation_rules')
    .select('id, nombre, descripcion, trigger_tipo, acciones, activa')
    .eq('id', id)
    .single()

  if (!rule) notFound()

  return <EditarReglaForm rule={rule as RuleData} />
}

export type RuleData = {
  id: string
  nombre: string
  descripcion: string | null
  trigger_tipo: string
  acciones: unknown[]
  activa: boolean
}
