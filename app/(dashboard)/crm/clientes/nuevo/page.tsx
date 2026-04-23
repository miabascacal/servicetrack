'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Search, UserPlus, Building2, Car, CheckCircle2, ArrowRight, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createClienteAction, vincularClienteEmpresaAction, createEmpresaYVincularAction } from '@/app/actions/clientes'
import { addVehiculoPersonaAction, createVehiculoYVincularAction } from '@/app/actions/vehiculos'
import type { RolVehiculo } from '@/types/database'

type ClienteResult = { id: string; nombre: string; apellido: string; whatsapp: string; email: string | null }
type EmpresaResult = { id: string; nombre: string; rfc: string | null; telefono: string | null }
type VehiculoResult = { id: string; marca: string; modelo: string; anio: number; placa: string | null }

type WizardStep =
  | 'search'
  | 'form'
  | 'empresa_ask'
  | 'empresa_link'
  | 'vehiculo_ask'
  | 'vehiculo_link'

export default function NuevoClientePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return_to')

  // Helper: redirect to return_to with cliente_id, or to client profile
  function redirectAfterCreate(clienteId: string) {
    if (returnTo) {
      router.push(`${returnTo}?cliente_id=${clienteId}`)
    } else {
      router.push(`/crm/clientes/${clienteId}`)
    }
  }

  // Wizard state
  const [step, setStep] = useState<WizardStep>('search')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Created entities
  const [createdCliente, setCreatedCliente] = useState<{ id: string; nombre: string; apellido: string } | null>(null)
  const [linkedEmpresa, setLinkedEmpresa] = useState<{ id: string; nombre: string } | null>(null)

  // Search: clientes
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ClienteResult[]>([])
  const [searched, setSearched] = useState(false)

  // Search: empresas
  const [qEmpresa, setQEmpresa] = useState('')
  const [empresaResults, setEmpresaResults] = useState<EmpresaResult[]>([])
  const [searchedEmpresa, setSearchedEmpresa] = useState(false)
  const [showEmpresaForm, setShowEmpresaForm] = useState(false)

  // Search: vehiculos
  const [qVehiculo, setQVehiculo] = useState('')
  const [vehiculoResults, setVehiculoResults] = useState<VehiculoResult[]>([])
  const [searchedVehiculo, setSearchedVehiculo] = useState(false)
  const [showVehiculoForm, setShowVehiculoForm] = useState(false)

  // Debounced search: clientes
  useEffect(() => {
    if (q.length < 2) { setResults([]); setSearched(false); return }
    const supabase = createClient()
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, whatsapp, email')
        .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10)
      setResults(data ?? [])
      setSearched(true)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  // Debounced search: empresas
  useEffect(() => {
    if (qEmpresa.length < 2) { setEmpresaResults([]); setSearchedEmpresa(false); return }
    const supabase = createClient()
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('empresas')
        .select('id, nombre, rfc, telefono')
        .or(`nombre.ilike.%${qEmpresa}%,rfc.ilike.%${qEmpresa}%`)
        .eq('activo', true)
        .limit(10)
      setEmpresaResults(data ?? [])
      setSearchedEmpresa(true)
    }, 300)
    return () => clearTimeout(t)
  }, [qEmpresa])

  // Debounced search: vehiculos
  useEffect(() => {
    if (qVehiculo.length < 2) { setVehiculoResults([]); setSearchedVehiculo(false); return }
    const supabase = createClient()
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('vehiculos')
        .select('id, marca, modelo, anio, placa')
        .or(`marca.ilike.%${qVehiculo}%,modelo.ilike.%${qVehiculo}%,placa.ilike.%${qVehiculo}%`)
        .eq('activo', true)
        .limit(10)
      setVehiculoResults(data ?? [])
      setSearchedVehiculo(true)
    }, 300)
    return () => clearTimeout(t)
  }, [qVehiculo])

  // ── Handler: Guardar cliente ─────────────────────────────────────────────
  async function handleSubmitCliente(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await createClienteAction(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    } else if (result?.id) {
      setCreatedCliente({ id: result.id, nombre: result.nombre ?? '', apellido: result.apellido ?? '' })
      setStep('empresa_ask')
      setSaving(false)
    }
  }

  // ── Handler: Vincular empresa existente ─────────────────────────────────
  async function handleVincularEmpresa(empresa: EmpresaResult) {
    if (!createdCliente) return
    setSaving(true)
    setError(null)
    const result = await vincularClienteEmpresaAction(createdCliente.id, empresa.id)
    if (result?.error) { setError(result.error); setSaving(false); return }
    setLinkedEmpresa({ id: empresa.id, nombre: empresa.nombre })
    setSaving(false)
    setStep('vehiculo_ask')
  }

  // ── Handler: Crear empresa y vincular ────────────────────────────────────
  async function handleCreateEmpresa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!createdCliente) return
    setSaving(true)
    setError(null)
    const result = await createEmpresaYVincularAction(createdCliente.id, new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setSaving(false); return }
    if (result?.id) setLinkedEmpresa({ id: result.id, nombre: result.nombre })
    setSaving(false)
    setStep('vehiculo_ask')
  }

  // ── Handler: Vincular vehículo existente ─────────────────────────────────
  async function handleVincularVehiculo(vehiculo: VehiculoResult) {
    if (!createdCliente) return
    setSaving(true)
    setError(null)
    const result = await addVehiculoPersonaAction(vehiculo.id, createdCliente.id, 'dueno' as RolVehiculo)
    if (result?.error) { setError(result.error); setSaving(false); return }
    setSaving(false)
    redirectAfterCreate(createdCliente.id)
  }

  // ── Handler: Crear vehículo y vincular ───────────────────────────────────
  async function handleCreateVehiculo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!createdCliente) return
    setSaving(true)
    setError(null)
    const result = await createVehiculoYVincularAction(createdCliente.id, new FormData(e.currentTarget))
    if (result?.error) { setError(result.error); setSaving(false); return }
    setSaving(false)
    redirectAfterCreate(createdCliente.id)
  }

  // ── STEP: search ─────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/crm/clientes" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Nuevo Cliente</h1>
            <p className="text-sm text-gray-500 mt-0.5">Primero verifica si el cliente ya existe</p>
          </div>
          <Link href="/crm/clientes" className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Buscar cliente existente</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, apellido, WhatsApp o email..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{results.length} cliente{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}</p>
              {results.map((c) => (
                <Link
                  key={c.id}
                  href={`/crm/clientes/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                    {c.nombre[0]}{c.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.nombre} {c.apellido}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{c.whatsapp}{c.email ? ` · ${c.email}` : ''}</p>
                  </div>
                  <span className="text-xs text-blue-600 shrink-0">Ver perfil →</span>
                </Link>
              ))}
            </div>
          )}

          {searched && results.length === 0 && q.length >= 2 && (
            <p className="text-sm text-gray-500 text-center py-4">No se encontraron clientes con &ldquo;{q}&rdquo;</p>
          )}

          {searched && (
            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <UserPlus size={16} />
                {results.length === 0 ? 'Crear nuevo cliente' : 'Crear de todas formas (diferente al encontrado)'}
              </button>
            </div>
          )}

          {!searched && q.length < 2 && (
            <p className="text-xs text-gray-400 text-center pt-2">Escribe al menos 2 caracteres para buscar</p>
          )}
        </div>
      </div>
    )
  }

  // ── STEP: form ───────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <form onSubmit={handleSubmitCliente} className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setStep('search')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">Nuevo Cliente</h1>
            <p className="text-sm text-gray-500 mt-0.5">Completa los datos del cliente</p>
          </div>
          <Link href="/crm/clientes" className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Datos personales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input name="nombre" required type="text" placeholder="Juan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido paterno <span className="text-red-500">*</span></label>
              <input name="apellido" required type="text" placeholder="Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido materno</label>
              <input name="apellido_2" type="text" placeholder="García"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm text-gray-500 font-mono">+52</span>
                <input name="whatsapp" required type="tel" placeholder="5512345678" maxLength={10}
                  pattern="[0-9]{10}"
                  title="10 dígitos: lada (2-3 dígitos) + número"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <p className="text-xs text-gray-400 mt-1">10 dígitos: lada + número (ej: 5512345678)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-sm text-gray-500 font-mono">+52</span>
                <input name="telefono_contacto" type="tel" placeholder="5512345678" maxLength={10}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email principal</label>
              <input name="email" type="email" placeholder="juan@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email secundario</label>
              <input name="email_2" type="email" placeholder="alternativo@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
          <textarea name="notas" rows={3} placeholder="Notas internas sobre el cliente..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </form>
    )
  }

  // ── STEP: empresa_ask ────────────────────────────────────────────────────
  if (step === 'empresa_ask') {
    return (
      <div className="max-w-lg mx-auto mt-8 space-y-6">
        <WizardProgress step={1} />
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Cliente {createdCliente?.nombre} {createdCliente?.apellido} creado
            </h2>
            <p className="text-sm text-gray-500 mt-1">¿Deseas vincularlo con una empresa?</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep('vehiculo_ask')}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              No, continuar
            </button>
            <button
              onClick={() => setStep('empresa_link')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Building2 size={15} />
              Sí, vincular empresa
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP: empresa_link ───────────────────────────────────────────────────
  if (step === 'empresa_link') {
    return (
      <div className="max-w-lg mx-auto mt-8 space-y-4">
        <WizardProgress step={1} />

        <div className="flex items-center gap-2">
          <button onClick={() => setStep('empresa_ask')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900">Vincular con empresa</h2>
          <button onClick={() => setStep('vehiculo_ask')} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={13} /> Omitir
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {!showEmpresaForm ? (
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={qEmpresa}
                onChange={(e) => setQEmpresa(e.target.value)}
                placeholder="Buscar empresa por nombre o RFC..."
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {empresaResults.length > 0 && (
              <div className="space-y-2">
                {empresaResults.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                      {emp.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.nombre}</p>
                      {emp.rfc && <p className="text-xs text-gray-400 font-mono">{emp.rfc}</p>}
                    </div>
                    <button
                      onClick={() => handleVincularEmpresa(emp)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors shrink-0"
                    >
                      {saving ? '...' : 'Vincular'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchedEmpresa && empresaResults.length === 0 && qEmpresa.length >= 2 && (
              <p className="text-sm text-gray-500 text-center py-2">No se encontró &ldquo;{qEmpresa}&rdquo;</p>
            )}

            {searchedEmpresa && empresaResults.length === 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEmpresaForm(true)}
                  className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Building2 size={15} />
                  Crear nueva empresa
                </button>
              </div>
            )}

            {!searchedEmpresa && qEmpresa.length < 2 && (
              <p className="text-xs text-gray-400 text-center">Escribe al menos 2 caracteres para buscar</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateEmpresa} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Nueva empresa</h3>
              <button type="button" onClick={() => setShowEmpresaForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input name="nombre" required type="text" placeholder="Empresa S.A. de C.V."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">RFC</label>
                <input name="rfc" type="text" placeholder="EMP123456ABC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input name="telefono" type="tel" placeholder="+5255000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" placeholder="contacto@empresa.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowEmpresaForm(false)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-400">
                {saving ? 'Creando...' : 'Crear y vincular'}
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  // ── STEP: vehiculo_ask ───────────────────────────────────────────────────
  if (step === 'vehiculo_ask') {
    return (
      <div className="max-w-lg mx-auto mt-8 space-y-6">
        <WizardProgress step={2} />
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-5">
          {linkedEmpresa && (
            <div className="flex items-center gap-2 justify-center text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full w-fit mx-auto">
              <Building2 size={12} />
              Vinculado con {linkedEmpresa.nombre}
            </div>
          )}
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
            <Car size={26} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">¿Vincular con un vehículo?</h2>
            <p className="text-sm text-gray-500 mt-1">Agrega el auto asociado a este cliente</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => createdCliente && redirectAfterCreate(createdCliente.id)}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              No, ir al perfil
            </button>
            <button
              onClick={() => setStep('vehiculo_link')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Car size={15} />
              Sí, vincular vehículo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP: vehiculo_link ──────────────────────────────────────────────────
  if (step === 'vehiculo_link') {
    return (
      <div className="max-w-lg mx-auto mt-8 space-y-4">
        <WizardProgress step={2} />

        <div className="flex items-center gap-2">
          <button onClick={() => setStep('vehiculo_ask')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900">Vincular con vehículo</h2>
          <button onClick={() => createdCliente && redirectAfterCreate(createdCliente.id)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={13} /> Omitir
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {!showVehiculoForm ? (
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={qVehiculo}
                onChange={(e) => setQVehiculo(e.target.value)}
                placeholder="Buscar por marca, modelo o placa..."
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {vehiculoResults.length > 0 && (
              <div className="space-y-2">
                {vehiculoResults.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Car size={15} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{v.marca} {v.modelo} {v.anio}</p>
                      {v.placa && <p className="text-xs text-gray-400 font-mono">{v.placa}</p>}
                    </div>
                    <button
                      onClick={() => handleVincularVehiculo(v)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors shrink-0"
                    >
                      {saving ? '...' : 'Vincular'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchedVehiculo && vehiculoResults.length === 0 && qVehiculo.length >= 2 && (
              <p className="text-sm text-gray-500 text-center py-2">No se encontró &ldquo;{qVehiculo}&rdquo;</p>
            )}

            {searchedVehiculo && vehiculoResults.length === 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVehiculoForm(true)}
                  className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Car size={15} />
                  Crear nuevo vehículo
                </button>
              </div>
            )}

            {!searchedVehiculo && qVehiculo.length < 2 && (
              <p className="text-xs text-gray-400 text-center">Escribe al menos 2 caracteres para buscar</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateVehiculo} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Nuevo vehículo</h3>
              <button type="button" onClick={() => setShowVehiculoForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Marca <span className="text-red-500">*</span></label>
                <input name="marca" required type="text" placeholder="Toyota"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Modelo <span className="text-red-500">*</span></label>
                <input name="modelo" required type="text" placeholder="Corolla"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Año <span className="text-red-500">*</span></label>
                <input name="anio" required type="number" placeholder="2022" min="1990" max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Placa</label>
                <input name="placa" type="text" placeholder="ABC-1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                <input name="color" type="text" placeholder="Blanco"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">VIN / Número de serie</label>
              <input name="vin" type="text" placeholder="1HGBH41JXMN109186"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowVehiculoForm(false)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400">
                {saving ? 'Creando...' : 'Crear y vincular'}
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return null
}

// ── Wizard Progress Indicator ─────────────────────────────────────────────
function WizardProgress({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
          <CheckCircle2 size={14} className="text-white" />
        </div>
        <span className="text-xs font-medium text-green-700">Cliente</span>
      </div>
      <ArrowRight size={14} className="text-gray-300" />
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          2
        </div>
        <span className={`text-xs font-medium ${step >= 1 ? 'text-blue-700' : 'text-gray-400'}`}>Empresa</span>
      </div>
      <ArrowRight size={14} className="text-gray-300" />
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          3
        </div>
        <span className={`text-xs font-medium ${step >= 2 ? 'text-blue-700' : 'text-gray-400'}`}>Vehículo</span>
      </div>
    </div>
  )
}
