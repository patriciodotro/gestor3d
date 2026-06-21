'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const $$ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type InsumoUsado = { insumo_id: string; nombre: string; costo_por_pieza: number }

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  stock: number
  costo_material: number | null
  tiempo_horas: number | null
  notas: string | null
  foto_url: string | null
  gramos: number
  minutos_impresion: number
  cantidad_piezas: number
  filamento_tipo: 'fijo' | 'variable'
  filamento_material: string | null
  filamento_color: string | null
  filamento_marca: string | null
  costo_produccion: number
  precio_venta_sugerido: number
  insumos_usados: InsumoUsado[]
  created_at: string
}

const S = {
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  input: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  btn: (v: 'default' | 'primary' | 'danger' = 'default') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: v === 'primary' ? 'none' : v === 'danger' ? '1px solid var(--color-accent-red-bg)' : '1px solid var(--color-border)',
    background: v === 'primary' ? 'var(--color-brand)' : v === 'danger' ? 'var(--color-accent-red-bg)' : 'transparent',
    color: v === 'primary' ? '#fff' : v === 'danger' ? 'var(--color-accent-red)' : 'var(--color-text)',
  } as React.CSSProperties),
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').order('created_at', { ascending: false })
    setProductos((data || []).map((p: any) => ({ ...p, insumos_usados: p.insumos_usados || [] })))
    setLoading(false)
  }

  async function eliminar(id: string) {
    await supabase.from('productos').delete().eq('id', id)
    setProductos(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
    setDetalle(null)
  }

  const filtrados = productos.filter(p => !search || p.nombre.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)' }}>Productos</h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>Recetas guardadas desde la calculadora</p>
        </div>
      </div>

      <input
        style={{ ...S.input, maxWidth: 280, marginBottom: 20 }}
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No hay productos guardados todavía</p>
          <p style={{ fontSize: 13 }}>Creá uno desde la Calculadora con el botón "Guardar como producto"</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtrados.map(p => (
            <div key={p.id} style={S.card}>
              {/* Imagen */}
              <div
                onClick={() => setDetalle(p)}
                style={{
                  cursor: 'pointer',
                  aspectRatio: '1', width: '100%', background: 'var(--color-surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 36, opacity: 0.3 }}>🧊</span>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px' }} onClick={() => setDetalle(p)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, cursor: 'pointer' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{p.nombre}</h3>
                </div>
                {p.categoria && (
                  <span style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                    {p.categoria}
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-brand)' }}>
                    {$$(p.precio_venta_sugerido || p.precio || 0)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{p.gramos}g</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                    ⏱ {p.tiempo_horas || 0}h {p.minutos_impresion || 0}m
                  </span>
                  {p.filamento_tipo === 'fijo' ? (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-accent-blue-bg)', color: 'var(--color-accent-blue)' }}>
                      {p.filamento_material} {p.filamento_color}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'var(--color-accent-purple-bg)', color: 'var(--color-accent-purple)' }}>
                      Color a elección
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
          onClick={() => setDetalle(null)}>
          <div
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 480, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {detalle.foto_url && (
              <img src={detalle.foto_url} alt={detalle.nombre} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
            )}
            <div style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{detalle.nombre}</h2>
                  {detalle.categoria && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{detalle.categoria}</span>}
                </div>
                <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              {detalle.notas && (
                <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 10, lineHeight: 1.5 }}>{detalle.notas}</p>
              )}

              {/* Receta */}
              <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10 }}>Receta de impresión</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--color-muted)' }}>Gramos:</span> <strong style={{ color: 'var(--color-text)' }}>{detalle.gramos}g</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Tiempo:</span> <strong style={{ color: 'var(--color-text)' }}>{detalle.tiempo_horas || 0}h {detalle.minutos_impresion || 0}m</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Piezas:</span> <strong style={{ color: 'var(--color-text)' }}>{detalle.cantidad_piezas}</strong></div>
                  <div><span style={{ color: 'var(--color-muted)' }}>Stock:</span> <strong style={{ color: 'var(--color-text)' }}>{detalle.stock}</strong></div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--color-muted)' }}>Filamento:</span>{' '}
                  {detalle.filamento_tipo === 'fijo' ? (
                    <strong style={{ color: 'var(--color-text)' }}>{detalle.filamento_material} {detalle.filamento_color} ({detalle.filamento_marca})</strong>
                  ) : (
                    <strong style={{ color: 'var(--color-accent-purple)' }}>A elección del cliente</strong>
                  )}
                </div>
              </div>

              {/* Insumos */}
              {detalle.insumos_usados?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 }}>Insumos / Packaging</div>
                  {detalle.insumos_usados.map(i => (
                    <div key={i.insumo_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text)' }}>{i.nombre}</span>
                      <span style={{ color: 'var(--color-muted)' }}>{$$(i.costo_por_pieza)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Costos */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Costo de producción</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{$$(detalle.costo_produccion)}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Precio sugerido</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand)' }}>{$$(detalle.precio_venta_sugerido)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                {deleteConfirm === detalle.id ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', alignSelf: 'center' }}>¿Eliminar producto?</span>
                    <button style={S.btn('danger')} onClick={() => eliminar(detalle.id)}>Sí, eliminar</button>
                    <button style={S.btn()} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                  </>
                ) : (
                  <button style={S.btn('danger')} onClick={() => setDeleteConfirm(detalle.id)}>Eliminar producto</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
