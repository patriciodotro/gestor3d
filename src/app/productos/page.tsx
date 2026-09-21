'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadCalcConfig, costoImpresion, genId, type CalcConfig } from '@/lib/printCost'

const $$ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

// ── Tipos ────────────────────────────────────────────────
type Componente = { id: string; nombre: string; cantidad: number; precio_unitario: number }
type Categoria = { id: string; nombre: string; orden: number }
type ComponenteCatalogo = { id: string; nombre: string; precio_unitario: number; categorias: string[] }

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  precio_mercadolibre: number | null
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
  precio_kg: number | null
  desperdicio_pct: number | null
  insumos_usados: { insumo_id: string; nombre: string; costo_por_pieza: number }[] | null
  created_at: string
}

const SIN_CATEGORIA = 'Sin categoría'

// ── Estilos compartidos ─────────────────────────────────
const S = {
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  sectionCard: { background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 16 } as React.CSSProperties,
  input: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 11, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  sectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 } as React.CSSProperties,
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

// ── Ganancia (precio - costo), usada junto a cada precio ─
function GananciaMini({ precio, costo, dark = false }: { precio: number; costo: number; dark?: boolean }) {
  const g = precio - costo
  const pct = precio > 0 ? (g / precio) * 100 : 0
  return (
    <div style={{ textAlign: 'right' as const }}>
      <div style={{ fontSize: 10, color: dark ? '#666' : 'var(--color-muted)' }}>Ganancia</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: g >= 0 ? '#4ade80' : (dark ? '#f87171' : 'var(--color-accent-red)') }}>
        {$$(g)} {precio > 0 && <span style={{ color: dark ? '#666' : 'var(--color-muted)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span>}
      </div>
    </div>
  )
}

// ── Editor de componentes: buscador/creador sobre el catálogo ──
function ComponentesSection({ componentes, onChange, catalogo, categoriaActual, onCatalogoChanged }: {
  componentes: Componente[]
  onChange: (c: Componente[]) => void
  catalogo: ComponenteCatalogo[]
  categoriaActual: string
  onCatalogoChanged: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [creandoNombre, setCreandoNombre] = useState<string | null>(null)
  const [precioNuevo, setPrecioNuevo] = useState(0)

  function update(id: string, patch: Partial<Componente>) { onChange(componentes.map(c => c.id === id ? { ...c, ...patch } : c)) }
  function remove(id: string) { onChange(componentes.filter(c => c.id !== id)) }

  function agregarFila(nombre: string, precio_unitario: number) {
    onChange([...componentes, { id: genId(), nombre, cantidad: 1, precio_unitario }])
    setBusqueda(''); setBuscando(false)
  }

  function iniciarCreacion() {
    setCreandoNombre(busqueda.trim())
    setPrecioNuevo(0)
  }

  function cancelarCreacion() {
    setCreandoNombre(null)
    setPrecioNuevo(0)
  }

  async function confirmarCreacion() {
    if (!creandoNombre) return
    await supabase.from('producto_componentes_catalogo').insert({
      nombre: creandoNombre, precio_unitario: precioNuevo, categorias: categoriaActual ? [categoriaActual] : [],
    })
    onCatalogoChanged()
    agregarFila(creandoNombre, precioNuevo)
    setCreandoNombre(null)
    setPrecioNuevo(0)
  }

  async function guardarEnCatalogo(c: Componente) {
    if (!c.nombre.trim()) return
    await supabase.from('producto_componentes_catalogo').insert({
      nombre: c.nombre.trim(), precio_unitario: c.precio_unitario, categorias: categoriaActual ? [categoriaActual] : [],
    })
    onCatalogoChanged()
  }

  const sugeridos = catalogo.filter(item => {
    const matchTexto = !busqueda || item.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = item.categorias.length === 0 || (!!categoriaActual && item.categorias.includes(categoriaActual))
    return matchTexto && matchCategoria
  }).slice(0, 8)
  const yaExiste = catalogo.some(item => item.nombre.trim().toLowerCase() === busqueda.trim().toLowerCase())
  const nombresCatalogo = new Set(catalogo.map(c => c.nombre.trim().toLowerCase()))

  const total = componentes.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0)

  return (
    <div>
      {/* Buscador / picker sobre el catálogo */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          style={S.input}
          placeholder="Buscar en el catálogo o escribir uno nuevo..."
          value={busqueda}
          onFocus={() => setBuscando(true)}
          onChange={e => { setBusqueda(e.target.value); setBuscando(true); setCreandoNombre(null) }}
        />
        {buscando && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, zIndex: 5, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
            {creandoNombre ? (
              <div style={{ padding: '12px' }}>
                <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>
                  Nuevo componente: <strong>{creandoNombre}</strong>
                </div>
                <label style={{ ...S.label, marginBottom: 4 }}>Precio (se guarda en el catálogo)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', overflow: 'hidden', flex: 1 }}>
                    <span style={{ padding: '0 10px', color: 'var(--color-muted)', fontSize: 12, borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>$</span>
                    <input type="number" autoFocus min={0} value={precioNuevo}
                      onChange={e => setPrecioNuevo(Number(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') confirmarCreacion() }}
                      style={{ flex: 1, padding: '7px 10px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text)', outline: 'none', width: 0 }} />
                  </div>
                  <button onClick={confirmarCreacion} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--color-brand)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                    Crear y agregar
                  </button>
                  <button onClick={cancelarCreacion} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            ) : (
              <>
                {sugeridos.map(item => (
                  <button key={item.id} onClick={() => agregarFila(item.nombre, item.precio_unitario)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
                    <span>{item.nombre}</span><span style={{ color: 'var(--color-muted)' }}>{$$(item.precio_unitario)}</span>
                  </button>
                ))}
                {busqueda.trim() && !yaExiste && (
                  <button onClick={iniciarCreacion} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--color-brand)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, fontWeight: 600 }}>
                    + Crear "{busqueda.trim()}" en el catálogo
                  </button>
                )}
                {sugeridos.length === 0 && !busqueda.trim() && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-muted)' }}>
                    {catalogo.length === 0 ? 'El catálogo está vacío — escribí un nombre para crear el primero.' : 'Escribí para buscar o crear un componente.'}
                  </div>
                )}
                <button onClick={() => setBuscando(false)} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'var(--color-surface-2)', border: 'none', color: 'var(--color-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const }}>Cerrar</button>
              </>
            )}
          </div>
        )}
      </div>

      {componentes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>
          Sumá cada parte extra de la ficha: cable, portalámparas, caja, etiqueta, empaquetado...
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 90px 85px 22px 22px', gap: 6, marginBottom: 6 }}>
            <span style={S.label}>Componente</span>
            <span style={S.label}>Cant.</span>
            <span style={S.label}>Precio u.</span>
            <span style={{ ...S.label, textAlign: 'right' as const }}>Subtotal</span>
            <span /><span />
          </div>
          {componentes.map(c => {
            const enCatalogo = nombresCatalogo.has(c.nombre.trim().toLowerCase())
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 90px 85px 22px 22px', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input style={S.input} value={c.nombre} onChange={e => update(c.id, { nombre: e.target.value })} placeholder="Ej: Portalámparas" />
                <input type="number" style={S.input} value={c.cantidad} min={0} onChange={e => update(c.id, { cantidad: Number(e.target.value) })} />
                <input type="number" style={S.input} value={c.precio_unitario} min={0} onChange={e => update(c.id, { precio_unitario: Number(e.target.value) })} />
                <span style={{ fontSize: 12, color: 'var(--color-text)', textAlign: 'right' as const }}>{$$(c.cantidad * c.precio_unitario)}</span>
                {!enCatalogo && c.nombre.trim() ? (
                  <button title="Guardar en el catálogo" onClick={() => guardarEnCatalogo(c)} style={{ background: 'none', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 14 }}>＋</button>
                ) : <span />}
                <button title="Quitar" onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>
            )
          })}
        </>
      )}

      <button onClick={() => onChange([...componentes, { id: genId(), nombre: '', cantidad: 1, precio_unitario: 0 }])} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
        + Fila libre
      </button>

      {componentes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, paddingTop: 8, marginTop: 10, borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
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
  precioML: number
  gramos: number
  horas: number
  minutos: number
  piezas: number
  filamentoTipo: 'fijo' | 'variable'
  filMaterial: string
  filColor: string
  filMarca: string
  precioKg: number
  desperdicioPct: number
  componentes: Componente[]
  foto_url: string | null
}

function formFromProducto(p: Producto | null): FormState {
  const config = loadCalcConfig()
  if (!p) {
    return {
      nombre: '', categoria: '', notas: '', stock: 0, precio: 0, precioML: 0,
      gramos: 100, horas: 2, minutos: 0, piezas: 1,
      filamentoTipo: 'variable', filMaterial: 'PLA', filColor: '', filMarca: '',
      precioKg: config.precio_kg, desperdicioPct: config.desperdicio_pct,
      componentes: [], foto_url: null,
    }
  }
  const componentes = (p.componentes && p.componentes.length > 0)
    ? p.componentes
    : (p.insumos_usados || []).map(i => ({ id: genId(), nombre: i.nombre, cantidad: 1, precio_unitario: i.costo_por_pieza }))
  return {
    nombre: p.nombre, categoria: p.categoria || '', notas: p.notas || '',
    stock: p.stock || 0, precio: p.precio || 0, precioML: p.precio_mercadolibre || 0,
    gramos: p.gramos || 0, horas: p.tiempo_horas || 0, minutos: p.minutos_impresion || 0, piezas: p.cantidad_piezas || 1,
    filamentoTipo: p.filamento_tipo || 'variable',
    filMaterial: p.filamento_material || 'PLA', filColor: p.filamento_color || '', filMarca: p.filamento_marca || '',
    precioKg: p.precio_kg != null && p.precio_kg > 0 ? p.precio_kg : config.precio_kg,
    desperdicioPct: p.desperdicio_pct != null ? p.desperdicio_pct : config.desperdicio_pct,
    componentes,
    foto_url: p.foto_url,
  }
}

// ── Modal: ver / editar / crear producto ────────────────
function ProductoModal({ producto, categorias, catalogo, onClose, onSaved, onDeleted, onCatalogosChanged }: {
  producto: Producto | null
  categorias: Categoria[]
  catalogo: ComponenteCatalogo[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  onCatalogosChanged: () => void
}) {
  const esNuevo = producto === null
  const [editing, setEditing] = useState(esNuevo)
  const [form, setForm] = useState<FormState>(() => formFromProducto(producto))
  const [config] = useState<CalcConfig>(() => loadCalcConfig())

  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUrlManual, setFotoUrlManual] = useState('')
  const [modoFoto, setModoFoto] = useState<'subir' | 'url'>('subir')

  const [agregandoCategoria, setAgregandoCategoria] = useState(false)
  const [nuevaCategoriaTexto, setNuevaCategoriaTexto] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm(f => ({ ...f, [key]: val }))

  const desglose = useMemo(
    () => costoImpresion(form.gramos, form.horas, form.minutos, { ...config, precio_kg: form.precioKg, desperdicio_pct: form.desperdicioPct }),
    [form.gramos, form.horas, form.minutos, form.precioKg, form.desperdicioPct, config]
  )
  const costoImpresionUnit = form.piezas > 0 ? desglose.total / form.piezas : desglose.total
  const costoComponentes = form.componentes.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0)
  const costoTotal = costoImpresionUnit + costoComponentes

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

  async function confirmarNuevaCategoria() {
    const nombre = nuevaCategoriaTexto.trim()
    if (!nombre) { setAgregandoCategoria(false); return }
    const { error: catErr } = await supabase.from('producto_categorias').insert({ nombre })
    if (!catErr) onCatalogosChanged()
    set('categoria', nombre)
    setAgregandoCategoria(false)
    setNuevaCategoriaTexto('')
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
        precio_mercadolibre: form.precioML,
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
        precio_kg: form.precioKg,
        desperdicio_pct: form.desperdicioPct,
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
      onClick={onClose}>
      <style>{`
        .pm-grid { display: grid; grid-template-columns: 280px 1fr; gap: 28px; }
        @media (max-width: 720px) { .pm-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 'min(1020px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' as const }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 28px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {esNuevo ? 'Nuevo producto' : editing ? `Editando · ${form.nombre || 'producto'}` : (form.nombre || 'Producto')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="pm-grid">
            {/* ═══ COLUMNA IZQUIERDA: foto + datos generales ═══ */}
            <div>
              {!editing ? (
                <>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    {form.foto_url ? (
                      <img src={form.foto_url} alt={form.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <span style={{ fontSize: 40, opacity: 0.3 }}>🧊</span>}
                  </div>
                  {form.categoria && (
                    <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                      {form.categoria}
                    </span>
                  )}
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-muted)' }}>Stock: <strong style={{ color: 'var(--color-text)' }}>{form.stock}</strong></div>
                  {form.notas && <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 10, lineHeight: 1.5 }}>{form.notas}</p>}
                </>
              ) : (
                <>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    {(fotoPreview || form.foto_url) ? (
                      <img src={fotoPreview || form.foto_url || ''} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <span style={{ fontSize: 40, opacity: 0.3 }}>🧊</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {(['subir', 'url'] as const).map(m => (
                      <button key={m} onClick={() => { setModoFoto(m); if (m === 'url') handleRemoveFotoNueva() }} style={{
                        flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit',
                        background: modoFoto === m ? 'var(--color-brand)' : 'transparent',
                        color: modoFoto === m ? '#fff' : 'var(--color-text)',
                      }}>
                        {m === 'subir' ? 'Subir archivo' : 'Pegar URL'}
                      </button>
                    ))}
                  </div>
                  {modoFoto === 'subir' ? (
                    <>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: 12, color: 'var(--color-muted)', width: '100%' }} />
                      {fotoPreview && (
                        <button onClick={handleRemoveFotoNueva} style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-accent-red-bg)', background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)' }}>
                          ✕ Quitar foto nueva
                        </button>
                      )}
                    </>
                  ) : (
                    <input style={S.input} value={fotoUrlManual} onChange={e => setFotoUrlManual(e.target.value)} placeholder="https://..." />
                  )}

                  <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                    <div>
                      <label style={S.label}>Nombre del producto *</label>
                      <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Lámpara hexagonal grande" />
                    </div>
                    <div>
                      <label style={S.label}>Categoría</label>
                      {agregandoCategoria ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input style={S.input} autoFocus value={nuevaCategoriaTexto}
                            onChange={e => setNuevaCategoriaTexto(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmarNuevaCategoria() }}
                            placeholder="Nombre de categoría" />
                          <button style={S.btn('primary')} onClick={confirmarNuevaCategoria}>OK</button>
                        </div>
                      ) : (
                        <select style={S.input} value={form.categoria} onChange={e => {
                          if (e.target.value === '__nueva__') setAgregandoCategoria(true)
                          else set('categoria', e.target.value)
                        }}>
                          <option value="">Sin categoría</option>
                          {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          <option value="__nueva__">+ Crear nueva categoría...</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label style={S.label}>Stock</label>
                      <input type="number" style={S.input} value={form.stock} onChange={e => set('stock', Number(e.target.value))} />
                    </div>
                    <div>
                      <label style={S.label}>Notas (opcional)</label>
                      <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' as const }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Detalles de la receta, variantes, etc." />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ═══ COLUMNA DERECHA: receta / componentes / costos ═══ */}
            <div>
              {!editing ? (
                <>
                  <div style={S.sectionCard}>
                    <div style={S.sectionTitle}>Receta de impresión</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                      <div><span style={{ color: 'var(--color-muted)' }}>Gramos:</span> <strong style={{ color: 'var(--color-text)' }}>{form.gramos}g</strong></div>
                      <div><span style={{ color: 'var(--color-muted)' }}>Tiempo:</span> <strong style={{ color: 'var(--color-text)' }}>{form.horas}h {form.minutos}m</strong></div>
                      <div><span style={{ color: 'var(--color-muted)' }}>Piezas por tirada:</span> <strong style={{ color: 'var(--color-text)' }}>{form.piezas}</strong></div>
                      <div>
                        <span style={{ color: 'var(--color-muted)' }}>Filamento:</span>{' '}
                        {form.filamentoTipo === 'fijo' ? (
                          <strong style={{ color: 'var(--color-text)' }}>{form.filMaterial} {form.filColor}</strong>
                        ) : (
                          <strong style={{ color: 'var(--color-accent-purple)' }}>A elección</strong>
                        )}
                      </div>
                      <div><span style={{ color: 'var(--color-muted)' }}>Precio filamento:</span> <strong style={{ color: 'var(--color-text)' }}>{$$(form.precioKg)}/kg</strong></div>
                      <div><span style={{ color: 'var(--color-muted)' }}>Desperdicio:</span> <strong style={{ color: 'var(--color-text)' }}>{form.desperdicioPct}%</strong></div>
                    </div>
                  </div>

                  <div style={S.sectionCard}>
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

                  <div style={S.sectionCard}>
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

                  <div style={{ ...S.sectionCard, marginBottom: 0 }}>
                    <div style={S.sectionTitle}>Precios de venta</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Venta directa</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand)' }}>{$$(form.precio)}</div>
                        </div>
                        <GananciaMini precio={form.precio} costo={costoTotal} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Mercado Libre</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent-yellow)' }}>{form.precioML > 0 ? $$(form.precioML) : '—'}</div>
                        </div>
                        {form.precioML > 0 && <GananciaMini precio={form.precioML} costo={costoTotal} />}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
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
                </>
              ) : (
                <>
                  <div style={S.sectionCard}>
                    <div style={S.sectionTitle}>Receta de impresión</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <NumField label="Gramos (tirada)" value={form.gramos} onChange={v => set('gramos', v)} suffix="g" />
                      <NumField label="Horas" value={form.horas} onChange={v => set('horas', v)} suffix="hs" />
                      <NumField label="Minutos" value={form.minutos} onChange={v => set('minutos', v)} suffix="min" />
                      <NumField label="Piezas en la tirada" value={form.piezas} onChange={v => set('piezas', v)} min={1} />
                    </div>

                    <label style={S.label}>Filamento / color</label>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <input style={S.input} value={form.filMaterial} onChange={e => set('filMaterial', e.target.value)} placeholder="Material" />
                        <input style={S.input} value={form.filColor} onChange={e => set('filColor', e.target.value)} placeholder="Color" />
                        <input style={S.input} value={form.filMarca} onChange={e => set('filMarca', e.target.value)} placeholder="Marca" />
                      </div>
                    )}

                    <label style={S.label}>Costo del material</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <NumField label="Precio del filamento" value={form.precioKg} onChange={v => set('precioKg', v)} prefix="$" suffix="/kg" step={100} />
                      <NumField label="Desperdicio / fallas" value={form.desperdicioPct} onChange={v => set('desperdicioPct', v)} suffix="%" />
                    </div>

                    <div style={{ padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
                      Costo de impresión por pieza (bruto): <strong style={{ color: 'var(--color-text)' }}>{$$(costoImpresionUnit)}</strong>
                      <br />
                      <span style={{ fontSize: 11 }}>
                        {desglose.gramosConDesperdicio.toFixed(0)}g · {desglose.tiempoHs.toFixed(1)}hs · filamento {$$(desglose.costoFilamento)} + luz {$$(desglose.costoElectricidad)} + amortización {$$(desglose.costoAmortizacion)}, dividido en {form.piezas} {form.piezas === 1 ? 'pieza' : 'piezas'}.
                      </span>
                      <br />
                      <span style={{ fontSize: 11 }}>El $/kg y el % de desperdicio son propios de este producto (se precargan desde la <Link href="/calculadora" style={{ color: 'var(--color-brand)' }}>Calculadora</Link> al crearlo). Luz y amortización sí usan siempre los valores generales de la Calculadora.</span>
                    </div>
                  </div>

                  <div style={S.sectionCard}>
                    <div style={S.sectionTitle}>Componentes / packaging</div>
                    <ComponentesSection
                      componentes={form.componentes}
                      onChange={c => set('componentes', c)}
                      catalogo={catalogo}
                      categoriaActual={form.categoria}
                      onCatalogoChanged={onCatalogosChanged}
                    />
                  </div>

                  <div style={{ padding: '16px 18px', background: '#111110', borderRadius: 12, marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '2px 0' }}>
                      <span>Costo impresión</span><span>{$$(costoImpresionUnit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '2px 0' }}>
                      <span>Costo componentes</span><span>{$$(costoComponentes)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#fff', padding: '6px 0 0', marginTop: 4, borderTop: '1px solid #2a2a28' }}>
                      <span>Costo total (bruto, sin ganancia)</span><span>{$$(costoTotal)}</span>
                    </div>

                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                      <NumField label="Precio de venta directa" value={form.precio} onChange={v => set('precio', v)} prefix="$" step={100} />
                      <GananciaMini precio={form.precio} costo={costoTotal} dark />
                    </div>
                    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                      <NumField label="Precio Mercado Libre" value={form.precioML} onChange={v => set('precioML', v)} prefix="$" step={100} />
                      <GananciaMini precio={form.precioML} costo={costoTotal} dark />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                    <button style={S.btn()} onClick={() => { if (esNuevo) onClose(); else { resetForm(); setEditing(false) } }}>
                      Cancelar
                    </button>
                    <button style={S.btn('primary')} onClick={handleGuardar} disabled={guardando}>
                      {guardando ? 'Guardando...' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: gestionar categorías ─────────────────────────
function CategoriasModal({ categorias, productos, onClose, onChanged }: {
  categorias: Categoria[]; productos: Producto[]; onClose: () => void; onChanged: () => void
}) {
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<string | null>(null)

  const conteos = useMemo(() => {
    const c: Record<string, number> = {}
    productos.forEach(p => { if (p.categoria) c[p.categoria] = (c[p.categoria] || 0) + 1 })
    return c
  }, [productos])

  async function agregar() {
    const nombre = nuevo.trim()
    if (!nombre) return
    setGuardando(true)
    await supabase.from('producto_categorias').insert({ nombre })
    setNuevo('')
    setGuardando(false)
    onChanged()
  }

  async function eliminar(cat: Categoria) {
    await supabase.from('producto_categorias').delete().eq('id', cat.id)
    setBorrando(null)
    onChanged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 440, maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto', padding: 26 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Categorías de producto</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input style={S.input} value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Nueva categoría..." onKeyDown={e => { if (e.key === 'Enter') agregar() }} />
          <button style={S.btn('primary')} onClick={agregar} disabled={guardando}>+ Agregar</button>
        </div>
        {categorias.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Todavía no creaste categorías.</p>
        ) : (
          categorias.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{c.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 8 }}>
                  {conteos[c.nombre] || 0} producto{(conteos[c.nombre] || 0) === 1 ? '' : 's'}
                </span>
              </div>
              {borrando === c.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {(conteos[c.nombre] || 0) > 0 ? (
                    <span style={{ fontSize: 11, color: 'var(--color-accent-red)' }}>En uso, no se puede borrar</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>¿Eliminar?</span>
                      <button style={{ ...S.btn('danger'), padding: '3px 8px', fontSize: 11 }} onClick={() => eliminar(c)}>Sí</button>
                    </>
                  )}
                  <button style={{ ...S.btn(), padding: '3px 8px', fontSize: 11 }} onClick={() => setBorrando(null)}>Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setBorrando(c.id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Modal: gestionar catálogo de componentes ────────────
function ComponentesCatalogoModal({ catalogo, categorias, onClose, onChanged }: {
  catalogo: ComponenteCatalogo[]; categorias: Categoria[]; onClose: () => void; onChanged: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState(0)
  const [cats, setCats] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState<ComponenteCatalogo | null>(null)

  function abrirNuevo() { setEditando(null); setNombre(''); setPrecio(0); setCats([]) }
  function abrirEditar(item: ComponenteCatalogo) { setEditando(item); setNombre(item.nombre); setPrecio(item.precio_unitario); setCats(item.categorias) }
  function toggleCat(nombreCat: string) { setCats(prev => prev.includes(nombreCat) ? prev.filter(c => c !== nombreCat) : [...prev, nombreCat]) }

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    const payload = { nombre: nombre.trim(), precio_unitario: precio, categorias: cats }
    if (editando) await supabase.from('producto_componentes_catalogo').update(payload).eq('id', editando.id)
    else await supabase.from('producto_componentes_catalogo').insert(payload)
    setGuardando(false)
    abrirNuevo()
    onChanged()
  }

  async function eliminar(id: string) {
    await supabase.from('producto_componentes_catalogo').delete().eq('id', id)
    if (editando?.id === id) abrirNuevo()
    onChanged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 560, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto', padding: 26 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Catálogo de componentes</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: 'var(--color-surface-2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={S.sectionTitle}>{editando ? `Editando: ${editando.nombre}` : 'Nuevo componente'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 10 }}>
            <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Portalámparas" />
            <input type="number" style={S.input} value={precio} onChange={e => setPrecio(Number(e.target.value))} placeholder="Precio" />
          </div>
          <label style={S.label}>Aparece en categorías (vacío = todas)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 }}>
            {categorias.map(c => (
              <button key={c.id} onClick={() => toggleCat(c.nombre)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: cats.includes(c.nombre) ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: cats.includes(c.nombre) ? 'var(--color-brand-light)' : 'transparent',
                color: cats.includes(c.nombre) ? 'var(--color-brand)' : 'var(--color-muted)',
              }}>{c.nombre}</button>
            ))}
            {categorias.length === 0 && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Todavía no hay categorías creadas.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editando && <button style={S.btn()} onClick={abrirNuevo}>Cancelar</button>}
            <button style={S.btn('primary')} onClick={guardar} disabled={guardando}>{editando ? 'Guardar cambios' : '+ Agregar al catálogo'}</button>
          </div>
        </div>

        {catalogo.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Todavía no hay componentes en el catálogo.</p>
        ) : (
          catalogo.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{item.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                  {$$(item.precio_unitario)} · {item.categorias.length === 0 ? 'Todas las categorías' : item.categorias.join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 12 }} onClick={() => abrirEditar(item)}>✎</button>
                <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 12 }} onClick={() => eliminar(item.id)}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────
export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [catalogo, setCatalogo] = useState<ComponenteCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('todos')
  const [modal, setModal] = useState<{ producto: Producto | null } | null>(null)
  const [modalCategorias, setModalCategorias] = useState(false)
  const [modalCatalogo, setModalCatalogo] = useState(false)

  useEffect(() => { cargarTodo() }, [])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').order('created_at', { ascending: false })
    setProductos((data || []).map((p: any) => ({
      ...p,
      componentes: p.componentes || [],
      insumos_usados: p.insumos_usados || [],
    })))
  }

  async function cargarCatalogos() {
    const [{ data: cats }, { data: comps }] = await Promise.all([
      supabase.from('producto_categorias').select('*').order('nombre'),
      supabase.from('producto_componentes_catalogo').select('*').order('nombre'),
    ])
    setCategorias(cats || [])
    setCatalogo((comps || []).map((c: any) => ({ ...c, categorias: c.categorias || [] })))
  }

  async function cargarTodo() {
    setLoading(true)
    await Promise.all([cargarProductos(), cargarCatalogos()])
    setLoading(false)
  }

  function cerrarModal() { setModal(null) }
  async function alGuardar() { await cargarProductos(); setModal(null) }
  async function alEliminar() { await cargarProductos(); setModal(null) }

  const categoriasConProductos = useMemo(() => {
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
    return categoriasConProductos.map(c => ({
      categoria: c,
      items: filtrados.filter(p => (p.categoria?.trim() || SIN_CATEGORIA) === c),
    })).filter(g => g.items.length > 0)
  }, [filtrados, categoriasConProductos, catFiltro])

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
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
              📦 {p.stock ?? 0}
            </span>
            {costoTotal > 0 && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                Costo {$$(costoTotal)}
              </span>
            )}
            {!!p.precio_mercadolibre && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-accent-yellow-bg)', color: 'var(--color-accent-yellow)' }}>
                ML {$$(p.precio_mercadolibre)}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <button style={S.btn()} onClick={() => setModalCategorias(true)}>🏷️ Categorías</button>
          <button style={S.btn()} onClick={() => setModalCatalogo(true)}>🧩 Componentes</button>
          <button style={S.btn('primary')} onClick={() => setModal({ producto: null })}>+ Nuevo producto</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
        <input
          style={{ ...S.input, maxWidth: 280 }}
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {categoriasConProductos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <button className="pg-chip" onClick={() => setCatFiltro('todos')} style={{
              background: catFiltro === 'todos' ? 'var(--color-brand)' : 'var(--color-surface-2)',
              color: catFiltro === 'todos' ? '#fff' : 'var(--color-muted)',
            }}>
              Todos ({productos.length})
            </button>
            {categoriasConProductos.map(c => {
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
          categorias={categorias}
          catalogo={catalogo}
          onClose={cerrarModal}
          onSaved={alGuardar}
          onDeleted={alEliminar}
          onCatalogosChanged={cargarCatalogos}
        />
      )}
      {modalCategorias && (
        <CategoriasModal
          categorias={categorias}
          productos={productos}
          onClose={() => setModalCategorias(false)}
          onChanged={cargarCatalogos}
        />
      )}
      {modalCatalogo && (
        <ComponentesCatalogoModal
          catalogo={catalogo}
          categorias={categorias}
          onClose={() => setModalCatalogo(false)}
          onChanged={cargarCatalogos}
        />
      )}
    </div>
  )
}
