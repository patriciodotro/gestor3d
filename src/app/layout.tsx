import type { Metadata } from 'next'
import './globals.css'
import NavClient from './NavClient'

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
          <NavClient />
          <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
