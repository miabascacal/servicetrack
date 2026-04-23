import { createClient } from '@/lib/supabase/server'
import NuevaPolizaForm from './NuevaPolizaForm'

export default async function NuevaPolizaPage() {
  const supabase = await createClient()

  const [{ data: companias }, { data: vehiculos }] = await Promise.all([
    supabase.from('companias_seguro').select('id, nombre').order('nombre'),
    supabase
      .from('vehiculos')
      .select('id, marca, modelo, anio, placa, cliente_id, cliente:clientes(nombre, apellido)')
      .order('marca')
      .limit(300),
  ])

  return (
    <NuevaPolizaForm
      companias={(companias ?? []) as { id: string; nombre: string }[]}
      vehiculos={(vehiculos ?? []) as unknown as {
        id: string; marca: string; modelo: string; anio: number; placa: string | null;
        cliente_id: string | null;
        cliente: { nombre: string; apellido: string } | null
      }[]}
    />
  )
}
