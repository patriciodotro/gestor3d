'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadCalcConfig, costoImpresion, genId, type CalcConfig } from '@/lib/printCost'

const $$ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

// ── Tipos ────────────────────────────────────────────────
type Componente = { id: string; nombre: string; cantidad: number; precio_unitario: number }

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  stock: number
  notas: string | null
  foto_url: string | null
  gramos: number
  tiempo_horas: number
  minutos_impresion: number
  cantidad_piezas: number
  filamento_tipo: 'fijo' | 'variable'
  filamento_material: string | null
  filamento_color: string | null
  filamento_marca: string | null
  componentes: Componente[] | null
  costo_impresion: number | null
  costo_componentes: number | null
  costo_total: number | null
  precio_venta_sugerido: number | null
  insumos_usados: { insumo_id: string; nombre: string; costo_por_pieza: number }[] | null
  created_at: string
}

const SIN_CATEGORIA = 'Sin categoría'

// ── Estilos compartidos ─────────────────────────────────
const S = {
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  input: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 11, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 },
  btn: (v: 'default' | 'primary' | 'danger' = 'default') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: v === 'primary' ? 'none' : v === 'danger' ? '1px solid var(--color-accent-red-bg)' : '1px solid var(--color-border)',
    background: v === 'primary' ? 'var(--color-brand)' : v === 'danger' ? 'var(--color-accent-red-bg)' : 'transparent',
    color: v === 'primary' ? '#fff' : v === 'danger' ? 'var(--color-accent-red)' : 'var(--color-text)',
  } as React.CSSProperties),
}

// ── Input numérico con buffer de texto (edición fluida) ─
function NumField({ label, value, onChange, suffix, prefix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; prefix?: string; step?: number; min?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { if (Number(text) !== value) setText(String(value)) }, [value])

  function handleChange(raw: string) {
    setText(raw)
    if (raw === '' || raw === '-') return
    const n = Number(raw)
    if (!isNaN(n)) onChange(n)
  }
  function handleBlur() {
    if (text === '' || text === '-' || isNaN(Number(text))) { setText(String(min)); onChange(min) }
  }

  return (
    <div>
      <label style={S.label}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 10px', color: 'var(--color-muted)', fontSize: 12, borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>{prefix}</span>}
        <input type="number" min={min} step={step} value={text}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          style={{ flex: 1, padding: '8px 10px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: 'var(--color-text)', outline: 'none', width: 0 }} />
        {suffix && <span style={{ padding: '0 10px', color: 'var(--color-muted)', fontSize: 12, borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── Editor de componentes / packaging (tabla dinámica) ──
const COMPONENTES_SUGERIDOS = ['Cable', 'Portalámparas', 'Lamparita', 'Rosca', 'Caja', 'Etiqueta', 'Film', 'Papel panal']

function ComponentesEditor({ componentes, onChange }: { componentes: Componente[]; onChange: (c: Componente[]) => void }) {
  function update(id: string, patch: Partial<Componente>) {
    onChange(componentes.map(c => c.id === id ? { ...c, ...patch } : c))
  }
  function remove(id: string) { onChange(componentes.filter(c => c.id !== id)) }
  function add(nombre = '') { onChange([...componentes, { id: genId(), nombre, cantidad: 1, precio_unitario: 0 }]) }
  const total = componentes.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0)

  return (
    <div>
      {componentes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
          Sumá cada parte extra de la ficha: cable, portalámparas, caja, etiqueta, empaquetado...
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 90px 24px', gap: 8, marginBottom: 6 }}>
            <span style={S.label}>Componente</span>
            <span style={S.label}>Cant.</span>
            <span style={S.label}>Precio u.</span>
            <span style={{ ...S.label, textAlign: 'right' as const }}>Subtotal</span>
            <span />
          </div>
          {componentes.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 90px 24px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input style={S.input} value={c.nombre} onChange={e => update(c.id, { nombre: e.target.value })} placeholder="Ej: Portalámparas" />
              <input type="number" style={S.input} value={c.cantidad} min={0} onChange={e => update(c.id, { cantidad: Number(e.target.value) })} />
              <input type="number" style={S.input} value={c.precio_unitario} min={0} onChange={e => update(c.id, { precio_unitario: Number(e.target.value) })} />
              <span style={{ fontSize: 12, color: 'var(--color-text)', textAlign: 'right' as const }}>{$$(c.cantidad * c.precio_unitario)}</span>
              <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 4, marginBottom: componentes.length > 0 ? 10 : 0 }}>
        {COMPONENTES_SUGERIDOS.map(s => (
          <button key={s} onClick={() => add(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            + {s}
          </button>
        ))}
        <button onClick={() => add('')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          + Otro
        </button>
      </div>

      {componentes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, paddingTop: 8, borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <span>Total componentes</span><span>{$$(total)}</span>
        </div>
      )}
    </div>
  )
}

// ── Estado del formulario (ver/editar/nuevo) ────────────
type FormState = {
  nombre: string
  categoria: string
  notas: string
  stock: number
  precio: number
  gramos: number
  horas: number
  minutos: number
  piezas: number
  filamentoTipo: 'fijo' | 'variable'
  filMaterial: string
  filColor: string
  filMarca: string
  componentes: Componente[]
  foto_url: string | null
}

function formFromProducto(p: Producto | null): FormState {
  if (!p) {
    return {
      nombre: '', categoria: '', notas: '', stock: 0, precio: 0,
      gramos: 100, horas: 2, minutos: 0, piezas: 1,
      filamentoTipo: 'variable', filMaterial: 'PLA', filColor: '', filMarca: '',
      componentes: [], foto_url: null,
    }
  }
  const componentes = (p.componentes && p.componentes.length > 0)
    ? p.componentes
    : (p.insumos_usados || []).map(i => ({ id: genId(), nombre: i.nombre, cantidad: 1, precio_unitario: i.costo_por_pieza }))
  return {
    nombre: p.nombre, categoria: p.categoria || '', notas: p.notas || '',
    stock: p.stock || 0, precio: p.precio || 0,
    gramos: p.gramos || 0, horas: p.tiempo_horas || 0, minutos: p.minutos_impresion || 0, piezas: p.cantidad_piezas || 1,
    filamentoTipo: p.filamento_tipo || 'variable',
    filMaterial: p.filamento_material || 'PLA', filColor: p.filamento_color || '', filMarca: p.filamento_marca || '',
    componentes,
    foto_url: p.foto_url,
  }
}

// ── Modal: ver / editar / crear producto ────────────────
function ProductoModal({ producto, categoriasExistentes, onClose, onSaved, onDeleted }: {
  producto: Producto | null
  categoriasExistentes: string[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const esNuevo = producto === null
  const [editing, setEditing] = useState(esNuevo)
  const [form, setForm] = useState<FormState>(() => formFromProducto(producto))
  const [config] = useState<CalcConfig>(() => loadCalcConfig())

  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUrlManual, setFotoUrlManual] = useState('')
  const [modoFoto, setModoFoto] = useState<'subir' | 'url'>('subir')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm(f => ({ ...f, [key]: val }))

  const desglose = useMemo(() => costoImpresion(form.gramos, form.horas, form.minutos, config), [form.gramos, form.horas, form.minutos, config])
  const costoImpresionUnit = form.piezas > 0 ? desglose.total / form.piezas : desglose.total
  const costoComponentes = form.componentes.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0)
  const costoTotal = costoImpresionUnit + costoComponentes
  const ganancia = form.precio - costoTotal
  const pctGanancia = form.precio > 0 ? (ganancia / form.precio) * 100 : 0

  function resetForm() {
    setForm(formFromProducto(producto))
    setFotoFile(null); setFotoPreview(null); setFotoUrlManual(''); setError('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }
  function handleRemoveFotoNueva() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null); setFotoPreview(null)
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) { setError('Ponele un nombre al producto.'); return }
    setGuardando(true)
    setError('')

    let foto_url = form.foto_url

    try {
      if (modoFoto === 'subir' && fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('productos').upload(path, fotoFile)
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('productos').getPublicUrl(path)
        foto_url = pub.publicUrl
      } else if (modoFoto === 'url' && fotoUrlManual.trim()) {
        foto_url = fotoUrlManual.trim()
      }

      const payload = {
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim() || null,
        precio: form.precio,
        stock: form.stock,
        notas: form.notas.trim() || null,
        foto_url,
        gramos: form.gramos,
        tiempo_horas: form.horas,
        minutos_impresion: form.minutos,
        cantidad_piezas: form.piezas,
        filamento_tipo: form.filamentoTipo,
        filamento_material: form.filamentoTipo === 'fijo' ? form.filMaterial : null,
        filamento_color: form.filamentoTipo === 'fijo' ? form.filColor : null,
        filamento_marca: form.filamentoTipo === 'fijo' ? form.filMarca : null,
        precio_kg: config.precio_kg,
        desperdicio_pct: config.desperdicio_pct,
        precio_kwh: config.precio_kwh,
        consumo_w: config.consumo_w,
        costo_impresora: config.costo_impresora,
        vida_util_hs: config.vida_util_hs,
        componentes: form.componentes,
        costo_impresion: costoImpresionUnit,
        costo_componentes: costoComponentes,
        costo_total: costoTotal,
        costo_produccion: costoTotal,
        precio_venta_sugerido: form.precio,
      }

      if (esNuevo) {
        const { error: insErr } = await supabase.from('productos').insert(payload)
        if (insErr) throw insErr
      } else {
        const { error: updErr } = await supabase.from('productos').update(payload).eq('id', producto!.id)
        if (updErr) throw updErr
      }

      onSaved()
    } catch (e: any) {
      setError(e.message || 'Error al guardar el producto.')
    }
    setGuardando(false)
  }

  async function handleEliminar() {
    if (!producto) return
    await supabase.from('productos').delete().eq('id', producto.id)
    onDeleted()
  }

  const inputStyle = S.input
  const labelStyle = S.label

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
      onClick={onClose}>
      <div
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 600, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {esNuevo ? 'Nuevo producto' : editing ? 'Editar producto' : form.nombre || 'Producto'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {error && (
            <div style={{ background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
              {error}
            </div>
          )}

          {!editing ? (
            // ═══ MODO VER: ficha de solo lectura ═══
            <div>
              {form.foto_url && (
                <img src={form.foto_url} alt={form.nombre} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />
              )}

              {form.categoria && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                  {form.categoria}
                </span>
              )}
              {form.notas && <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 10, lineHeight: 1.5 }}>{form.notas}</p>}

              {/* Receta */}
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 10 }}>
                <div style={S.sectionTitle}>Receta de impresión</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--color-muted)' }}>Gramos:</span> <strong style={{ color: 'var(--color-text)' }}>{form.gramos}g</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Tiempo:</span> <strong style={{ color: 'var(--color-text)' }}>{form.horas}h {form.minutos}m</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Piezas por tirada:</span> <strong style={{ color: 'var(--color-text)' }}>{form.piezas}</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Stock:</span> <strong style={{ color: 'var(--color-text)' }}>{form.stock}</strong></div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Filamento:</span>{' '}
                  {form.filamentoTipo === 'fijo' ? (
                    <strong style={{ color: 'var(--color-text)' }}>{form.filMaterial} {form.filColor} ({form.filMarca})</strong>
                  ) : (
                    <strong style={{ color: 'var(--color-accent-purple)' }}>A elección del cliente</strong>
                  )}
                </div>
              </div>

              {/* Componentes */}
              <div style={{ marginTop: 16 }}>
                <div style={S.sectionTitle}>Componentes / packaging</div>
                {form.componentes.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Sin componentes cargados.</p>
                ) : (
                  form.componentes.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text)' }}>{c.nombre} {c.cantidad > 1 && <span style={{ color: 'var(--color-muted)' }}>× {c.cantidad}</span>}</span>
                      <span style={{ color: 'var(--color-muted)' }}>{$$(c.cantidad * c.precio_unitario)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Costos */}
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 10 }}>
                <div style={S.sectionTitle}>Costo bruto (sin ganancia)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Impresión (material + luz + amortización)</span>
                  <span style={{ color: 'var(--color-text)' }}>{$$(costoImpresionUnit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Componentes</span>
                  <span style={{ color: 'var(--color-text)' }}>{$$(costoComponentes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, padding: '8px 0 0', marginTop: 6, borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text)' }}>Costo total</span>
                  <span style={{ color: 'var(--color-text)' }}>{$$(costoTotal)}</span>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Ganancia estimada</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ganancia >= 0 ? '#4ade80' : 'var(--color-accent-red)' }}>
                    {$$(ganancia)} {form.precio > 0 && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>({pctGanancia.toFixed(0)}%)</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Precio de venta</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand)' }}>{$$(form.precio)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                {deleteConfirm ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', alignSelf: 'center' }}>¿Eliminar producto?</span>
                    <button style={S.btn('danger')} onClick={handleEliminar}>Sí, eliminar</button>
                    <button style={S.btn()} onClick={() => setDeleteConfirm(false)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button style={S.btn('danger')} onClick={() => setDeleteConfirm(true)}>Eliminar</button>
                    <button style={S.btn('primary')} onClick={() => setEditing(true)}>✎ Editar</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            // ═══ MODO EDITAR / NUEVO ═══
            <div style={{ display: 'grid', gap: 18 }}>
              {/* Datos generales */}
              <div>
                <div style={S.sectionTitle}>Datos generales</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nombre del producto *</label>
                    <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Lámpara hexagonal grande" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Categoría</label>
                      <input style={inputStyle} list="categorias-existentes" value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ej: Lámparas, Macetas..." />
                      <datalist id="categorias-existentes">
                        {categoriasExistentes.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label style={labelStyle}>Stock</label>
                      <input type="number" style={inputStyle} value={form.stock} onChange={e => set('stock', Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Notas (opcional)</label>
                    <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' as const }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Detalles de la receta, variantes, etc." />
                  </div>
                </div>
              </div>

              {/* Foto */}
              <div>
                <div style={S.sectionTitle}>Foto</div>
                {form.foto_url && !fotoPreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <img src={form.foto_url} alt="actual" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Foto actual — subí una nueva o pegá una URL para reemplazarla.</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['subir', 'url'] as const).map(m => (
                    <button key={m} onClick={() => { setModoFoto(m); if (m === 'url') handleRemoveFotoNueva() }} style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit',
                      background: modoFoto === m ? 'var(--color-brand)' : 'transparent',
                      color: modoFoto === m ? '#fff' : 'var(--color-text)',
                    }}>
                      {m === 'subir' ? 'Subir archivo' : 'Pegar URL'}
                    </button>
                  ))}
                </div>
                {modoFoto === 'subir' ? (
                  <>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: 13, color: 'var(--color-muted)' }} />
                    {fotoPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <img src={fotoPreview} alt="preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        <button onClick={handleRemoveFotoNueva} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-accent-red-bg)', background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)' }}>
                          ✕ Quitar
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <input style={inputStyle} value={fotoUrlManual} onChange={e => setFotoUrlManual(e.target.value)} placeholder="https://..." />
                )}
              </div>

              {/* Receta de impresión */}
              <div>
                <div style={S.sectionTitle}>Receta de impresión</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <NumField label="Gramos (tirada)" value={form.gramos} onChange={v => set('gramos', v)} suffix="g" />
                  <NumField label="Horas" value={form.horas} onChange={v => set('horas', v)} suffix="hs" />
                  <NumField label="Minutos" value={form.minutos} onChange={v => set('minutos', v)} suffix="min" />
                  <NumField label="Piezas en la tirada" value={form.piezas} onChange={v => set('piezas', v)} min={1} />
                </div>

                <div>
                  <label style={labelStyle}>Filamento / color</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button onClick={() => set('filamentoTipo', 'variable')} style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit',
                      background: form.filamentoTipo === 'variable' ? 'var(--color-accent-purple)' : 'transparent',
                      color: form.filamentoTipo === 'variable' ? '#1a1a18' : 'var(--color-text)',
                    }}>
                      A elección del cliente
                    </button>
                    <button onClick={() => set('filamentoTipo', 'fijo')} style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit',
                      background: form.filamentoTipo === 'fijo' ? 'var(--color-accent-blue)' : 'transparent',
                      color: form.filamentoTipo === 'fijo' ? '#1a1a18' : 'var(--color-text)',
                    }}>
                      Color fijo
                    </button>
                  </div>
                  {form.filamentoTipo === 'fijo' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <input style={inputStyle} value={form.filMaterial} onChange={e => set('filMaterial', e.target.value)} placeholder="Material" />
                      <input style={inputStyle} value={form.filColor} onChange={e => set('filColor', e.target.value)} placeholder="Color" />
                      <input style={inputStyle} value={form.filMarca} onChange={e => set('filMarca', e.target.value)} placeholder="Marca" />
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
                  Costo de impresión por pieza (bruto): <strong style={{ color: 'var(--color-text)' }}>{$$(costoImpresionUnit)}</strong>
                  <br />
                  <span style={{ fontSize: 11 }}>
                    {desglose.gramosConDesperdicio.toFixed(0)}g · {desglose.tiempoHs.toFixed(1)}hs · filamento {$$(desglose.costoFilamento)} + luz {$$(desglose.costoElectricidad)} + amortización {$$(desglose.costoAmortizacion)}, dividido en {form.piezas} {form.piezas === 1 ? 'pieza' : 'piezas'}.
                  </span>
                  <br />
                  <span style={{ fontSize: 11 }}>Usa los valores ($/kg, $/kWh, amortización) configurados en la <Link href="/calculadora" style={{ color: 'var(--color-brand)' }}>Calculadora</Link>.</span>
                </div>
              </div>

              {/* Componentes */}
              <div>
                <div style={S.sectionTitle}>Componentes / packaging</div>
                <ComponentesEditor componentes={form.componentes} onChange={c => set('componentes', c)} />
              </div>

              {/* Resumen de costos + precio */}
              <div style={{ padding: '14px 16px', background: '#111110', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '2px 0' }}>
                  <span>Costo impresión</span><span>{$$(costoImpresionUnit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '2px 0' }}>
                  <span>Costo componentes</span><span>{$$(costoComponentes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#fff', padding: '6px 0 0', marginTop: 4, borderTop: '1px solid #2a2a28' }}>
                  <span>Costo total (bruto, sin ganancia)</span><span>{$$(costoTotal)}</span>
                </div>

                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                  <NumField label="Precio de venta final" value={form.precio} onChange={v => set('precio', v)} prefix="$" step={100} />
                  <div style={{ textAlign: 'right' as const, paddingBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#666' }}>Ganancia</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ganancia >= 0 ? '#4ade80' : '#f87171' }}>
                      {$$(ganancia)} {form.precio > 0 && <span style={{ color: '#666', fontWeight: 400 }}>({pctGanancia.toFixed(0)}%)</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={S.btn()} onClick={() => { if (esNuevo) onClose(); else { resetForm(); setEditing(false) } }}>
                  Cancelar
                </button>
                <button style={S.btn('primary')} onClick={handleGuardar} disabled={guardando}>
                  {guardando ? 'Guardando...' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────
export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('todos')
  const [modal, setModal] = useState<{ producto: Producto | null } | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').order('created_at', { ascending: false })
    setProductos((data || []).map((p: any) => ({
      ...p,
      componentes: p.componentes || [],
      insumos_usados: p.insumos_usados || [],
    })))
    setLoading(false)
  }

  function cerrarModal() { setModal(null) }
  async function alGuardar() { await cargar(); setModal(null) }
  async function alEliminar() { await cargar(); setModal(null) }

  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach(p => set.add(p.categoria?.trim() || SIN_CATEGORIA))
    return Array.from(set).sort((a, b) => a === SIN_CATEGORIA ? 1 : b === SIN_CATEGORIA ? -1 : a.localeCompare(b))
  }, [productos])

  const filtrados = productos.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase())
    const cat = p.categoria?.trim() || SIN_CATEGORIA
    const matchCat = catFiltro === 'todos' || cat === catFiltro
    return matchSearch && matchCat
  })

  const grupos = useMemo(() => {
    if (catFiltro !== 'todos') return [{ categoria: catFiltro, items: filtrados }]
    const porCat = categorias.map(c => ({
      categoria: c,
      items: filtrados.filter(p => (p.categoria?.trim() || SIN_CATEGORIA) === c),
    })).filter(g => g.items.length > 0)
    return porCat
  }, [filtrados, categorias, catFiltro])

  function Card({ p }: { p: Producto }) {
    const costoTotal = p.costo_total ?? 0
    return (
      <div className="pg-card" style={S.card} onClick={() => setModal({ producto: p })}>
        <div style={{ cursor: 'pointer', aspectRatio: '1', width: '100%', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {p.foto_url ? (
            <img src={p.foto_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 36, opacity: 0.3 }}>🧊</span>
          )}
        </div>
        <div style={{ padding: '12px 14px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{p.nombre}</h3>
          {p.categoria && (
            <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{p.categoria}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-brand)' }}>{$$(p.precio_venta_sugerido || p.precio || 0)}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{p.gramos}g</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
              ⏱ {p.tiempo_horas || 0}h {p.minutos_impresion || 0}m
            </span>
            {costoTotal > 0 && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                Costo {$$(costoTotal)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{`
        .pg-card { cursor: pointer; transition: transform 0.12s ease, border-color 0.12s ease; }
        .pg-card:hover { transform: translateY(-2px); border-color: var(--color-border-hover); }
        .pg-chip { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; border: none; white-space: nowrap; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)' }}>Productos</h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>Fichas de producto: receta, componentes y costo real</p>
        </div>
        <button style={S.btn('primary')} onClick={() => setModal({ producto: null })}>+ Nuevo producto</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
        <input
          style={{ ...S.input, maxWidth: 280 }}
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {categorias.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <button className="pg-chip" onClick={() => setCatFiltro('todos')} style={{
              background: catFiltro === 'todos' ? 'var(--color-brand)' : 'var(--color-surface-2)',
              color: catFiltro === 'todos' ? '#fff' : 'var(--color-muted)',
            }}>
              Todos ({productos.length})
            </button>
            {categorias.map(c => {
              const n = productos.filter(p => (p.categoria?.trim() || SIN_CATEGORIA) === c).length
              return (
                <button key={c} className="pg-chip" onClick={() => setCatFiltro(c)} style={{
                  background: catFiltro === c ? 'var(--color-brand)' : 'var(--color-surface-2)',
                  color: catFiltro === c ? '#fff' : 'var(--color-muted)',
                }}>
                  {c} ({n})
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>
            {productos.length === 0 ? 'No hay productos guardados todavía' : 'No encontramos productos con ese filtro'}
          </p>
          <p style={{ fontSize: 13 }}>
            {productos.length === 0 ? 'Creá uno con el botón "+ Nuevo producto" o desde la Calculadora' : 'Probá con otra búsqueda o categoría'}
          </p>
        </div>
      ) : (
        grupos.map(g => (
          <div key={g.categoria} style={{ marginBottom: 28 }}>
            {catFiltro === 'todos' && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12 }}>
                {g.categoria} <span style={{ opacity: 0.6, fontWeight: 400 }}>({g.items.length})</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {g.items.map(p => <Card key={p.id} p={p} />)}
            </div>
          </div>
        ))
      )}

      {modal && (
        <ProductoModal
          producto={modal.producto}
          categoriasExistentes={categorias.filter(c => c !== SIN_CATEGORIA)}
          onClose={cerrarModal}
          onSaved={alGuardar}
          onDeleted={alEliminar}
        />
      )}
    </div>
  )
}
