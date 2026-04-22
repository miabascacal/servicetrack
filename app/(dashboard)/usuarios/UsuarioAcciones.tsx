'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, KeyRound, RefreshCw } from 'lucide-react'
import { reenviarInvitacionAction, resetPasswordAdminAction } from '@/app/actions/usuarios'

interface Props {
  usuarioId: string
  authStatus: 'active' | 'pending' | 'inactive' | 'missing'
  authStatusKnown: boolean
}

export function UsuarioAcciones({ usuarioId, authStatus, authStatusKnown }: Props) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

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

  if (!authStatusKnown) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-amber-700">Estado Auth no disponible</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {msg && (
        <span
          className={`max-w-xs text-right text-xs px-2 py-1 rounded ${
            msg.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}
        >
          {msg.text}
        </span>
      )}

      {authStatus === 'pending' ? (
        <button
          onClick={handleReenviar}
          disabled={isPending}
          title="Reenviar invitación"
          className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 px-2 py-1 rounded transition-colors"
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Reenviando...' : 'Reenviar invitación'}
        </button>
      ) : authStatus === 'active' ? (
        <button
          onClick={handleReset}
          disabled={isPending}
          title="Enviar email de reset de contraseña"
          className="flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 px-2 py-1 rounded transition-colors"
        >
          <KeyRound size={12} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Enviando...' : 'Reset contraseña'}
        </button>
      ) : authStatus === 'missing' ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle size={12} />
          Revisar Auth
        </span>
      ) : (
        <span className="text-xs text-gray-400">Sin acción</span>
      )}
    </div>
  )
}
