'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavClient() {
  const pathname = usePathname()
  const links = [
    { href: '/', label: 'Panel', icon: '▦' },
    { href: '/presupuestos', label: 'Presupuestos', icon: '◈' },
    { href: '/insumos', label: 'Insumos', icon: '◉' },
  ]
  return (
    <aside style={{width:220,background:'#fff',borderRight:'1px solid #e5e5e0',padding:'24px 16px',display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
      <div style={{fontWeight:600,fontSize:16,marginBottom:24,padding:'0 8px',color:'#16a34a'}}>⬡ Gestor 3D</div>
      {links.map(l => (
        <Link key={l.href} href={l.href} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,color:'#1a1a18',textDecoration:'none',fontSize:14,fontWeight:500,background:pathname===l.href?'#f0fdf4':'transparent'}}>
          <span style={{fontSize:16}}>{l.icon}</span>{l.label}
        </Link>
      ))}
    </aside>
  )
}
