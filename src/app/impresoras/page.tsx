'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Impresora = {
  id: string
  nombre: string
  modelo: string
  horas_impresion: number
  proximo_mantenimiento_horas: number
  notas: string | null
  created_at: string
}

// Catálogo de modelos: foto y orden de las secciones.
// Para sumar un modelo nuevo el día de mañana, alcanza con agregarlo acá
// y subir la foto a /public/impresoras/<archivo>.
const MODELOS: { value: string; foto: string }[] = [
  { value: 'Bambu Lab A1 Combo', foto: '/impresoras/bambu-a1-combo.jpg' },
  { value: 'Bambu Lab X1 Carbon Combo', foto: '/impresoras/bambu-x1-carbon-combo.jpg' },
]
const fotoDeModelo = (modelo: string) => MODELOS.find(m => m.value === modelo)?.foto || null

const S = {
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' } as React.CSSProperties,
  input: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  btn: (v: 'default' | 'primary' | 'danger' = 'default') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: v === 'primary' ? 'none' : v === 'danger' ? '1px solid var(--color-accent-red-bg)' : '1px solid var(--color-border)',
    background: v === 'primary' ? 'var(--color-brand)' : v === 'danger' ? 'var(--color-accent-red-bg)' : 'transparent',
    color: v === 'primary' ? '#fff' : v === 'danger' ? 'var(--color-accent-red)' : 'var(--color-text)',
  } as React.CSSProperties),
}

const emptyForm = () => ({
  nombre: '', modelo: MODELOS[0].value, horas_impresion: 0, proximo_mantenimiento_horas: 300, notas: '',
})

function estadoMantenimiento(horas: number, proximo: number) {
  const restantes = proximo - horas
  if (restantes <= 0) return { label: 'Mantenimiento vencido', color: 'var(--color-accent-red)', bg: 'var(--color-accent-red-bg)' }
  if (restantes <= 50) return { label: `Faltan ${Math.round(restantes)} hs`, color: 'var(--color-accent-orange)', bg: 'var(--color-accent-orange-bg)' }
  return { label: `Faltan ${Math.round(restantes)} hs`, color: 'var(--color-muted)', bg: 'var(--color-surface-2)' }
}

export default function ImpresorasPage() {
  const [impresoras, setImpresoras] = useState<Impresora[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Impresora | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [guardando, setGuardando] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('impresoras').select('*').order('created_at', { ascending: true })
    setImpresoras(data || [])
    setLoading(false)
  }

  function abrirNueva() { setForm(emptyForm()); setEditando(null); setDeleteConfirm(false); setModal(true) }
  function abrirEditar(i: Impresora) {
    setForm({ nombre: i.nombre, modelo: i.modelo, horas_impresion: i.horas_impresion, proximo_mantenimiento_horas: i.proximo_mantenimiento_horas, notas: i.notas || '' })
    setEditando(i); setDeleteConfirm(false); setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('impresoras').update(form).eq('id', editando.id)
    } else {
      await supabase.from('impresoras').insert(form)
    }
    await cargar()
    setGuardando(false)
    setModal(false)
  }

  async function eliminar() {
    if (!editando) return
    await supabase.from('impresoras').delete().eq('id', editando.id)
    setImpresoras(prev => prev.filter(i => i.id !== editando.id))
    setModal(false)
  }

  // Agrupadas por modelo, en el orden del catálogo (y cualquier modelo
  // que no esté en MODELOS aparece al final, por las dudas).
  const modelosPresentes = [
    ...MODELOS.map(m => m.value).filter(v => impresoras.some(i => i.modelo === v)),
    ...Array.from(new Set(impresoras.map(i => i.modelo).filter(v => !MODELOS.some(m => m.value === v)))),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)' }}>Impresoras</h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>Horas de uso y mantenimiento de la flota</p>
        </div>
        <button style={S.btn('primary')} onClick={abrirNueva}>+ Agregar impresora</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Cargando...</p>
      ) : impresoras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>Todavía no cargaste ninguna impresora</p>
          <p style={{ fontSize: 13 }}>Sumala con el botón "+ Agregar impresora"</p>
        </div>
      ) : (
        modelosPresentes.map((modelo, idx) => (
          <div key={modelo} style={{ marginTop: idx === 0 ? 0 : 36 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {modelo} · {impresoras.filter(i => i.modelo === modelo).length}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {impresoras.filter(i => i.modelo === modelo).map(i => {
                const foto = fotoDeModelo(i.modelo)
                const estado = estadoMantenimiento(i.horas_impresion, i.proximo_mantenimiento_horas)
                const pct = Math.min(100, i.proximo_mantenimiento_horas > 0 ? (i.horas_impresion / i.proximo_mantenimiento_horas) * 100 : 0)
                return (
                  <div key={i.id} style={S.card} onClick={() => abrirEditar(i)}>
                    <div style={{ aspectRatio: '1', width: '100%', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {foto ? (
                        <img src={foto} alt={i.modelo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 36, opacity: 0.3 }}>🖨️</span>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{i.modelo}</span>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: '2px 0 10px' }}>{i.nombre}</h3>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Horas impresas</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{Math.round(i.horas_impresion).toLocaleString('es-AR')} hs</span>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Próx. mantenimiento</span>
                          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{Math.round(i.proximo_mantenimiento_horas).toLocaleString('es-AR')} hs</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: estado.color }} />
                        </div>
                        <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10, padding: '2px 7px', borderRadius: 5, background: estado.bg, color: estado.color, fontWeight: 500 }}>
                          {estado.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal alta / edición */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setModal(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, width: 420, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, color: 'var(--color-text)' }}>{editando ? 'Editar impresora' : 'Nueva impresora'}</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={S.label}>Nombre de la máquina *</label>
                <input style={S.input} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: A1 #1" />
              </div>
              <div>
                <label style={S.label}>Modelo</label>
                <select style={S.input} value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}>
                  {MODELOS.map(m => <option key={m.value} value={m.value}>{m.value}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Horas de impresión</label>
                  <input type="number" style={S.input} value={form.horas_impresion} onChange={e => setForm(f => ({ ...f, horas_impresion: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={S.label}>Próx. mantenimiento (hs)</label>
                  <input type="number" style={S.input} value={form.proximo_mantenimiento_horas} onChange={e => setForm(f => ({ ...f, proximo_mantenimiento_horas: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label style={S.label}>Notas</label>
                <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' as const }} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 24 }}>
              <div>
                {editando && (
                  deleteConfirm ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>¿Eliminar?</span>
                      <button style={S.btn('danger')} onClick={eliminar}>Sí</button>
                      <button style={S.btn()} onClick={() => setDeleteConfirm(false)}>No</button>
                    </div>
                  ) : (
                    <button style={S.btn('danger')} onClick={() => setDeleteConfirm(true)}>Eliminar</button>
                  )
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={S.btn()} onClick={() => setModal(false)}>Cancelar</button>
                <button style={S.btn('primary')} onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

