import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, CheckCircle } from 'lucide-react'

// ── Server Actions ─────────────────────────────────────────────────────────

async function guardarEmailConfigAction(formData: FormData) {
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
    from_name: formData.get('from_name') as string,
    from_email: formData.get('from_email') as string,
    reply_to: (formData.get('reply_to') as string) || null,
    activo: true,
  }

  const admin = createAdminClient()
  if (id) {
    await admin.from('email_config').update(payload).eq('id', id)
  } else {
    await admin.from('email_config').insert(payload)
  }

  revalidatePath('/configuracion/email')
}

async function eliminarEmailConfigAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const admin = createAdminClient()
  await admin.from('email_config').delete().eq('id', id)
  revalidatePath('/configuracion/email')
}

// ── Page ───────────────────────────────────────────────────────────────────

const MODULOS = [
  { value: 'general',      label: 'General (todos los módulos)' },
  { value: 'citas',        label: 'Citas' },
  { value: 'taller',       label: 'Taller / Servicio' },
  { value: 'ventas',       label: 'Ventas' },
  { value: 'refacciones',  label: 'Refacciones' },
]

export default async function EmailConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('sucursal_id')
    .eq('id', user.id)
    .single()

  const { data: configs } = await supabase
    .from('email_config')
    .select('*')
    .eq('sucursal_id', usuario?.sucursal_id ?? '')
    .order('creado_at', { ascending: true })

  type EmailConfig = {
    id: string; nombre: string; modulo: string
    from_name: string; from_email: string; reply_to: string | null
    activo: boolean
  }
  const rows = (configs as unknown as EmailConfig[]) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Correo electrónico</h1>
          <p className="text-sm text-gray-500 mt-0.5">Remitentes de email por módulo</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Cada módulo puede tener su propio remitente (From) y dirección de respuesta (Reply-To)</li>
          <li>Si no hay config para el módulo, se usa <strong>General</strong>; si tampoco, el remitente del sistema</li>
          <li>El dominio del correo debe estar verificado en <strong>Resend</strong></li>
        </ul>
      </div>

      {/* Configs guardadas */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Remitentes configurados</h2>
          {rows.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{c.nombre}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {MODULOS.find(m => m.value === c.modulo)?.label ?? c.modulo}
                    </span>
                    {c.activo && <CheckCircle size={14} className="text-green-500" />}
                  </div>
                  <p className="text-sm text-gray-700">
                    {c.from_name} &lt;{c.from_email}&gt;
                  </p>
                  {c.reply_to && (
                    <p className="text-xs text-gray-400">Reply-To: {c.reply_to}</p>
                  )}
                </div>
                <form action={eliminarEmailConfigAction}>
                  <input type="hidden" name="id" value={c.id} />
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

      {/* Formulario nuevo remitente */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={15} />
          Agregar remitente
        </h2>
        <form action={guardarEmailConfigAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre interno <span className="text-red-500">*</span></label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del remitente <span className="text-red-500">*</span></label>
              <input
                name="from_name"
                required
                placeholder="Citas Agencia Norte"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Correo remitente <span className="text-red-500">*</span></label>
              <input
                name="from_email"
                type="email"
                required
                placeholder="citas@tuagencia.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reply-To <span className="text-gray-400">(opcional — a dónde responde el cliente)</span></label>
            <input
              name="reply_to"
              type="email"
              placeholder="respuestas@tuagencia.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Guardar remitente
          </button>
        </form>
      </div>
    </div>
  )
}
