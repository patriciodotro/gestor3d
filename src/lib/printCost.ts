// ── Costo de impresión "bruto" compartido entre Calculadora y Productos ──
// Mismo criterio que usa la Calculadora FDM, pero exponiendo solo el costo
// puro de imprimir (filamento + electricidad + amortización), sin margen de
// error ni insumos — para que Productos pueda mostrar el costo de impresión
// "limpio" y sumarle aparte los componentes / packaging de cada ficha.

export type CalcConfig = {
  precio_kg: number
  desperdicio_pct: number
  precio_kwh: number
  consumo_w: number
  costo_impresora: number
  vida_util_hs: number
}

export const CALC_CONFIG_KEY = 'calc3d_config_v1'

export const DEFAULT_CALC_CONFIG: CalcConfig = {
  precio_kg: 18000,
  desperdicio_pct: 10,
  precio_kwh: 140,
  consumo_w: 120,
  costo_impresora: 500000,
  vida_util_hs: 5000,
}

// Lee la configuración guardada por la Calculadora (localStorage). Si no hay
// nada guardado todavía, devuelve los valores por defecto de la Calculadora.
export function loadCalcConfig(): CalcConfig {
  if (typeof window === 'undefined') return DEFAULT_CALC_CONFIG
  try {
    const saved = window.localStorage.getItem(CALC_CONFIG_KEY)
    if (saved) return { ...DEFAULT_CALC_CONFIG, ...JSON.parse(saved) }
  } catch (_) {}
  return DEFAULT_CALC_CONFIG
}

export type DesgloseImpresion = {
  tiempoHs: number
  gramosConDesperdicio: number
  costoFilamento: number
  costoElectricidad: number
  costoAmortizacion: number
  total: number
}

// gramos y horas/minutos son los de la tirada completa (todas las piezas).
export function costoImpresion(gramos: number, horas: number, minutos: number, config: CalcConfig): DesgloseImpresion {
  const tiempoHs = horas + minutos / 60
  const gramosConDesperdicio = gramos * (1 + config.desperdicio_pct / 100)
  const costoFilamento = (gramosConDesperdicio / 1000) * config.precio_kg
  const costoElectricidad = tiempoHs * (config.consumo_w / 1000) * config.precio_kwh
  const costoAmortizacion = config.vida_util_hs > 0 ? (config.costo_impresora / config.vida_util_hs) * tiempoHs : 0
  return {
    tiempoHs,
    gramosConDesperdicio,
    costoFilamento,
    costoElectricidad,
    costoAmortizacion,
    total: costoFilamento + costoElectricidad + costoAmortizacion,
  }
}

export const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
