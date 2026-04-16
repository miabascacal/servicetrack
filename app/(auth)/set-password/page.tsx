'use client'

import { useState } from 'react'
import { setPasswordAction } from '@/app/actions/auth'
import { KeyRound } from 'lucide-react'

export default function SetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await setPasswordAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, setPasswordAction redirects to /crm
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Establecer contraseña</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Elige una contraseña para tu cuenta. Mínimo 8 caracteres.
      </p>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar contraseña
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar contraseña y entrar'}
        </button>
      </form>
    </div>
  )
}
