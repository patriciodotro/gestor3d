import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Gestor 3D',
  description: 'Gestión de impresión 3D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside style={{
            width: 220,
            background: '#fff',
            borderRight: '1px solid var(--color-border)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flexShrink: 0,
          }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 24, padding: '0 8px', color: 'var(--color-brand)' }}>
              ⬡ Gestor 3D
            </div>
            <NavLink href="/" label="Panel" icon="▦" />
            <NavLink href="/presupuestos" label="Presupuestos" icon="◈" />
            <NavLink href="/insumos" label="Insumos" icon="◉" />
          </aside>

          {/* Main */}
          <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 8,
      color: 'var(--color-text)',
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: 500,
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </Link>
  )
}
