'use client'
import { useEffect, useState } from 'react'
import { supabase, type Insumo } from '@/lib/supabase'

const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const CAT = [
  { value: 'impresion', label: 'Impresión', color: 'var(--color-accent-blue)', bg: 'var(--color-accent-blue-bg)' },
  { value: 'post_procesado', label: 'Post-procesado', color: 'var(--color-accent-yellow)', bg: 'var(--color-accent-yellow-bg)' },
  { value: 'packaging', label: 'Packaging', color: 'var(--color-brand)', bg: 'var(--color-brand-light)' },
]

const S = {
  input: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 } as React.CSSProperties,
  btn: (v: 'default' | 'primary' | 'danger' = 'default') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: v === 'primary' ? 'none' : v === 'danger' ? '1px solid var(--color-accent-red-bg)' : '1px solid var(--color-border)',
    background: v === 'primary' ? 'var(--color-brand)' : v === 'danger' ? 'var(--color-accent-red-bg)' : 'transparent',
    color: v === 'primary' ? '#fff' : v === 'danger' ? 'var(--color-accent-red)' : 'var(--color-text)',
  } as React.CSSProperties),
}

const emptyForm = () => ({ nombre: '', categoria: 'impresion' as Insumo['categoria'], costo_por_pieza: 0, unidad: 'unidad', activo_por_defecto: false })

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCat, setFiltroCat] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Insumo | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('insumos').select('*').order('categoria').order('nombre')
    setInsumos(data || [])
    setLoading(false)
  }

  function abrirNuevo() { setForm(emptyForm()); setEditando(null); setModal(true) }
  function abrirEditar(i: Insumo) {
    setForm({ nombre: i.nombre, categoria: i.categoria, costo_por_pieza: i.costo_por_pieza, unidad: i.unidad, activo_por_defecto: i.activo_por_defecto })
    setEditando(i); setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('insumos').update(form).eq('id', editando.id)
    } else {
      await supabase.from('insumos').insert(form)
    }
    await cargar()
    setGuardando(false)
    setModal(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este insumo?')) return
    await supabase.from('insumos').delete().eq('id', id)
    setInsumos(prev => prev.filter(i => i.id !== id))
  }

  const filtrados = insumos.filter(i => filtroCat === 'todos' || i.categoria === filtroCat)
  const porCat = CAT.map(c => ({ ...c, items: filtrados.filter(i => i.categoria === c.value) }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)' }}>Insumos</h1>
        <button style={S.btn('primary')} onClick={abrirNuevo}>+ Nuevo insumo</button>
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface-2)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 20 }}>
        {[{ value: 'todos', label: 'Todos' }, ...CAT].map(c => (
          <button key={c.value} onClick={() => setFiltroCat(c.value)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
            background: filtroCat === c.value ? 'var(--color-surface)' : 'transparent',
            color: filtroCat === c.value ? 'var(--color-text)' : 'var(--color-muted)',
            boxShadow: filtroCat === c.value ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          }}>{c.label}</button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--color-muted)' }}>Cargando...</p> : (
        porCat.map(cat => cat.items.length > 0 && (
          <div key={cat.value} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {cat.label}
            </div>
            <div style={S.card}>
              {cat.items.map((ins, idx) => (
                <div key={ins.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 90px 80px', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: idx < cat.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text)' }}>{ins.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{ins.unidad}</div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: cat.bg, color: cat.color, width: 'fit-content' }}>
                    {cat.label}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{fmt(ins.costo_por_pieza)} / pieza</div>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: ins.activo_por_defecto ? 'var(--color-brand-light)' : 'var(--color-surface-2)', color: ins.activo_por_defecto ? 'var(--color-brand)' : 'var(--color-muted)', width: 'fit-content' }}>
                    {ins.activo_por_defecto ? 'Por defecto' : 'Opcional'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ ...S.btn(), padding: '5px 10px', fontSize: 12 }} onClick={() => abrirEditar(ins)}>✎ Editar</button>
                    <button style={{ ...S.btn('danger'), padding: '5px 10px', fontSize: 12 }} onClick={() => eliminar(ins.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, color: 'var(--color-text)' }}>{editando ? 'Editar insumo' : 'Nuevo insumo'}</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input style={S.input} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Aerosol adhesivo" />
              </div>
              <div>
                <label style={S.label}>Categoría</label>
                <select style={S.input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Insumo['categoria'] }))}>
                  {CAT.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Costo por pieza (ARS)</label>
                  <input type="number" style={S.input} value={form.costo_por_pieza} onChange={e => setForm(f => ({ ...f, costo_por_pieza: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={S.label}>Unidad</label>
                  <input style={S.input} value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} placeholder="puff, gota, unidad..." />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
                <input type="checkbox" checked={form.activo_por_defecto} onChange={e => setForm(f => ({ ...f, activo_por_defecto: e.target.checked }))} />
                Activado por defecto en nuevos presupuestos
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button style={S.btn()} onClick={() => setModal(false)}>Cancelar</button>
              <button style={S.btn('primary')} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
