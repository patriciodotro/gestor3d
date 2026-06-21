'use client'
import './globals.css'
import Link from 'next/link'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <style>{`
          .nav-link { display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:var(--color-text);text-decoration:none;font-size:14px;font-weight:500;transition:background 0.1s; }
          .nav-link:hover { background:var(--color-surface-hover); }
        `}</style>
      </head>
      <body>
        <div style={{display:'flex',minHeight:'100vh'}}>
          <aside style={{width:220,background:'var(--color-surface-2)',borderRight:'1px solid var(--color-border)',padding:'24px 16px',display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
            <div style={{fontWeight:600,fontSize:16,marginBottom:24,padding:'0 8px',color:'var(--color-brand)'}}>⬡ Gestor 3D</div>
            <Link href="/" className="nav-link"><span>▦</span> Panel</Link>
            <Link href="/presupuestos" className="nav-link"><span>◈</span> Presupuestos</Link>
            <Link href="/insumos" className="nav-link"><span>◉</span> Insumos</Link>
            <Link href="/inventario/filamentos" className="nav-link"><span>🧵</span> Filamentos</Link>
            <Link href="/calculadora" className="nav-link"><span>🧮</span> Calculadora</Link>
          </aside>
          <main style={{flex:1,padding:32,overflowY:'auto',background:'var(--color-bg)'}}>{children}</main>
        </div>
      </body>
    </html>
  )
}
