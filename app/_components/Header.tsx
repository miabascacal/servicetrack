import { createClient } from '@/lib/supabase/server'

export async function Header({ title }: { title?: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userEmail = user?.email ?? ''
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'ST'

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-semibold text-gray-900">{title ?? 'Dashboard'}</h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 hidden sm:block">{userEmail}</span>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}
