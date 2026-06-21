'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const $$ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

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
function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>{title}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--color-border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, suffix, prefix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; prefix?: string; step?: number; min?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#888', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-input-bg)', overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 10px', color: 'var(--color-muted)', fontSize: 12, borderRight: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>{prefix}</span>}
        <input type="number" min={min} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, padding: '8px 10px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: 'var(--color-text)', outline: 'none', width: 0 }} />
        {suffix && <span style={{ padding: '0 10px', color: 'var(--color-muted)', fontSize: 12, borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── Barra de porcentaje ─────────────────────────────────
function CostBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{$$(value)}</span>
          <span style={{ fontSize: 11, color: 'var(--color-muted-2)', minWidth: 32, textAlign: 'right' as const }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: '#2a2a28', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ── Tarjeta de precio ───────────────────────────────────
function PriceCard({ label, mult, costoBase, accent, sublabel }: {
  label: string; mult: number; costoBase: number; accent: string; sublabel: string
}) {
  const precio = costoBase * mult
  const ganancia = precio - costoBase
  const pctGanancia = precio > 0 ? (ganancia / precio) * 100 : 0
  return (
    <div style={{ background: '#2a2a28', borderRadius: 10, padding: '12px 14px', border: `1px solid ${accent}30` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>{sublabel}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, marginBottom: 6 }}>{$$(precio)}</div>
      <div style={{ fontSize: 11, color: '#888' }}>
        Ganancia: <span style={{ color: '#4ade80', fontWeight: 600 }}>{$$(ganancia)}</span>
        <span style={{ color: '#555', marginLeft: 4 }}>({pctGanancia.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
export default function CalculadoraPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [insumos, setInsumos] = useState<InsumoUso[]>([])
  const [gramos, setGramos] = useState(100)
  const [horas, setHoras] = useState(3)
  const [minutos, setMinutos] = useState(0)
  const [cantPiezas, setCantPiezas] = useState(1)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) setConfig(JSON.parse(saved))
    } catch (_) {}
    supabase.from('insumos').select('*').order('categoria').then(({ data }) => {
      if (data) setInsumos(data.map((i: Insumo) => ({ ...i, activo: i.activo_por_defecto })))
    })
  }, [])

  const saveConfig = useCallback((newCfg: Config) => {
    setConfig(newCfg)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(newCfg)) } catch (_) {}
  }, [])

  const setC = (key: keyof Config, val: number) => saveConfig({ ...config, [key]: val })

  const tiempoHs = horas + minutos / 60
  const gramosConDesperdicio = gramos * (1 + config.desperdicio_pct / 100)
  const costoFilamento = (gramosConDesperdicio / 1000) * config.precio_kg
  const costoElectricidad = tiempoHs * (config.consumo_w / 1000) * config.precio_kwh
  const costoAmortizacion = config.vida_util_hs > 0 ? (config.costo_impresora / config.vida_util_hs) * tiempoHs : 0
  const costoInsumos = insumos.filter(i => i.activo).reduce((s, i) => s + i.costo_por_pieza * cantPiezas, 0)
  const subtotal = costoFilamento + costoElectricidad + costoAmortizacion + costoInsumos
  const margenAbs = subtotal * (config.margen_error_pct / 100)
  const costoBase = subtotal + margenAbs

  const pct = (v: number) => costoBase > 0 ? (v / costoBase) * 100 : 0

  const CAT: Record<string, string> = { impresion: 'Impresión', post_procesado: 'Post-procesado', packaging: 'Packaging' }
  const categorias = ['impresion', 'post_procesado', 'packaging']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, padding: 24, alignItems: 'start', maxWidth: 1080, margin: '0 auto' }}>

      {/* ══ IZQUIERDA ══ */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Calculadora FDM</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Calculá el costo real de tu impresión</p>
        </div>

        {/* IMPRESIÓN */}
        <Section title="Impresión" icon="🖨️">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Gramos" value={gramos} onChange={setGramos} suffix="g" />
            <Field label="Horas" value={horas} onChange={setHoras} suffix="hs" />
            <Field label="Minutos" value={minutos} onChange={setMinutos} suffix="min" />
            <Field label="Piezas" value={cantPiezas} onChange={setCantPiezas} min={1} />
          </div>
        </Section>

        {/* FILAMENTO */}
        <Section title="Filamento" icon="🧵" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Precio por kg" value={config.precio_kg} onChange={v => setC('precio_kg', v)} prefix="$" step={500} />
            <Field label="Desperdicio / fallas" value={config.desperdicio_pct} onChange={v => setC('desperdicio_pct', v)} suffix="%" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
            Filamento c/desperdicio: <strong>{gramosConDesperdicio.toFixed(1)}g</strong> → <strong>{$$(costoFilamento)}</strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>El precio/kg se guarda automáticamente.</p>
        </Section>

        {/* ELECTRICIDAD */}
        <Section title="Electricidad" icon="⚡" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Precio kWh" value={config.precio_kwh} onChange={v => setC('precio_kwh', v)} prefix="$" step={10} />
            <Field label="Consumo de la impresora" value={config.consumo_w} onChange={v => setC('consumo_w', v)} suffix="W" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
            {tiempoHs.toFixed(1)}hs × {(config.consumo_w/1000).toFixed(3)}kW × ${config.precio_kwh}/kWh = <strong>{$$(costoElectricidad)}</strong>
          </div>
        </Section>

        {/* AMORTIZACIÓN */}
        <Section title="Amortización de impresora" icon="🔧" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Costo de la impresora" value={config.costo_impresora} onChange={v => setC('costo_impresora', v)} prefix="$" step={10000} />
            <Field label="Vida útil estimada" value={config.vida_util_hs} onChange={v => setC('vida_util_hs', v)} suffix="hs" step={100} />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
            ${(config.costo_impresora / config.vida_util_hs).toFixed(1)}/hs × {tiempoHs.toFixed(1)}hs = <strong>{$$(costoAmortizacion)}</strong>
          </div>
        </Section>

        {/* INSUMOS */}
        <Section title="Insumos" icon="📦" defaultOpen={false}>
          {insumos.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 12 }}>No hay insumos cargados. Agregá desde la sección Insumos.</p>
          ) : (
            <>
              <div style={{ marginTop: 12, marginBottom: 8, fontSize: 12, color: '#888' }}>
                Activá los que vas a usar · {cantPiezas} {cantPiezas === 1 ? 'pieza' : 'piezas'}
              </div>
              {categorias.map(cat => {
                const items = insumos.filter(i => i.categoria === cat)
                if (!items.length) return null
                return (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 }}>
                      {CAT[cat]}
                    </div>
                    {items.map(ins => (
                      <div key={ins.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                        <button
                          onClick={() => setInsumos(prev => prev.map(i => i.id === ins.id ? { ...i, activo: !i.activo } : i))}
                          style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: ins.activo ? '#16a34a' : '#d0d0c8', position: 'relative', transition: 'background 0.15s' }}>
                          <span style={{ position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: '50%', top: 3, left: ins.activo ? 19 : 3, transition: 'left 0.15s' }} />
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: ins.activo ? 'var(--color-text)' : 'var(--color-muted)' }}>{ins.nombre}</div>
                          <div style={{ fontSize: 11, color: '#bbb' }}>{$$(ins.costo_por_pieza)} / pieza</div>
                        </div>
                        <div style={{ fontSize: 12, color: ins.activo ? 'var(--color-text)' : 'var(--color-muted)', fontWeight: ins.activo ? 600 : 400 }}>
                          {ins.activo ? $$(ins.costo_por_pieza * cantPiezas) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13, paddingTop: 8, borderTop: '2px solid var(--color-border)' }}>
                <span>Total insumos</span><span>{$$(costoInsumos)}</span>
              </div>
            </>
          )}
        </Section>

        {/* MARGEN */}
        <Section title="Margen de error / imprevistos" icon="⚠️" defaultOpen={false}>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>Colchón de imprevistos</label>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{config.margen_error_pct}%</span>
            </div>
            <input type="range" min={0} max={50} step={1} value={config.margen_error_pct}
              onChange={e => setC('margen_error_pct', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#16a34a' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-muted-2)', marginTop: 2 }}>
              <span>0%</span><span>50%</span>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
              Agrega <strong>{$$(margenAbs)}</strong> al subtotal como colchón.
            </div>
          </div>
        </Section>
      </div>

      {/* ══ DERECHA — RESULTADOS ══ */}
      <div style={{ position: 'sticky', top: 24 }}>
        <div style={{ background: '#1a1a18', borderRadius: 16, padding: 20, color: '#fff' }}>

          {/* 1. COSTO TOTAL + resumen impresión */}
          <div style={{ background: '#111110', borderRadius: 12, padding: '16px', marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>
              Costo total de producción
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 8 }}>
              {$$(costoBase)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ background: '#1a1a18', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#888' }}>
                ⏱ {horas}h {minutos}m
              </div>
              <div style={{ background: '#1a1a18', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#888' }}>
                🧵 {gramosConDesperdicio.toFixed(0)}g
              </div>
              {cantPiezas > 1 && (
                <div style={{ background: '#1a1a18', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#888' }}>
                  {$$(costoBase / cantPiezas)}/u
                </div>
              )}
            </div>
          </div>

          {/* 2. DESGLOSE con barras */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>
              Desglose de costos
            </div>
            <CostBar label="Filamento" value={costoFilamento} pct={pct(costoFilamento)} color="#f97316" />
            <CostBar label="Electricidad" value={costoElectricidad} pct={pct(costoElectricidad)} color="#3b82f6" />
            <CostBar label="Amortización" value={costoAmortizacion} pct={pct(costoAmortizacion)} color="#eab308" />
            {costoInsumos > 0 && (
              <CostBar label={`Insumos (${insumos.filter(i=>i.activo).length})`} value={costoInsumos} pct={pct(costoInsumos)} color="#a78bfa" />
            )}
            <CostBar label={`Margen error (${config.margen_error_pct}%)`} value={margenAbs} pct={pct(margenAbs)} color="#6b7280" />
          </div>

          {/* 3. PRECIOS SUGERIDOS */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>
              Precios de venta sugeridos
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PriceCard label="Mínimo" sublabel="Solo para cubrir costos" mult={1.5} costoBase={costoBase} accent="#9ca3af" />
              <PriceCard label="Recomendado" sublabel="Margen saludable" mult={3} costoBase={costoBase} accent="#4ade80" />
              <PriceCard label="Con margen" sublabel="Valor agregado" mult={4} costoBase={costoBase} accent="#fb923c" />
              <PriceCard label="Premium" sublabel="Alta complejidad" mult={6} costoBase={costoBase} accent="#60a5fa" />
            </div>
          </div>

          <p style={{ fontSize: 10, color: '#444', marginTop: 14, lineHeight: 1.5 }}>
            Los multiplicadores son orientativos. Ajustá según complejidad, diseño y mercado.
          </p>
        </div>
      </div>
    </div>
  )
}
