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
  // margen personalizado
  margen_modo: 'multiplicador' | 'porcentaje'
  margen_multiplicador: number
  margen_porcentaje: number
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
  margen_modo: 'multiplicador',
  margen_multiplicador: 4,
  margen_porcentaje: 75,
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

// ── Subsección dentro de un desplegable (sin caja propia) ──
function SubSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
        <span style={{ fontSize: 14 }}>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, suffix, prefix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; prefix?: string; step?: number; min?: number
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500, display: 'block', marginBottom: 4 }}>{label}</label>
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

// ── Tarjeta de precio (modo fijo: multiplicador) ────────
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

// ── Tarjeta "Con margen" — se ve igual que las demás ────
function PriceCardCustom({ costoBase, accent, modo, multiplicador, porcentaje }: {
  costoBase: number; accent: string
  modo: 'multiplicador' | 'porcentaje'
  multiplicador: number; porcentaje: number
}) {
  const precio = modo === 'multiplicador'
    ? costoBase * multiplicador
    : costoBase * (1 + porcentaje / 100)
  const ganancia = precio - costoBase
  const pctGanancia = precio > 0 ? (ganancia / precio) * 100 : 0
  const sublabel = modo === 'multiplicador' ? `Tu margen · ×${multiplicador}` : `Tu margen · ${porcentaje}%`

  return (
    <div style={{ background: '#2a2a28', borderRadius: 10, padding: '12px 14px', border: `1px solid ${accent}30` }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-muted-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Con margen</div>
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
  const [showGuardar, setShowGuardar] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) setConfig(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch (_) {}
    supabase.from('insumos').select('*').order('categoria').then(({ data }) => {
      if (data) setInsumos(data.map((i: Insumo) => ({ ...i, activo: i.activo_por_defecto })))
    })
  }, [])

  const saveConfig = useCallback((newCfg: Config) => {
    setConfig(newCfg)
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(newCfg)) } catch (_) {}
  }, [])

  const setC = <K extends keyof Config>(key: K, val: Config[K]) => saveConfig({ ...config, [key]: val })

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
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      {/* Título a todo el ancho */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Calculadora FDM</h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>Calculá el costo real de tu impresión</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

      {/* ══ IZQUIERDA ══ */}
      <div>
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
        <Section title="Filamento" icon="🧵">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Precio por kg" value={config.precio_kg} onChange={v => setC('precio_kg', v)} prefix="$" step={500} />
            <Field label="Desperdicio / fallas" value={config.desperdicio_pct} onChange={v => setC('desperdicio_pct', v)} suffix="%" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
            Filamento c/desperdicio: <strong>{gramosConDesperdicio.toFixed(1)}g</strong> → <strong>{$$(costoFilamento)}</strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6 }}>El precio/kg se guarda automáticamente.</p>
        </Section>

        {/* MARGEN DE GANANCIA PERSONALIZADO */}
        <Section title="Margen de ganancia" icon="💰">
          <div style={{ marginTop: 12 }}>
            {/* Toggle modo */}
            <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 14 }}>
              {(['multiplicador', 'porcentaje'] as const).map(m => (
                <button key={m} onClick={() => setC('margen_modo', m)} style={{
                  padding: '6px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: config.margen_modo === m ? '#fb923c' : 'transparent',
                  color: config.margen_modo === m ? '#1a1a18' : 'var(--color-muted)',
                }}>
                  {m === 'multiplicador' ? 'Multiplicador (×)' : 'Porcentaje (%)'}
                </button>
              ))}
            </div>

            {config.margen_modo === 'multiplicador' ? (
              <>
                <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Multiplicador rápido</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[2, 2.5, 3, 3.5].map(v => (
                    <button key={v} onClick={() => setC('margen_multiplicador', v)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      border: config.margen_multiplicador === v ? '1px solid #fb923c' : '1px solid var(--color-border)',
                      background: config.margen_multiplicador === v ? '#fb923c20' : 'transparent',
                      color: config.margen_multiplicador === v ? '#fb923c' : 'var(--color-text)',
                    }}>
                      ×{v}
                    </button>
                  ))}
                </div>
                <Field label="Multiplicador personalizado" value={config.margen_multiplicador} onChange={v => setC('margen_multiplicador', v)} prefix="×" step={0.1} min={1} />
              </>
            ) : (
              <Field label="Porcentaje de ganancia deseado" value={config.margen_porcentaje} onChange={v => setC('margen_porcentaje', v)} suffix="%" step={5} />
            )}

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
              Precio final: <strong>
                {config.margen_modo === 'multiplicador'
                  ? $$(costoBase * config.margen_multiplicador)
                  : $$(costoBase * (1 + config.margen_porcentaje / 100))}
              </strong>
            </div>
          </div>
        </Section>

        {/* INSUMOS */}
        <Section title="Insumos" icon="📦" defaultOpen={false}>
          {insumos.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 12 }}>No hay insumos cargados. Agregá desde la sección Insumos.</p>
          ) : (
            <>
              <div style={{ marginTop: 12, marginBottom: 8, fontSize: 12, color: 'var(--color-muted)' }}>
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
                          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{$$(ins.costo_por_pieza)} / pieza</div>
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

        {/* VARIABLES FIJAS — agrupa Electricidad + Amortización + Margen de error */}
        <Section title="Variables fijas" icon="⚙️" defaultOpen={false}>
          <SubSection title="Electricidad" icon="⚡">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Precio kWh" value={config.precio_kwh} onChange={v => setC('precio_kwh', v)} prefix="$" step={10} />
              <Field label="Consumo de la impresora" value={config.consumo_w} onChange={v => setC('consumo_w', v)} suffix="W" />
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
              {tiempoHs.toFixed(1)}hs × {(config.consumo_w/1000).toFixed(3)}kW × ${config.precio_kwh}/kWh = <strong>{$$(costoElectricidad)}</strong>
            </div>
          </SubSection>

          <SubSection title="Amortización de impresora" icon="🔧">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Costo de la impresora" value={config.costo_impresora} onChange={v => setC('costo_impresora', v)} prefix="$" step={10000} />
              <Field label="Vida útil estimada" value={config.vida_util_hs} onChange={v => setC('vida_util_hs', v)} suffix="hs" step={100} />
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)' }}>
              ${(config.costo_impresora / config.vida_util_hs).toFixed(1)}/hs × {tiempoHs.toFixed(1)}hs = <strong>{$$(costoAmortizacion)}</strong>
            </div>
          </SubSection>

          <SubSection title="Margen de error / imprevistos" icon="⚠️">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>Colchón de imprevistos</label>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{config.margen_error_pct}%</span>
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
          </SubSection>
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
              <PriceCardCustom
                costoBase={costoBase}
                accent="#fb923c"
                modo={config.margen_modo}
                multiplicador={config.margen_multiplicador}
                porcentaje={config.margen_porcentaje}
              />
              <PriceCard label="Premium" sublabel="Alta complejidad" mult={4} costoBase={costoBase} accent="#60a5fa" />
            </div>
          </div>

          <p style={{ fontSize: 10, color: '#444', marginTop: 14, lineHeight: 1.5 }}>
            Los multiplicadores son orientativos. Ajustá según complejidad, diseño y mercado.
          </p>

          <button
            onClick={() => setShowGuardar(true)}
            style={{
              width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            📦 Guardar como producto
          </button>
        </div>
      </div>
      </div>

      {/* MODAL: Guardar como producto */}
      {showGuardar && (
        <GuardarProductoModal
          onClose={() => setShowGuardar(false)}
          datosCalculados={{
            gramos, horas, minutos, cantPiezas,
            precio_kg: config.precio_kg,
            desperdicio_pct: config.desperdicio_pct,
            precio_kwh: config.precio_kwh,
            consumo_w: config.consumo_w,
            costo_impresora: config.costo_impresora,
            vida_util_hs: config.vida_util_hs,
            margen_error_pct: config.margen_error_pct,
            costo_produccion: costoBase,
            precio_venta_sugerido: costoBase * 3,
            insumos_usados: insumos.filter(i => i.activo).map(i => ({
              insumo_id: i.id, nombre: i.nombre, costo_por_pieza: i.costo_por_pieza,
            })),
          }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// MODAL: Guardar como producto
// ══════════════════════════════════════════════════════
type DatosCalculados = {
  gramos: number; horas: number; minutos: number; cantPiezas: number
  precio_kg: number; desperdicio_pct: number; precio_kwh: number; consumo_w: number
  costo_impresora: number; vida_util_hs: number; margen_error_pct: number
  costo_produccion: number; precio_venta_sugerido: number
  insumos_usados: { insumo_id: string; nombre: string; costo_por_pieza: number }[]
}

function GuardarProductoModal({ onClose, datosCalculados: d }: { onClose: () => void; datosCalculados: DatosCalculados }) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [notas, setNotas] = useState('')
  const [filamentoTipo, setFilamentoTipo] = useState<'fijo' | 'variable'>('variable')
  const [filMaterial, setFilMaterial] = useState('PLA')
  const [filColor, setFilColor] = useState('')
  const [filMarca, setFilMarca] = useState('')
  const [precioVenta, setPrecioVenta] = useState(Math.round(d.precio_venta_sugerido))
  const [stock, setStock] = useState(0)

  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUrlManual, setFotoUrlManual] = useState('')
  const [modoFoto, setModoFoto] = useState<'subir' | 'url'>('subir')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function handleRemoveFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
  }

  async function handleGuardar() {
    if (!nombre.trim()) { setError('Ponele un nombre al producto.'); return }
    setGuardando(true)
    setError('')

    let foto_url: string | null = null

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
        nombre: nombre.trim(),
        categoria: categoria.trim() || null,
        precio: precioVenta,
        stock,
        costo_material: d.costo_produccion,
        tiempo_horas: d.horas,
        notas: notas.trim() || null,
        foto_url,
        gramos: d.gramos,
        minutos_impresion: d.minutos,
        cantidad_piezas: d.cantPiezas,
        filamento_tipo: filamentoTipo,
        filamento_material: filamentoTipo === 'fijo' ? filMaterial : null,
        filamento_color: filamentoTipo === 'fijo' ? filColor : null,
        filamento_marca: filamentoTipo === 'fijo' ? filMarca : null,
        precio_kg: d.precio_kg,
        desperdicio_pct: d.desperdicio_pct,
        precio_kwh: d.precio_kwh,
        consumo_w: d.consumo_w,
        costo_impresora: d.costo_impresora,
        vida_util_hs: d.vida_util_hs,
        margen_error_pct: d.margen_error_pct,
        costo_produccion: d.costo_produccion,
        precio_venta_sugerido: precioVenta,
        insumos_usados: d.insumos_usados,
      }

      const { error: insErr } = await supabase.from('productos').insert(payload)
      if (insErr) throw insErr

      onClose()
    } catch (e: any) {
      setError(e.message || 'Error al guardar el producto.')
    }
    setGuardando(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid var(--color-border)',
    borderRadius: 8, background: 'var(--color-input-bg)', color: 'var(--color-text)', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
      onClick={onClose}>
      <div
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: 480, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginTop: 0, marginBottom: 4 }}>Guardar como producto</h2>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 18 }}>
          Receta: {d.gramos}g · {d.horas}h {d.minutos}m · {d.cantPiezas} {d.cantPiezas === 1 ? 'pieza' : 'piezas'}
        </p>

        {error && (
          <div style={{ background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Nombre y categoría */}
          <div>
            <label style={labelStyle}>Nombre del producto *</label>
            <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Maceta hexagonal grande" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Categoría</label>
              <input style={inputStyle} value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ej: Wuly, Lenga..." />
            </div>
            <div>
              <label style={labelStyle}>Stock inicial</label>
              <input type="number" style={inputStyle} value={stock} onChange={e => setStock(Number(e.target.value))} />
            </div>
          </div>

          {/* Foto */}
          <div>
            <label style={labelStyle}>Foto del producto</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['subir', 'url'] as const).map(m => (
                <button key={m} onClick={() => { setModoFoto(m); if (m === 'url') handleRemoveFoto() }} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer',
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
                    <button
                      onClick={handleRemoveFoto}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                        border: '1px solid var(--color-accent-red-bg)', background: 'var(--color-accent-red-bg)', color: 'var(--color-accent-red)',
                      }}
                    >
                      ✕ Quitar foto
                    </button>
                  </div>
                )}
              </>
            ) : (
              <input style={inputStyle} value={fotoUrlManual} onChange={e => setFotoUrlManual(e.target.value)} placeholder="https://..." />
            )}
          </div>

          {/* Filamento fijo o variable */}
          <div>
            <label style={labelStyle}>Filamento / color</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => setFilamentoTipo('variable')} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer',
                background: filamentoTipo === 'variable' ? 'var(--color-accent-purple)' : 'transparent',
                color: filamentoTipo === 'variable' ? '#1a1a18' : 'var(--color-text)',
              }}>
                A elección del cliente
              </button>
              <button onClick={() => setFilamentoTipo('fijo')} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer',
                background: filamentoTipo === 'fijo' ? 'var(--color-accent-blue)' : 'transparent',
                color: filamentoTipo === 'fijo' ? '#1a1a18' : 'var(--color-text)',
              }}>
                Color fijo
              </button>
            </div>
            {filamentoTipo === 'fijo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input style={inputStyle} value={filMaterial} onChange={e => setFilMaterial(e.target.value)} placeholder="Material" />
                <input style={inputStyle} value={filColor} onChange={e => setFilColor(e.target.value)} placeholder="Color" />
                <input style={inputStyle} value={filMarca} onChange={e => setFilMarca(e.target.value)} placeholder="Marca" />
              </div>
            )}
          </div>

          {/* Insumos usados (resumen, no editable acá) */}
          {d.insumos_usados.length > 0 && (
            <div>
              <label style={labelStyle}>Insumos / packaging incluidos</label>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {d.insumos_usados.map(i => (
                  <span key={i.insumo_id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                    {i.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Precio de venta */}
          <div>
            <label style={labelStyle}>Precio de venta final</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="number" style={inputStyle} value={precioVenta} onChange={e => setPrecioVenta(Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap' as const }}>
                Costo: {$$(d.costo_produccion)}
              </span>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>Notas (opcional)</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Detalles de la receta, variantes, etc." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </div>
    </div>
  )
}
