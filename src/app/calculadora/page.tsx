'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Formato pesos ──────────────────────────────────────
const $$ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// ── Tipos ──────────────────────────────────────────────
type Insumo = { id: string; nombre: string; categoria: string; costo_por_pieza: number; activo_por_defecto: boolean }
type InsumoUso = Insumo & { activo: boolean }

type Config = {
  precio_kg: number
  desperdicio_pct: number
  precio_kwh: number
  consumo_w: number
  costo_impresora: number
  vida_util_hs: number
  margen_error_pct: number
}

const CONFIG_KEY = 'calc3d_config_v1'

const DEFAULT_CONFIG: Config = {
  precio_kg: 18000,
  desperdicio_pct: 10,
  precio_kwh: 140,
  consumo_w: 120,
  costo_impresora: 500000,
  vida_util_hs: 5000,
  margen_error_pct: 10,
}

// ── Sección plegable ────────────────────────────────────
function Section({
  title, icon, children, defaultOpen = true,
}: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e2', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#1a1a18',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          {title}
        </span>
        <span style={{ fontSize: 11, color: '#999', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f0f0ec' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Campo numérico ──────────────────────────────────────
function Field({ label, value, onChange, suffix, prefix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; prefix?: string; step?: number; min?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0da', borderRadius: 8, background: '#fafaf8', overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 10px', color: '#999', fontSize: 12, borderRight: '1px solid #e0e0da', background: '#f5f5f0' }}>{prefix}</span>}
        <input
          type="number" min={min} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, padding: '8px 10px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: '#1a1a18', outline: 'none', width: 0 }}
        />
        {suffix && <span style={{ padding: '0 10px', color: '#999', fontSize: 12, borderLeft: '1px solid #e0e0da', background: '#f5f5f0' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── Fila de resultado ───────────────────────────────────
function ResultRow({ label, value, pct, highlight = false, muted = false }: {
  label: string; value: number; pct?: number; highlight?: boolean; muted?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid #f0f0ec',
      opacity: muted ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 12, color: highlight ? '#1a1a18' : '#666', fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: highlight ? 700 : 500, color: highlight ? '#1a1a18' : '#444' }}>{$$(value)}</span>
        {pct !== undefined && (
          <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{pct.toFixed(0)}%</span>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta de precio sugerido ──────────────────────────
function PriceCard({ label, multiplicador, costoBase, accent }: {
  label: string; multiplicador: number; costoBase: number; accent: string
}) {
  const precio = costoBase * multiplicador
  const ganancia = precio - costoBase
  const pctGanancia = costoBase > 0 ? (ganancia / precio) * 100 : 0
  return (
    <div style={{ border: `2px solid ${accent}20`, borderRadius: 10, padding: '12px 14px', background: `${accent}08` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 }}>
        {label} · ×{multiplicador}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a18', marginBottom: 4 }}>{$$(precio)}</div>
      <div style={{ fontSize: 11, color: '#888' }}>
        Ganancia: <span style={{ color: '#2d7a2d', fontWeight: 600 }}>{$$(ganancia)}</span>
        <span style={{ marginLeft: 6, color: '#aaa' }}>({pctGanancia.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CALCULADORA PRINCIPAL
// ══════════════════════════════════════════════════════
export default function CalculadoraPage() {
  // — Config persistida
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [insumos, setInsumos] = useState<InsumoUso[]>([])

  // — Inputs de trabajo
  const [gramos, setGramos] = useState(100)
  const [horas, setHoras] = useState(3)
  const [minutos, setMinutos] = useState(0)
  const [cantPiezas, setCantPiezas] = useState(1)

  useEffect(() => {
    // Cargar config guardada
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) setConfig(JSON.parse(saved))
    } catch (_) {}
    // Cargar insumos de Supabase
    supabase.from('insumos').select('*').order('categoria').then(({ data }) => {
      if (data) setInsumos(data.map((i: Insumo) => ({ ...i, activo: i.activo_por_defecto })))
    })
  }, [])

  const saveConfig = useCallback((newCfg: Config) => {
    setConfig(newCfg)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(newCfg)) } catch (_) {}
  }, [])

  const setC = (key: keyof Config, val: number) => saveConfig({ ...config, [key]: val })

  // — Cálculos
  const tiempoHs = horas + minutos / 60
  const gramosConDesperdicio = gramos * (1 + config.desperdicio_pct / 100)
  const costoFilamento = (gramosConDesperdicio / 1000) * config.precio_kg
  const costoElectricidad = tiempoHs * (config.consumo_w / 1000) * config.precio_kwh
  const costoAmortizacion = config.vida_util_hs > 0 ? (config.costo_impresora / config.vida_util_hs) * tiempoHs : 0
  const costoInsumos = insumos.filter(i => i.activo).reduce((s, i) => s + i.costo_por_pieza * cantPiezas, 0)
  const subtotal = costoFilamento + costoElectricidad + costoAmortizacion + costoInsumos
  const costoBase = subtotal * (1 + config.margen_error_pct / 100)
  const margenErrorAbs = subtotal * (config.margen_error_pct / 100)

  const costoTotal = costoBase > 0 ? costoBase : 0

  // Porcentajes del costo base
  const pct = (v: number) => costoBase > 0 ? (v / costoBase) * 100 : 0

  // Agrupar insumos por categoría
  const CAT: Record<string, string> = { impresion: 'Impresión', post_procesado: 'Post-procesado', packaging: 'Packaging' }
  const categorias = ['impresion', 'post_procesado', 'packaging']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: 24, alignItems: 'start', maxWidth: 1100, margin: '0 auto' }}>

      {/* ══ COLUMNA IZQUIERDA ══ */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a18', margin: 0 }}>Calculadora FDM</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Calculá el costo real de tu impresión</p>
        </div>

        {/* IMPRESIÓN */}
        <Section title="Impresión" icon="🖨️">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Gramos a imprimir" value={gramos} onChange={setGramos} suffix="g" />
            <Field label="Horas de impresión" value={horas} onChange={setHoras} suffix="hs" />
            <Field label="Minutos" value={minutos} onChange={setMinutos} suffix="min" max={59} />
            <Field label="Cantidad de piezas" value={cantPiezas} onChange={setCantPiezas} min={1} />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f8f4', borderRadius: 8, fontSize: 12, color: '#666' }}>
            Tiempo total: <strong>{horas}h {minutos}m</strong> · Filamento c/desperdicio: <strong>{gramosConDesperdicio.toFixed(1)}g</strong>
          </div>
        </Section>

        {/* FILAMENTO */}
        <Section title="Filamento" icon="🧵">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Precio por kg" value={config.precio_kg} onChange={v => setC('precio_kg', v)} prefix="$" step={100} />
            <Field label="Desperdicio / fallas" value={config.desperdicio_pct} onChange={v => setC('desperdicio_pct', v)} suffix="%" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f8f4', borderRadius: 8, fontSize: 12, color: '#666' }}>
            Costo filamento: <strong>{$$(costoFilamento)}</strong> ({gramosConDesperdicio.toFixed(1)}g × ${(config.precio_kg / 1000).toFixed(0)}/g)
          </div>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>El precio/kg se guarda automáticamente para la próxima vez.</p>
        </Section>

        {/* ELECTRICIDAD */}
        <Section title="Electricidad" icon="⚡" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Precio kWh" value={config.precio_kwh} onChange={v => setC('precio_kwh', v)} prefix="$" step={10} />
            <Field label="Consumo de la impresora" value={config.consumo_w} onChange={v => setC('consumo_w', v)} suffix="W" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f8f4', borderRadius: 8, fontSize: 12, color: '#666' }}>
            Costo electricidad: <strong>{$$(costoElectricidad)}</strong> ({tiempoHs.toFixed(1)}hs × {(config.consumo_w / 1000).toFixed(3)}kW × ${config.precio_kwh}/kWh)
          </div>
        </Section>

        {/* AMORTIZACIÓN */}
        <Section title="Amortización de impresora" icon="🔧" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Costo de la impresora" value={config.costo_impresora} onChange={v => setC('costo_impresora', v)} prefix="$" step={1000} />
            <Field label="Vida útil estimada" value={config.vida_util_hs} onChange={v => setC('vida_util_hs', v)} suffix="hs" step={100} />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f8f4', borderRadius: 8, fontSize: 12, color: '#666' }}>
            Costo amortización: <strong>{$$(costoAmortizacion)}</strong> (${(config.costo_impresora / config.vida_util_hs).toFixed(1)}/hs × {tiempoHs.toFixed(1)}hs)
          </div>
        </Section>

        {/* INSUMOS */}
        <Section title="Insumos" icon="📦" defaultOpen={false}>
          {insumos.length === 0 ? (
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 12 }}>No hay insumos cargados. Agregá insumos desde la sección Insumos.</p>
          ) : (
            <>
              <div style={{ marginTop: 12, marginBottom: 8, fontSize: 12, color: '#888' }}>
                Activá los insumos que vas a usar en esta impresión · {cantPiezas} {cantPiezas === 1 ? 'pieza' : 'piezas'}
              </div>
              {categorias.map(cat => {
                const items = insumos.filter(i => i.categoria === cat)
                if (!items.length) return null
                return (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 }}>
                      {CAT[cat]}
                    </div>
                    {items.map(ins => (
                      <div key={ins.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f5f5f0' }}>
                        {/* Toggle */}
                        <button
                          onClick={() => setInsumos(prev => prev.map(i => i.id === ins.id ? { ...i, activo: !i.activo } : i))}
                          style={{
                            width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                            background: ins.activo ? '#16a34a' : '#d0d0c8', position: 'relative', transition: 'background 0.15s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: '50%',
                            top: 3, left: ins.activo ? 19 : 3, transition: 'left 0.15s',
                          }} />
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: ins.activo ? '#1a1a18' : '#aaa' }}>{ins.nombre}</div>
                          <div style={{ fontSize: 11, color: '#bbb' }}>{$$(ins.costo_por_pieza)} / pieza</div>
                        </div>
                        <div style={{ fontSize: 12, color: ins.activo ? '#1a1a18' : '#ccc', fontWeight: ins.activo ? 600 : 400, textAlign: 'right' as const }}>
                          {ins.activo ? $$(ins.costo_por_pieza * cantPiezas) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13, paddingTop: 8, borderTop: '2px solid #e8e8e2' }}>
                <span>Total insumos</span>
                <span>{$$(costoInsumos)}</span>
              </div>
            </>
          )}
        </Section>

        {/* MARGEN DE ERROR */}
        <Section title="Margen de error / imprevistos" icon="⚠️" defaultOpen={false}>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>Porcentaje de margen</label>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{config.margen_error_pct}%</span>
            </div>
            <input
              type="range" min={0} max={50} step={1} value={config.margen_error_pct}
              onChange={e => setC('margen_error_pct', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#16a34a' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#ccc', marginTop: 2 }}>
              <span>0%</span><span>50%</span>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8f8f4', borderRadius: 8, fontSize: 12, color: '#666' }}>
              Agrega <strong>{$$(margenErrorAbs)}</strong> al costo base como colchón de imprevistos.
            </div>
          </div>
        </Section>
      </div>

      {/* ══ COLUMNA DERECHA — RESULTADOS ══ */}
      <div style={{ position: 'sticky', top: 24 }}>
        <div style={{ background: '#1a1a18', borderRadius: 16, padding: 20, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>
            Costo de producción
          </div>

          {/* Desglose */}
          <div style={{ marginBottom: 16 }}>
            <ResultRow label="Filamento" value={costoFilamento} pct={pct(costoFilamento)} />
            <ResultRow label="Electricidad" value={costoElectricidad} pct={pct(costoElectricidad)} />
            <ResultRow label="Amortización" value={costoAmortizacion} pct={pct(costoAmortizacion)} />
            <ResultRow label={`Insumos (${insumos.filter(i => i.activo).length} activos)`} value={costoInsumos} pct={pct(costoInsumos)} muted={costoInsumos === 0} />
            <ResultRow label={`Margen error (${config.margen_error_pct}%)`} value={margenErrorAbs} pct={pct(margenErrorAbs)} />
          </div>

          {/* Total costo */}
          <div style={{ background: '#2a2a28', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Costo total de producción</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{$$(costoTotal)}</div>
            {cantPiezas > 1 && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                {$$(costoTotal / cantPiezas)} por pieza
              </div>
            )}
          </div>

          {/* Precios sugeridos */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12 }}>
            Precios de venta sugeridos
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            <PriceCard label="Económico" multiplicador={2.5} costoBase={costoTotal} accent="#888" />
            <PriceCard label="Estándar" multiplicador={4} costoBase={costoTotal} accent="#16a34a" />
            <PriceCard label="Premium" multiplicador={6} costoBase={costoTotal} accent="#2563eb" />
          </div>

          <p style={{ fontSize: 10, color: '#555', marginTop: 14, lineHeight: 1.5 }}>
            Los multiplicadores son orientativos. Ajustá según tu mercado, tiempo de diseño y valor del trabajo.
          </p>
        </div>
      </div>
    </div>
  )
}

