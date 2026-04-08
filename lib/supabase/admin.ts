import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role — bypasa RLS.
 * Usar SOLO en server actions para operaciones de bootstrap/admin.
 * NUNCA exponer al cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
