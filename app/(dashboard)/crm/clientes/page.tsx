'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Plus, User, Building2, Car, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type VehiculoInfo = { id: string; marca: string; modelo: string; anio: number; placa: string | null }
type EmpresaInfo  = { id: string; nombre: string; rfc: string | null }

type ClienteCard = {
  tipo: 'cliente'
  id: string
  nombre: string
  apellido: string
  whatsapp: string | null
  email: string | null
  activo: boolean
  empresa: EmpresaInfo | null
  vehiculos: VehiculoInfo[]
}

type EmpresaCard = {
  tipo: 'empresa'
  id: string
  nombre: string
  rfc: string | null
  telefono: string | null
  activo: boolean
  clientes: { id: string; nombre: string; apellido: string }[]
}

type VehiculoCard = {
  tipo: 'vehiculo'
  id: string
  marca: string
  modelo: string
  anio: number
  placa: string | null
  color: string | null
  personas: { id: string; nombre: string; apellido: string; rol: string }[]
}

type AnyCard = ClienteCard | EmpresaCard | VehiculoCard

export default function ClientesPage() {
  const [q, setQ] = useState('')
  const [cards, setCards] = useState<AnyCard[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setCards([]); setSearched(false); return }
    setLoading(true)
    const supabase = createClient()

    // Split by spaces so "miguel abascal" matches nombre="Miguel" AND apellido="Abascal"
    // Also include uppercase variant so "v28" matches "V288MJ" (placa/VIN stored uppercase)
    const rawWords = query.trim().split(/\s+/).filter(Boolean)
    const words = [...new Set([...rawWords, ...rawWords.map(w => w.toUpperCase())])]
    const orFilter = (fields: string[]) =>
      words.flatMap(w => fields.map(f => `${f}.ilike.%${w}%`)).join(',')

    const [{ data: clientes }, { data: empresas }, { data: vehiculos }] = await Promise.all([
      supabase.from('clientes')
        .select(`
          id, nombre, apellido, whatsapp, email, activo,
          empresa:empresas ( id, nombre, rfc ),
          vehiculos:vehiculo_personas (
            rol_vehiculo,
            vehiculo:vehiculos ( id, marca, modelo, anio, placa )
          )
        `)
        .or(orFilter(['nombre', 'apellido', 'whatsapp', 'email']))
        .eq('activo', true).limit(8),

      supabase.from('empresas')
        .select(`
          id, nombre, rfc, telefono, activo,
          clientes ( id, nombre, apellido )
        `)
        .or(orFilter(['nombre', 'rfc']))
        .eq('activo', true).limit(5),

      supabase.from('vehiculos')
        .select(`
          id, marca, modelo, anio, placa, color,
          vehiculo_personas (
            rol_vehiculo,
            cliente:clientes ( id, nombre, apellido )
          )
        `)
        .or(orFilter(['marca', 'modelo', 'placa', 'vin']))
        .eq('activo', true).limit(5),
    ])

    // Track IDs ya mostrados para evitar duplicados
    const clienteIds = new Set<string>()
    const empresaIds = new Set<string>()
    const vehiculoIds = new Set<string>()

    const result: AnyCard[] = []

    // Clientes con sus vinculados
    for (const c of clientes ?? []) {
      clienteIds.add(c.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emp = (c.empresa as any) as EmpresaInfo | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vps = (c.vehiculos as any[]) ?? []
      // Deduplicate vehicles by id (handles edge cases with multiple vp rows)
      const vehMap = new Map<string, VehiculoInfo>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vps.forEach((vp: any) => { if (vp.vehiculo?.id) vehMap.set(vp.vehiculo.id, vp.vehiculo) })
      result.push({
        tipo: 'cliente',
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        whatsapp: c.whatsapp,
        email: c.email,
        activo: c.activo,
        empresa: emp,
        vehiculos: Array.from(vehMap.values()),
      })
      if (emp) empresaIds.add(emp.id)
      vehMap.forEach((_, vId) => vehiculoIds.add(vId))
    }

    // Empresas no ya mostradas
    for (const e of empresas ?? []) {
      if (empresaIds.has(e.id)) continue
      empresaIds.add(e.id)
      result.push({
        tipo: 'empresa',
        id: e.id,
        nombre: e.nombre,
        rfc: e.rfc,
        telefono: e.telefono,
        activo: e.activo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clientes: ((e.clientes as any[]) ?? []).slice(0, 4),
      })
    }

    // Vehículos no ya mostrados — dedup por id Y por placa (evita mostrar registros duplicados en DB)
    const placasVistas = new Set<string>()
    for (const v of vehiculos ?? []) {
      if (vehiculoIds.has(v.id)) continue
      const placaKey = v.placa ? `${v.marca}-${v.modelo}-${v.placa}` : v.id
      if (placasVistas.has(placaKey)) continue
      placasVistas.add(placaKey)
      vehiculoIds.add(v.id)
      result.push({
        tipo: 'vehiculo',
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        placa: v.placa,
        color: v.color,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personas: ((v.vehiculo_personas as any[]) ?? [])
          .filter((vp: any) => vp.cliente)
          .map((vp: any) => ({ ...vp.cliente, rol: vp.rol_vehiculo })),
      })
    }

    setCards(result)
    setSearched(true)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(q), 300)
    return () => clearTimeout(t)
  }, [q, search])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">Busca clientes, empresas o vehículos</p>
        </div>
        <Link
          href="/crm/clientes/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo Cliente
        </Link>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, WhatsApp, email, empresa, marca, placa..."
          className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Estado vacío */}
      {!searched && q.length < 2 && (
        <div className="py-20 text-center">
          <Search size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Escribe al menos 2 caracteres para buscar</p>
        </div>
      )}

      {/* Sin resultados */}
      {searched && cards.length === 0 && (
        <div className="py-16 text-center space-y-4">
          <p className="text-sm text-gray-500">No se encontró &ldquo;{q}&rdquo;</p>
          <Link
            href="/crm/clientes/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={15} /> Crear nuevo cliente
          </Link>
        </div>
      )}

      {/* Tarjetas */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => {
            if (card.tipo === 'cliente') return <ClienteCard key={card.id} c={card} />
            if (card.tipo === 'empresa')  return <EmpresaCard  key={card.id} e={card} />
            return <VehiculoCard key={card.id} v={card} />
          })}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta Cliente ───────────────────────────────────────────
function ClienteCard({ c }: { c: ClienteCard }) {
  return (
    <Link href={`/crm/clientes/${c.id}`}
      className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-4 space-y-3 group">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
            {c.nombre[0]}{c.apellido[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {c.nombre} {c.apellido}
            </p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {c.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 shrink-0 mt-1" />
      </div>

      {/* Contacto */}
      <div className="text-xs text-gray-500 space-y-0.5">
        {c.whatsapp && <p className="font-mono">{c.whatsapp}</p>}
        {c.email && <p className="truncate">{c.email}</p>}
      </div>

      {/* Empresa vinculada */}
      {c.empresa && (
        <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
          <Building2 size={13} className="text-indigo-500 shrink-0" />
          <p className="text-xs font-medium text-indigo-700 truncate">{c.empresa.nombre}</p>
          {c.empresa.rfc && <p className="text-xs text-indigo-400 font-mono ml-auto shrink-0">{c.empresa.rfc}</p>}
        </div>
      )}

      {/* Vehículos vinculados */}
      {c.vehiculos.length > 0 && (
        <div className="space-y-1.5">
          {c.vehiculos.slice(0, 2).map((v) => (
            <div key={v.id} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
              <Car size={13} className="text-orange-500 shrink-0" />
              <p className="text-xs font-medium text-orange-700">{v.marca} {v.modelo} {v.anio}</p>
              {v.placa && <p className="text-xs text-orange-400 font-mono ml-auto shrink-0">{v.placa}</p>}
            </div>
          ))}
          {c.vehiculos.length > 2 && (
            <p className="text-xs text-gray-400 text-center">+{c.vehiculos.length - 2} vehículo(s) más</p>
          )}
        </div>
      )}
    </Link>
  )
}

// ── Tarjeta Empresa ───────────────────────────────────────────
function EmpresaCard({ e }: { e: EmpresaCard }) {
  return (
    <Link href={`/crm/empresas/${e.id}`}
      className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-4 space-y-3 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
            {e.nombre[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{e.nombre}</p>
            {e.rfc && <p className="text-xs text-gray-400 font-mono">{e.rfc}</p>}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400 shrink-0 mt-1" />
      </div>

      {e.telefono && <p className="text-xs text-gray-500 font-mono">{e.telefono}</p>}

      {e.clientes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium">{e.clientes.length} contacto(s)</p>
          {e.clientes.slice(0, 3).map((cl) => (
            <div key={cl.id} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5">
              <User size={11} className="text-blue-400 shrink-0" />
              <p className="text-xs text-blue-700">{cl.nombre} {cl.apellido}</p>
            </div>
          ))}
          {e.clientes.length > 3 && (
            <p className="text-xs text-gray-400 text-center">+{e.clientes.length - 3} más</p>
          )}
        </div>
      )}
    </Link>
  )
}

// ── Tarjeta Vehículo ──────────────────────────────────────────
function VehiculoCard({ v }: { v: VehiculoCard }) {
  return (
    <Link href={`/crm/vehiculos/${v.id}`}
      className="bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all p-4 space-y-3 group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Car size={18} className="text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
              {v.marca} {v.modelo}
            </p>
            <p className="text-xs text-gray-400">{v.anio}{v.color ? ` · ${v.color}` : ''}</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-orange-400 shrink-0 mt-1" />
      </div>

      {v.placa && (
        <div className="inline-flex items-center bg-gray-100 rounded px-2 py-1">
          <p className="text-xs font-mono font-semibold text-gray-700">{v.placa}</p>
        </div>
      )}

      {v.personas.length > 0 && (
        <div className="space-y-1.5">
          {v.personas.slice(0, 3).map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5">
              <User size={11} className="text-blue-400 shrink-0" />
              <p className="text-xs text-blue-700">{p.nombre} {p.apellido}</p>
              <span className="ml-auto text-xs text-blue-400 capitalize shrink-0">{p.rol}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
