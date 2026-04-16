'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Ingresa tu correo y contraseña' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.code === 'invalid_credentials') {
      return { error: 'Correo o contraseña incorrectos' }
    }
    return { error: 'Error al iniciar sesión. Inténtalo de nuevo.' }
  }

  revalidatePath('/', 'layout')
  redirect('/crm')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// Envía email de recuperación de contraseña. No requiere estar autenticado.
export async function forgotPasswordAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { error: 'Ingresa tu correo' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/set-password`,
  })

  if (error) return { error: 'No se pudo enviar el correo. Verifica el email e inténtalo de nuevo.' }

  return { success: true }
}

// Establece una nueva contraseña. El usuario debe estar autenticado (viene del callback de invitación o reset).
export async function setPasswordAction(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 8)
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (password !== confirm)
    return { error: 'Las contraseñas no coinciden' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' }

  revalidatePath('/', 'layout')
  redirect('/crm')
}
