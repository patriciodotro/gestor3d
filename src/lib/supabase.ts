import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types ──────────────────────────────────────────────
export type Cliente = {
  id: string
  nombre: string
  email?: string
  telefono?: string
  notas?: string
  created_at: string
}

export type Producto = {
  id: string
  nombre: string
  categoria: string
  precio: number
  stock: number
  costo_material: number
  tiempo_horas: number
  notas?: string
}

export type Insumo = {
  id: string
  nombre: string
  categoria: 'impresion' | 'post_procesado' | 'packaging'
  costo_por_pieza: number
  unidad: string
  activo_por_defecto: boolean
}

export type PresupuestoItem = {
  id?: string
  presupuesto_id?: string
  tipo: 'producto' | 'personalizado'
  producto_id?: string
  descripcion: string
  notas?: string
  cantidad: number
  precio_unitario: number
}

export type PresupuestoFilamento = {
  id?: string
  presupuesto_id?: string
  nombre: string
  costo_por_kg: number
  gramos: number
  desperdicio_pct: number
}

export type PresupuestoInsumo = {
  id?: string
  presupuesto_id?: string
  insumo_id: string
  nombre: string
  costo_por_pieza: number
  cantidad_piezas: number
  activo: boolean
}

export type Presupuesto = {
  id: string
  numero: number
  cliente_id?: string
  cliente_nombre?: string
  estado: 'borrador' | 'enviado' | 'aceptado' | 'rechazado'
  modo: 'rapido' | 'calculadora'
  fecha_entrega?: string
  descuento_porcentaje: number
  notas?: string
  costo_base: number
  precio_venta: number
  horas_impresion: number
  minutos_impresion: number
  precio_kwh: number
  consumo_maquina_w: number
  vida_util_repuestos_hs: number
  costo_repuestos: number
  insumos_adicionales: number
  margen_error_pct: number
  multiplicador: number
  created_at: string
  updated_at: string
  items?: PresupuestoItem[]
  filamentos?: PresupuestoFilamento[]
  insumos_usados?: PresupuestoInsumo[]
}
