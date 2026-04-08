import Link from 'next/link'
import { headers } from 'next/headers'

const SUB_LINKS = [
  { href: '/refacciones/cotizaciones', label: 'Cotizaciones' },
  { href: '/refacciones/partes', label: 'Maestro de partes' },
]

export default async function RefaccionesLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 -mt-2">
        {SUB_LINKS.map(({ href, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
