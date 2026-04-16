import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'

// ── Server Actions ─────────────────────────────────────────────────────────

async function guardarNumeroAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id')
    .eq('id', user.id)
    .single()
  if (!usuario?.sucursal_id) return

  const id = formData.get('id') as string | null

  const payload = {
    sucursal_id: usuario.sucursal_id,
    nombre: formData.get('nombre') as string,
    modulo: formData.get('modulo') as string,
    numero_display: formData.get('numero_display') as string,
    waba_id: (formData.get('waba_id') as string) || null,
    phone_number_id: formData.get('phone_number_id') as string,
    access_token: formData.get('access_token') as string,
    activo: true,
  }

  const admin = createAdminClient()
  if (id) {
    await admin.from('wa_numeros').update(payload).eq('id', id)
  } else {
    await admin.from('wa_numeros').insert(payload)
  }

  revalidatePath('/configuracion/whatsapp')
}

async function eliminarNumeroAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const admin = createAdminClient()
  await admin.from('wa_numeros').delete().eq('id', id)
  revalidatePath('/configuracion/whatsapp')
}

// ── Page ───────────────────────────────────────────────────────────────────

const MODULOS = [
  { value: 'general',      label: 'General (todos los módulos)' },
  { value: 'citas',        label: 'Citas' },
  { value: 'taller',       label: 'Taller / Servicio' },
  { value: 'ventas',       label: 'Ventas' },
  { value: 'refacciones',  label: 'Refacciones' },
]

export default async function WhatsAppConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id')
    .eq('id', user.id)
    .single()

  const { data: numeros } = await supabase
    .from('wa_numeros')
    .select('*')
    .eq('sucursal_id', usuario?.sucursal_id ?? '')
    .order('creado_at', { ascending: true })

  type WaNumero = {
    id: string; nombre: string; modulo: string; numero_display: string
    waba_id: string | null; phone_number_id: string; access_token: string
    activo: boolean; verificado: boolean
  }
  const rows = (numeros as unknown as WaNumero[]) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-0.5">Números de WhatsApp Business API por módulo</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">¿Cómo obtener las credenciales?</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Entra a <strong>Meta for Developers</strong> → tu app → WhatsApp → API Setup</li>
          <li>Copia el <strong>Phone Number ID</strong> y el <strong>Access Token</strong></li>
          <li>Pega aquí y guarda</li>
        </ol>
      </div>

      {/* Números configurados */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Números configurados</h2>
          {rows.map((n) => (
            <div key={n.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{n.nombre}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {MODULOS.find(m => m.value === n.modulo)?.label ?? n.modulo}
                    </span>
                    {n.activo ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : (
                      <XCircle size={14} className="text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{n.numero_display}</p>
                  <p className="text-xs text-gray-400 font-mono">ID: {n.phone_number_id}</p>
                </div>
                <form action={eliminarNumeroAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario nuevo número */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={15} />
          Agregar número
        </h2>
        <form action={guardarNumeroAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input
                name="nombre"
                required
                placeholder="Ej: Citas Monterrey"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Módulo <span className="text-red-500">*</span></label>
              <select
                name="modulo"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODULOS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Número (para mostrar) <span className="text-red-500">*</span></label>
            <input
              name="numero_display"
              required
              placeholder="+52 81 1234 5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">WABA ID <span className="text-gray-400">(opcional)</span></label>
            <input
              name="waba_id"
              placeholder="123456789012345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number ID <span className="text-red-500">*</span></label>
            <input
              name="phone_number_id"
              required
              placeholder="123456789012345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Access Token <span className="text-red-500">*</span></label>
            <textarea
              name="access_token"
              required
              rows={2}
              placeholder="EAAxxxxxxxxxxxxxxxx..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Guardar número
          </button>
        </form>
      </div>
    </div>
  )
}
