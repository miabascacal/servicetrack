'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, KeyRound } from 'lucide-react'
import { reenviarInvitacionAction, resetPasswordAdminAction } from '@/app/actions/usuarios'

interface Props {
  usuarioId: string
  invitePending: boolean
}

export function UsuarioAcciones({ usuarioId, invitePending }: Props) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReenviar() {
    const fd = new FormData()
    fd.set('usuario_id', usuarioId)
    startTransition(async () => {
      const result = await reenviarInvitacionAction(fd)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Invitación reenviada', ok: true })
      setTimeout(() => setMsg(null), 3000)
    })
  }

  function handleReset() {
    const fd = new FormData()
    fd.set('usuario_id', usuarioId)
    startTransition(async () => {
      const result = await resetPasswordAdminAction(fd)
      if (result?.error) setMsg({ text: result.error, ok: false })
      else setMsg({ text: 'Email de reset enviado', ok: true })
      setTimeout(() => setMsg(null), 3000)
    })
  }

  return (
    <div className="flex items-center justify-end gap-1 relative">
      {msg && (
        <span className={`absolute right-full mr-2 whitespace-nowrap text-xs px-2 py-1 rounded ${
          msg.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {msg.text}
        </span>
      )}
      {invitePending ? (
        <button
          onClick={handleReenviar}
          disabled={isPending}
          title="Reenviar invitación"
          className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 px-2 py-1 rounded transition-colors"
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          Reenviar
        </button>
      ) : (
        <button
          onClick={handleReset}
          disabled={isPending}
          title="Enviar email de reset de contraseña"
          className="flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 px-2 py-1 rounded transition-colors"
        >
          <KeyRound size={12} className={isPending ? 'animate-spin' : ''} />
          Reset contraseña
        </button>
      )}
    </div>
  )
}
