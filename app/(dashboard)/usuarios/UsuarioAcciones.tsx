'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, KeyRound, RefreshCw, UserMinus, UserCheck, Trash2 } from 'lucide-react'
import {
  reenviarInvitacionAction,
  resetPasswordAdminAction,
  desactivarUsuarioAction,
  reactivarUsuarioAction,
  borrarUsuarioAction,
} from '@/app/actions/usuarios'

interface Props {
  usuarioId: string
  authStatus: 'active' | 'pending' | 'inactive' | 'missing'
  authStatusKnown: boolean
  activo: boolean
}

export function UsuarioAcciones({ usuarioId, authStatus, authStatusKnown, activo }: Props) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!msg) return
    const timer = window.setTimeout(() => setMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [msg])

  function handleReenviar() {
    const fd = new FormData()
    fd.set('usuario_id', usuarioId)
    startTransition(async () => {
      setMsg(null)
      const result = await reenviarInvitacionAction(fd)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: `Invitación reenviada a ${result?.email ?? 'usuario'}`, ok: true })
    })
  }

  function handleReset() {
    const fd = new FormData()
    fd.set('usuario_id', usuarioId)
    startTransition(async () => {
      setMsg(null)
      const result = await resetPasswordAdminAction(fd)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Email de reset enviado', ok: true })
    })
  }

  function handleDesactivar() {
    startTransition(async () => {
      setMsg(null)
      const result = await desactivarUsuarioAction(usuarioId)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Usuario desactivado', ok: true })
    })
  }

  function handleReactivar() {
    startTransition(async () => {
      setMsg(null)
      const result = await reactivarUsuarioAction(usuarioId)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Usuario reactivado', ok: true })
    })
  }

  function handleBorrar() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(async () => {
      setMsg(null)
      setConfirmDelete(false)
      const result = await borrarUsuarioAction(usuarioId)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Usuario eliminado', ok: true })
    })
  }

  if (!authStatusKnown) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-amber-700">Estado Auth no disponible</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {msg && (
        <span
          className={`max-w-xs text-right text-xs px-2 py-1 rounded ${
            msg.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}
        >
          {msg.text}
        </span>
      )}

      <div className="flex items-center gap-1 flex-wrap justify-end">
        {authStatus === 'pending' && (
          <button
            onClick={handleReenviar}
            disabled={isPending}
            title="Reenviar invitación"
            className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 px-2 py-1 rounded transition-colors"
          >
            <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
            {isPending ? '...' : 'Reenviar'}
          </button>
        )}

        {authStatus === 'active' && (
          <button
            onClick={handleReset}
            disabled={isPending}
            title="Enviar email de reset de contraseña"
            className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 px-2 py-1 rounded transition-colors"
          >
            <KeyRound size={12} />
            {isPending ? '...' : 'Reset'}
          </button>
        )}

        {activo && authStatus !== 'pending' ? (
          <button
            onClick={handleDesactivar}
            disabled={isPending}
            title="Desactivar usuario"
            className="flex items-center gap-1 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-50 px-2 py-1 rounded transition-colors"
          >
            <UserMinus size={12} />
            {isPending ? '...' : 'Desactivar'}
          </button>
        ) : !activo ? (
          <button
            onClick={handleReactivar}
            disabled={isPending}
            title="Reactivar usuario"
            className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50 px-2 py-1 rounded transition-colors"
          >
            <UserCheck size={12} />
            {isPending ? '...' : 'Reactivar'}
          </button>
        ) : null}

        {(authStatus === 'pending' || authStatus === 'missing' || !activo) && (
          <button
            onClick={handleBorrar}
            disabled={isPending}
            title={confirmDelete ? 'Confirmar eliminación' : 'Eliminar usuario'}
            className={`flex items-center gap-1 text-xs disabled:opacity-50 px-2 py-1 rounded transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-red-500 hover:bg-red-50'
            }`}
          >
            <Trash2 size={12} />
            {isPending ? '...' : confirmDelete ? '¿Confirmar?' : 'Eliminar'}
          </button>
        )}

        {authStatus === 'missing' && (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle size={12} />
            Sin Auth
          </span>
        )}
      </div>
    </div>
  )
}
