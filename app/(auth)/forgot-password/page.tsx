'use client'

import { useState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from '@/app/actions/auth'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await forgotPasswordAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Mail size={22} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Revisa tu correo</h2>
        <p className="text-sm text-gray-500 mb-6">
          Si el correo está registrado, recibirás un link para restablecer tu contraseña en los próximos minutos.
        </p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Recuperar contraseña</h2>
      <p className="text-sm text-gray-500 mb-6">
        Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.
      </p>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="nombre@concesionario.com"
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
          {loading ? 'Enviando...' : 'Enviar link de recuperación'}
        </button>

        <div className="text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
            Volver al inicio de sesión
          </Link>
        </div>
      </form>
    </div>
  )
}
