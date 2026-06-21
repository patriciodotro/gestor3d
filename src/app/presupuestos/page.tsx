'use client'
import { useEffect, useState } from 'react'
import { supabase, type Presupuesto, type Cliente, type Producto, type Insumo, type PresupuestoItem, type PresupuestoFilamento, type PresupuestoInsumo } from '@/lib/supabase'

// ── Helpers ──────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  borrador:  { label: 'Borrador',  color: 'var(--color-muted)', bg: 'var(--color-surface-2)' },
  enviado:   { label: 'Enviado',   color: 'var(--color-accent-blue)', bg: 'var(--color-accent-blue-bg)' },
  aceptado:  { label: 'Aceptado',  color: 'var(--color-brand)', bg: 'var(--color-brand-light)' },
  rechazado: { label: 'Rechazado', color: 'var(--color-accent-red)', bg: 'var(--color-accent-red-bg)' },
}

const CAT_LABELS: Record<string, string> = {
  impresion: 'Impresión',
  post_procesado: 'Post-procesado',
  packaging: 'Packaging',
}

// ── UI atoms ─────────────────────────────────────────
const S = {
  input: {
    width: '100%',
    padding: '7px 10px',
    fontSize: 14,
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    background: 'var(--color-input-bg)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    color: 'var(--color-muted)',
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
  } as React.CSSProperties,
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 12,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 14,
  },
  btn: (variant: 'default' | 'primary' | 'danger' | 'ghost' = 'default') => ({
    padding: '7px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: variant === 'primary' ? 'none' : variant === 'danger' ? '1px solid var(--color-accent-red-bg)' : '1px solid var(--color-border)',
    background: variant === 'primary' ? 'var(--color-brand)' : variant === 'danger' ? 'var(--color-accent-red-bg)' : variant === 'ghost' ? 'transparent' : 'transparent',
    color: variant === 'primary' ? '#fff' : variant === 'danger' ? 'var(--color-accent-red)' : 'var(--color-text)',
  } as React.CSSProperties),
}

// ── Empty states ──────────────────────────────────────
const emptyItem = (): PresupuestoItem => ({ tipo: 'personalizado', descripcion: '', cantidad: 1, precio_unitario: 0 })
const emptyFilamento = (): PresupuestoFilamento => ({ nombre: '', costo_por_kg: 0, gramos: 0, desperdicio_pct: 10 })

type FormData = {
  cliente_nombre: string
  cliente_id: string
  fecha_entrega: string
  descuento_porcentaje: number
  notas: string
  modo: 'rapido' | 'calculadora'
  items: PresupuestoItem[]
  filamentos: PresupuestoFilamento[]
  horas_impresion: number
  minutos_impresion: number
  precio_kwh: number
  consumo_maquina_w: number
  vida_util_repuestos_hs: number
  costo_repuestos: number
  insumos_adicionales: number
  margen_error_pct: number
  multiplicador: number
  insumos_usados: PresupuestoInsumo[]
}

const emptyForm = (insumos: Insumo[]): FormData => ({
  cliente_nombre: '',
  cliente_id: '',
  fecha_entrega: '',
  descuento_porcentaje: 0,
  notas: '',
  modo: 'rapido',
  items: [emptyItem()],
  filamentos: [emptyFilamento()],
  horas_impresion: 0,
  minutos_impresion: 0,
  precio_kwh: 140,
  consumo_maquina_w: 120,
  vida_util_repuestos_hs: 4320,
  costo_repuestos: 150000,
  insumos_adicionales: 0,
  margen_error_pct: 10,
  multiplicador: 5,
  insumos_usados: insumos.map(i => ({
    insumo_id: i.id,
    nombre: i.nombre,
    costo_por_pieza: i.costo_por_pieza,
    cantidad_piezas: 1,
    activo: i.activo_por_defecto,
  })),
})

// ── Cálculos ─────────────────────────────────────────
function calcularPresupuesto(f: FormData) {
  if (f.modo === 'rapido') {
    const subtotal = f.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const descuento = subtotal * (f.descuento_porcentaje / 100)
    return { costo_base: 0, precio_venta: subtotal - descuento }
  }
  const totalPiezas = f.items.reduce((s, i) => s + i.cantidad, 0) || 1
  const horas = f.horas_impresion + f.minutos_impresion / 60
  const costoEnergia = horas * (f.consumo_maquina_w / 1000) * f.precio_kwh
  const costoRepuestosPorHora = f.vida_util_repuestos_hs > 0 ? (f.costo_repuestos / f.vida_util_repuestos_hs) * horas : 0
  const costoFilamentos = f.filamentos.reduce((s, fil) => {
    const gramos = fil.gramos * (1 + fil.desperdicio_pct / 100)
    return s + (gramos / 1000) * fil.costo_por_kg
  }, 0)
  const costoInsumos = f.insumos_usados.filter(i => i.activo).reduce((s, i) => s + i.costo_por_pieza * totalPiezas, 0)
  const costoBase = (costoFilamentos + costoEnergia + costoRepuestosPorHora + Number(f.insumos_adicionales) + costoInsumos)
    * (1 + f.margen_error_pct / 100)
  const precioVenta = costoBase * f.multiplicador
  const descuento = precioVenta * (f.descuento_porcentaje / 100)
  return { costo_base: costoBase, precio_venta: precioVenta - descuento }
}

// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════
export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState<FormData | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [prodSearch, setProdSearch] = useState('')
  const [showProdDropdown, setShowProdDropdown] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: p }, { data: c }, { data: pr }, { data: ins }] = await Promise.all([
      supabase.from('presupuestos').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('insumos').select('*').order('categoria'),
    ])
    setPresupuestos(p || [])
    setClientes(c || [])
    setProductos(pr || [])
    setInsumos(ins || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setForm(emptyForm(insumos))
    setEditandoId(null)
    setVista('nuevo')
    setError('')
  }

  async function abrirEditar(p: Presupuesto) {
    const [{ data: items }, { data: fils }, { data: ins_usados }] = await Promise.all([
      supabase.from('presupuesto_items').select('*').eq('presupuesto_id', p.id),
      supabase.from('presupuesto_filamentos').select('*').eq('presupuesto_id', p.id),
      supabase.from('presupuesto_insumos').select('*').eq('presupuesto_id', p.id),
    ])
    setForm({
      cliente_nombre: p.cliente_nombre || '',
      cliente_id: p.cliente_id || '',
      fecha_entrega: p.fecha_entrega || '',
      descuento_porcentaje: p.descuento_porcentaje,
      notas: p.notas || '',
      modo: p.modo,
      items: items && items.length > 0 ? items : [emptyItem()],
      filamentos: fils && fils.length > 0 ? fils : [emptyFilamento()],
      horas_impresion: p.horas_impresion,
      minutos_impresion: p.minutos_impresion,
      precio_kwh: p.precio_kwh,
      consumo_maquina_w: p.consumo_maquina_w,
      vida_util_repuestos_hs: p.vida_util_repuestos_hs,
      costo_repuestos: p.costo_repuestos,
      insumos_adicionales: p.insumos_adicionales,
      margen_error_pct: p.margen_error_pct,
      multiplicador: p.multiplicador,
      insumos_usados: ins_usados && ins_usados.length > 0 ? ins_usados : insumos.map(i => ({
        insumo_id: i.id, nombre: i.nombre, costo_por_pieza: i.costo_por_pieza, cantidad_piezas: 1, activo: i.activo_por_defecto,
      })),
    })
    setEditandoId(p.id)
    setClienteSearch(p.cliente_nombre || '')
    setVista('editar')
    setError('')
  }

  async function guardar(estado: 'borrador' | 'enviado') {
    if (!form) return
    if (!form.cliente_nombre.trim()) { setError('Completá el nombre del cliente.'); return }
    setGuardando(true)
    setError('')
    const { costo_base, precio_venta } = calcularPresupuesto(form)
    const payload = {
      cliente_nombre: form.cliente_nombre,
      cliente_id: form.cliente_id || null,
      estado,
      modo: form.modo,
      fecha_entrega: form.fecha_entrega || null,
      descuento_porcentaje: form.descuento_porcentaje,
      notas: form.notas,
      costo_base,
      precio_venta,
      horas_impresion: form.horas_impresion,
      minutos_impresion: form.minutos_impresion,
      precio_kwh: form.precio_kwh,
      consumo_maquina_w: form.consumo_maquina_w,
      vida_util_repuestos_hs: form.vida_util_repuestos_hs,
      costo_repuestos: form.costo_repuestos,
      insumos_adicionales: form.insumos_adicionales,
      margen_error_pct: form.margen_error_pct,
      multiplicador: form.multiplicador,
      updated_at: new Date().toISOString(),
    }
    let presupuestoId = editandoId
    if (editandoId) {
      await supabase.from('presupuestos').update(payload).eq('id', editandoId)
      await supabase.from('presupuesto_items').delete().eq('presupuesto_id', editandoId)
      await supabase.from('presupuesto_filamentos').delete().eq('presupuesto_id', editandoId)
      await supabase.from('presupuesto_insumos').delete().eq('presupuesto_id', editandoId)
    } else {
      const { data } = await supabase.from('presupuestos').insert(payload).select().single()
      presupuestoId = data?.id
    }
    if (presupuestoId) {
      const itemsConId = form.items.filter(i => i.descripcion.trim()).map(i => ({ ...i, presupuesto_id: presupuestoId }))
      if (itemsConId.length) await supabase.from('presupuesto_items').insert(itemsConId)
      if (form.modo === 'calculadora') {
        const filsConId = form.filamentos.filter(f => f.nombre.trim()).map(f => ({ ...f, presupuesto_id: presupuestoId }))
        if (filsConId.length) await supabase.from('presupuesto_filamentos').insert(filsConId)
        const insConId = form.insumos_usados.map(i => ({ ...i, presupuesto_id: presupuestoId }))
        if (insConId.length) await supabase.from('presupuesto_insumos').insert(insConId)
      }
    }
    await cargarDatos()
    setGuardando(false)
    setVista('lista')
  }

  async function cambiarEstado(id: string, estado: Presupuesto['estado']) {
    await supabase.from('presupuestos').update({ estado, updated_at: new Date().toISOString() }).eq('id', id)
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
  }

  async function duplicar(p: Presupuesto) {
    const { data } = await supabase.from('presupuestos').insert({
      cliente_nombre: p.cliente_nombre,
      cliente_id: p.cliente_id,
      estado: 'borrador',
      modo: p.modo,
      fecha_entrega: p.fecha_entrega,
      descuento_porcentaje: p.descuento_porcentaje,
      notas: p.notas,
      costo_base: p.costo_base,
      precio_venta: p.precio_venta,
      horas_impresion: p.horas_impresion,
      minutos_impresion: p.minutos_impresion,
      precio_kwh: p.precio_kwh,
      consumo_maquina_w: p.consumo_maquina_w,
      vida_util_repuestos_hs: p.vida_util_repuestos_hs,
      costo_repuestos: p.costo_repuestos,
      insumos_adicionales: p.insumos_adicionales,
      margen_error_pct: p.margen_error_pct,
      multiplicador: p.multiplicador,
    }).select().single()
    if (data) {
      const [{ data: items }, { data: fils }, { data: ins_u }] = await Promise.all([
        supabase.from('presupuesto_items').select('*').eq('presupuesto_id', p.id),
        supabase.from('presupuesto_filamentos').select('*').eq('presupuesto_id', p.id),
        supabase.from('presupuesto_insumos').select('*').eq('presupuesto_id', p.id),
      ])
      if (items?.length) await supabase.from('presupuesto_items').insert(items.map(({ id, ...i }) => ({ ...i, presupuesto_id: data.id })))
      if (fils?.length) await supabase.from('presupuesto_filamentos').insert(fils.map(({ id, ...f }) => ({ ...f, presupuesto_id: data.id })))
      if (ins_u?.length) await supabase.from('presupuesto_insumos').insert(ins_u.map(({ id, ...i }) => ({ ...i, presupuesto_id: data.id })))
    }
    await cargarDatos()
  }

  function enviarWhatsApp(p: Presupuesto) {
    const texto = `Hola! Te paso el presupuesto P-${String(p.numero).padStart(5, '0')}:\n*${p.cliente_nombre}*\nTotal: ${fmt(p.precio_venta)}\n${p.fecha_entrega ? `Entrega estimada: ${p.fecha_entrega}` : ''}\n${p.notas || ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  function agregarProducto(prod: Producto) {
    if (!form) return
    setForm(f => f ? {
      ...f,
      items: [...f.items, { tipo: 'producto', producto_id: prod.id, descripcion: prod.nombre, cantidad: 1, precio_unitario: prod.precio }]
    } : f)
    setProdSearch('')
    setShowProdDropdown(false)
  }

  function setItemField(idx: number, field: keyof PresupuestoItem, value: string | number) {
    if (!form) return
    setForm(f => f ? { ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) } : f)
  }

  function setFilField(idx: number, field: keyof PresupuestoFilamento, value: string | number) {
    if (!form) return
    setForm(f => f ? { ...f, filamentos: f.filamentos.map((fl, i) => i === idx ? { ...fl, [field]: value } : fl) } : f)
  }

  function toggleInsumo(insumo_id: string) {
    if (!form) return
    setForm(f => f ? {
      ...f,
      insumos_usados: f.insumos_usados.map(i => i.insumo_id === insumo_id ? { ...i, activo: !i.activo } : i)
    } : f)
  }

  const presupuestosFiltrados = presupuestos.filter(p => {
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    const matchBusqueda = !busqueda || (p.cliente_nombre || '').toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  const { costo_base, precio_venta } = form ? calcularPresupuesto(form) : { costo_base: 0, precio_venta: 0 }

  // ── LISTA ────────────────────────────────────────────
  if (vista === 'lista') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)' }}>Presupuestos</h1>
        <button style={S.btn('primary')} onClick={abrirNuevo}>+ Nuevo presupuesto</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...S.input, maxWidth: 220 }} placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select style={{ ...S.input, maxWidth: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Cargando...</p>
      ) : presupuestosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No hay presupuestos todavía</p>
          <button style={S.btn('primary')} onClick={abrirNuevo}>Crear el primero</button>
        </div>
      ) : presupuestosFiltrados.map(p => {
        const est = ESTADO_LABELS[p.estado]
        return (
          <div key={p.id} style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>
                P-{String(p.numero).padStart(5, '0')}
              </span>
              <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: est.bg, color: est.color }}>
                {est.label}
              </span>
              <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: 'var(--color-text)' }}>{p.cliente_nombre || '—'}</span>
              {p.fecha_entrega && (
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Entrega: {new Date(p.fecha_entrega).toLocaleDateString('es-AR')}
                </span>
              )}
              <span style={{ fontWeight: 600, fontSize: 15, color: est.color }}>{fmt(p.precio_venta)}</span>
            </div>
            {p.notas && <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 10 }}>{p.notas}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={S.btn()} onClick={() => abrirEditar(p)}>✎ Editar</button>
              <button style={S.btn()} onClick={() => duplicar(p)}>⧉ Duplicar</button>
              <button style={{ ...S.btn(), color: '#25D366', borderColor: '#1c4a2e' }} onClick={() => enviarWhatsApp(p)}>
                WA
              </button>
              {p.estado === 'borrador' && (
                <button style={S.btn()} onClick={() => cambiarEstado(p.id, 'enviado')}>Marcar enviado</button>
              )}
              {p.estado === 'enviado' && (<>
                <button style={{ ...S.btn(), color: 'var(--color-brand)', borderColor: 'var(--color-brand-light)' }} onClick={() => cambiarEstado(p.id, 'aceptado')}>✓ Aceptar</button>
                <button style={S.btn('danger')} onClick={() => cambiarEstado(p.id, 'rechazado')}>✕ Rechazar</button>
              </>)}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── FORMULARIO (nuevo / editar) ──────────────────────
  if (!form) return null
  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).slice(0, 5)
  const prodsFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 6)
  const insumosPorCat = ['impresion', 'post_procesado', 'packaging'] as const
  const totalPiezas = form.items.reduce((s, i) => s + i.cantidad, 0) || 1

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button style={S.btn()} onClick={() => setVista('lista')}>← Volver</button>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)' }}>{editandoId ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h1>
      </div>

      {/* Modo toggle */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--color-surface-2)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 20 }}>
        {(['rapido', 'calculadora'] as const).map(m => (
          <button key={m} onClick={() => setForm(f => f ? { ...f, modo: m } : f)} style={{
            padding: '6px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', border: 'none',
            background: form.modo === m ? 'var(--color-surface)' : 'transparent',
            color: form.modo === m ? 'var(--color-text)' : 'var(--color-muted)',
            boxShadow: form.modo === m ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          }}>
            {m === 'rapido' ? '⚡ Rápido' : '🔢 Calculadora'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* Cliente */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Cliente</div>
        <div style={{ position: 'relative' }}>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={clienteSearch} placeholder="Buscar o escribir nombre..."
            onChange={e => { setClienteSearch(e.target.value); setForm(f => f ? { ...f, cliente_nombre: e.target.value, cliente_id: '' } : f) }}
          />
          {clienteSearch && clientesFiltrados.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', marginTop: 2, overflow: 'hidden' }}>
              {clientesFiltrados.map(c => (
                <div key={c.id} onClick={() => { setClienteSearch(c.nombre); setForm(f => f ? { ...f, cliente_nombre: c.nombre, cliente_id: c.id } : f) }}
                  style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-brand-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                >
                  <strong>{c.nombre}</strong>
                  {c.telefono && <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 12 }}>{c.telefono}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <label style={S.label}>Fecha de entrega estimada</label>
            <input type="date" style={S.input} value={form.fecha_entrega} onChange={e => setForm(f => f ? { ...f, fecha_entrega: e.target.value } : f)} />
          </div>
          <div>
            <label style={S.label}>Descuento general %</label>
            <input type="number" style={S.input} min={0} max={100} value={form.descuento_porcentaje}
              onChange={e => setForm(f => f ? { ...f, descuento_porcentaje: Number(e.target.value) } : f)} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Notas para el cliente</label>
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.notas}
              onChange={e => setForm(f => f ? { ...f, notas: e.target.value } : f)} placeholder="Detalles opcionales..." />
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Productos e ítems</div>

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Agregar producto guardado</label>
          <div style={{ position: 'relative' }}>
            <input style={S.input} placeholder="Buscar por nombre..." value={prodSearch}
              onChange={e => { setProdSearch(e.target.value); setShowProdDropdown(true) }}
              onFocus={() => setShowProdDropdown(true)}
              onBlur={() => setTimeout(() => setShowProdDropdown(false), 200)}
            />
            {showProdDropdown && prodSearch && prodsFiltrados.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, width: '100%', marginTop: 2, overflow: 'hidden' }}>
                {prodsFiltrados.map(pr => (
                  <div key={pr.id} onMouseDown={() => agregarProducto(pr)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-brand-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                  >
                    <div>
                      <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{pr.nombre}</strong>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 8 }}>{pr.categoria}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, background: pr.stock > 0 ? 'var(--color-brand-light)' : 'var(--color-accent-red-bg)', color: pr.stock > 0 ? 'var(--color-brand)' : 'var(--color-accent-red)', padding: '2px 8px', borderRadius: 6 }}>
                        Stock: {pr.stock}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--color-accent-blue)', fontSize: 14 }}>{fmt(pr.precio)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 32px', gap: 8, alignItems: 'end', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, marginBottom: 4, display: 'inline-block',
                  background: item.tipo === 'producto' ? 'var(--color-accent-blue-bg)' : 'var(--color-surface-2)',
                  color: item.tipo === 'producto' ? 'var(--color-accent-blue)' : 'var(--color-muted)' }}>
                  {item.tipo === 'producto' ? 'Producto' : 'Personalizado'}
                </span>
                <input style={S.input} value={item.descripcion} placeholder="Descripción..."
                  onChange={e => setItemField(idx, 'descripcion', e.target.value)} />
                <input style={{ ...S.input, marginTop: 4, fontSize: 12 }} value={item.notas || ''} placeholder="Notas opcionales..."
                  onChange={e => setItemField(idx, 'notas', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Cant.</label>
                <input type="number" style={{ ...S.input, textAlign: 'center' }} min={1} value={item.cantidad}
                  onChange={e => setItemField(idx, 'cantidad', Number(e.target.value))} />
              </div>
              <div>
                <label style={S.label}>Precio unit.</label>
                <input type="number" style={S.input} min={0} value={item.precio_unitario}
                  onChange={e => setItemField(idx, 'precio_unitario', Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button style={{ ...S.btn('danger'), padding: '7px 9px' }} onClick={() => setForm(f => f ? { ...f, items: f.items.filter((_, i) => i !== idx) } : f)}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <button style={{ ...S.btn(), border: '1px dashed var(--color-border)', color: 'var(--color-muted)' }}
          onClick={() => setForm(f => f ? { ...f, items: [...f.items, emptyItem()] } : f)}>
          + Agregar ítem personalizado
        </button>
      </div>

      {/* CALCULADORA */}
      {form.modo === 'calculadora' && (<>
        <div style={S.card}>
          <div style={S.sectionTitle}>Filamentos utilizados</div>
          {form.filamentos.map((fil, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 32px', gap: 8, alignItems: 'end', marginBottom: 10 }}>
              <div>
                <label style={S.label}>Nombre / tipo</label>
                <input style={S.input} value={fil.nombre} placeholder="Ej: PLA Negro" onChange={e => setFilField(idx, 'nombre', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Costo/kg (ARS)</label>
                <input type="number" style={S.input} value={fil.costo_por_kg} onChange={e => setFilField(idx, 'costo_por_kg', Number(e.target.value))} />
              </div>
              <div>
                <label style={S.label}>Gramos</label>
                <input type="number" style={S.input} value={fil.gramos} onChange={e => setFilField(idx, 'gramos', Number(e.target.value))} />
              </div>
              <div>
                <label style={S.label}>Desperdicio %</label>
                <input type="number" style={S.input} value={fil.desperdicio_pct} onChange={e => setFilField(idx, 'desperdicio_pct', Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button style={{ ...S.btn('danger'), padding: '7px 9px' }} onClick={() => setForm(f => f ? { ...f, filamentos: f.filamentos.filter((_, i) => i !== idx) } : f)}>✕</button>
              </div>
            </div>
          ))}
          <button style={{ ...S.btn(), border: '1px dashed var(--color-border)', color: 'var(--color-muted)' }}
            onClick={() => setForm(f => f ? { ...f, filamentos: [...f.filamentos, emptyFilamento()] } : f)}>
            + Agregar filamento
          </button>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Costos de máquina</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Horas impresión', field: 'horas_impresion' as const },
              { label: 'Minutos', field: 'minutos_impresion' as const },
              { label: 'Precio kWh (ARS)', field: 'precio_kwh' as const },
              { label: 'Consumo máquina (W)', field: 'consumo_maquina_w' as const },
              { label: 'Vida útil repuestos (hs)', field: 'vida_util_repuestos_hs' as const },
              { label: 'Costo repuestos (ARS)', field: 'costo_repuestos' as const },
              { label: 'Insumos adicionales (ARS)', field: 'insumos_adicionales' as const },
              { label: 'Margen de error %', field: 'margen_error_pct' as const },
            ].map(({ label, field }) => (
              <div key={field}>
                <label style={S.label}>{label}</label>
                <input type="number" style={S.input} value={form[field]}
                  onChange={e => setForm(f => f ? { ...f, [field]: Number(e.target.value) } : f)} />
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Insumos · costo por pieza × {totalPiezas} {totalPiezas === 1 ? 'pieza' : 'piezas'}</div>
          {insumosPorCat.map(cat => {
            const ins = form.insumos_usados.filter(i => {
              const orig = insumos.find(io => io.id === i.insumo_id)
              return orig?.categoria === cat
            })
            if (!ins.length) return null
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {CAT_LABELS[cat]}
                </div>
                {ins.map(i => (
                  <div key={i.insumo_id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px', gap: 10, alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
                    <button onClick={() => toggleInsumo(i.insumo_id)} style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: i.activo ? 'var(--color-brand)' : 'var(--color-border-hover)', position: 'relative', transition: 'background 0.15s',
                    }}>
                      <span style={{ position: 'absolute', width: 14, height: 14, background: '#fff', borderRadius: '50%', top: 3, left: i.activo ? 19 : 3, transition: 'left 0.15s' }} />
                    </button>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: i.activo ? 'var(--color-text)' : 'var(--color-muted)' }}>{i.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmt(i.costo_por_pieza)} / pieza</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: i.activo ? 'var(--color-text)' : 'var(--color-muted)', fontWeight: i.activo ? 500 : 400 }}>
                      {i.activo ? `${totalPiezas} × ${fmt(i.costo_por_pieza)} = ${fmt(i.costo_por_pieza * totalPiezas)}` : 'desactivado'}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 13, paddingTop: 4, color: 'var(--color-text)' }}>
            <span>Subtotal insumos</span>
            <span>{fmt(form.insumos_usados.filter(i => i.activo).reduce((s, i) => s + i.costo_por_pieza * totalPiezas, 0))}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>Se suma al costo base. El cliente no lo ve.</p>
        </div>

        <div style={S.card}>
          <div style={S.sectionTitle}>Multiplicador de precio</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>×1</span>
            <input type="range" min={1} max={20} step={0.5} value={form.multiplicador} style={{ flex: 1, accentColor: 'var(--color-brand)' }}
              onChange={e => setForm(f => f ? { ...f, multiplicador: Number(e.target.value) } : f)} />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>×20</span>
            <strong style={{ minWidth: 32, textAlign: 'right', color: 'var(--color-text)' }}>×{form.multiplicador}</strong>
          </div>
        </div>
      </>)}

      {/* Totales */}
      <div style={S.card}>
        {form.modo === 'calculadora' && (
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
            Costo base: {fmt(costo_base)} · Multiplicador: ×{form.multiplicador}
          </div>
        )}
        {form.descuento_porcentaje > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>
            <span>Descuento ({form.descuento_porcentaje}%)</span>
            <span style={{ color: 'var(--color-brand)' }}>−{fmt(precio_venta * form.descuento_porcentaje / (100 - form.descuento_porcentaje))}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>Total para el cliente</span>
          <span style={{ fontWeight: 700, fontSize: 22, color: 'var(--color-text)' }}>{fmt(precio_venta)}</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={S.btn()} onClick={() => setVista('lista')}>Cancelar</button>
        <button style={S.btn()} onClick={() => guardar('borrador')} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button style={S.btn('primary')} onClick={() => guardar('enviado')} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar y marcar enviado'}
        </button>
      </div>
    </div>
  )
}
