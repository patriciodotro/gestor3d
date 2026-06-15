'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Filamento = {
  id: string
  material: string
  tipo: string
  marca: string
  color: string
  nivel: string
  estante: string
  posicion: string
}

type SortKey = keyof Omit<Filamento, 'id'>

// ─── Constantes maestras ──────────────────────────────────────────────────────

const MATERIALES = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Support', 'Resina']
const TIPOS = ['Normal', 'Traslucido', 'Wood', 'Metal', 'ART', 'Fluo', 'Flex', 'Boutique', 'Silk', 'Matte', 'Lite', 'Basic', 'Stone']
const MARCAS = ['Grilon3', 'Printalot', 'Bambu Lab', 'IIID MAX', 'Ender', 'Elegoo', 'Polymaker', 'eSUN', '3N3', 'Hellbot', 'Toolbox']
const COLORES = ['Amarillo','Ambar','Arrayan','Blanco','Blanco Calido','Bordo','Caliza','Cobre','Dorado','Dulce de Leche','Gris','Marron','Nafta Super','Naranja','Natural','Negro','Piedra','Piel 720','Pino','Tan','Verde','Verde Militar','Marron Oscuro','Marron Claro','Azul','Celeste','Rosa','Violeta','Rojo']
const ESTANTES = ['Estante Alto', 'Estante Medio', 'Estante Bajo', 'Rack']
const NIVELES = ['Cerrado', 'Lleno', 'Tres cuartos', 'Medio', 'Poco']
const POSICIONES = [
  'AD 1','AD 2','AD 3','AD 4','AD 5','AD 6','AD 7','AD 8','AD 9','AD 10',
  'AD 11','AD 12','AD 13','AD 14','AD 15','AD 16','AD 17','AD 18','AD 19','AD 20','AD 21',
  'AT 1','AT 2','AT 3','AT 4','AT 5','AT 6','AT 7','AT 8','AT 9','AT 10',
  'AT 11','AT 12','AT 13','AT 14','AT 15','AT 16','AT 17','AT 18','AT 19','AT 20','AT 21',
]

const NIVEL_COLOR: Record<string, string> = {
  'Cerrado':      'bg-blue-100 text-blue-800',
  'Lleno':        'bg-green-100 text-green-800',
  'Tres cuartos': 'bg-emerald-100 text-emerald-800',
  'Medio':        'bg-yellow-100 text-yellow-800',
  'Poco':         'bg-red-100 text-red-800',
}

const EMPTY: Omit<Filamento, 'id'> = {
  material: 'PLA', tipo: 'Normal', marca: 'Grilon3',
  color: 'Negro', nivel: 'Lleno', estante: 'Rack', posicion: 'AT 1',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FilamentosPage() {
  const [filamentos, setFilamentos] = useState<Filamento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Omit<Filamento, 'id'>>(EMPTY)
  const [showAdd, setShowAdd] = useState(false)
  const [newDraft, setNewDraft] = useState<Omit<Filamento, 'id'>>(EMPTY)
  const [search, setSearch] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterEstante, setFilterEstante] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('posicion')
  const [sortAsc, setSortAsc] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Cargar
  const fetchFilamentos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('filamentos')
      .select('*')
      .order('estante')
      .order('posicion')
    if (!error && data) setFilamentos(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchFilamentos() }, [fetchFilamentos])

  // Filtrar + ordenar
  const filtered = filamentos
    .filter(f => {
      const q = search.toLowerCase()
      const matchSearch = !q || [f.material, f.tipo, f.marca, f.color, f.estante, f.posicion]
        .some(v => v.toLowerCase().includes(q))
      return matchSearch
        && (!filterMaterial || f.material === filterMaterial)
        && (!filterEstante || f.estante === filterEstante)
        && (!filterNivel || f.nivel === filterNivel)
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  // Ordenar por columna
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  // Guardar edición
  const handleSaveEdit = async (id: string) => {
    setSaving(id)
    const { error } = await supabase.from('filamentos').update(editDraft).eq('id', id)
    if (!error) {
      setFilamentos(prev => prev.map(f => f.id === id ? { ...f, ...editDraft } : f))
      setEditingId(null)
    }
    setSaving(null)
  }

  // Agregar
  const handleAdd = async () => {
    setSaving('new')
    const { data, error } = await supabase.from('filamentos').insert(newDraft).select().single()
    if (!error && data) {
      setFilamentos(prev => [...prev, data])
      setShowAdd(false)
      setNewDraft(EMPTY)
    }
    setSaving(null)
  }

  // Eliminar
  const handleDelete = async (id: string) => {
    setSaving(id)
    const { error } = await supabase.from('filamentos').delete().eq('id', id)
    if (!error) setFilamentos(prev => prev.filter(f => f.id !== id))
    setDeleteConfirm(null)
    setSaving(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-xs opacity-40">
      {sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  )

  const SelectCell = ({
    value, options, onChange,
  }: { value: string; options: string[]; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filamentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filamentos.length} bobinas en stock · {filtered.length} mostrando</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setNewDraft(EMPTY) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Agregar filamento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filterMaterial}
          onChange={e => setFilterMaterial(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los materiales</option>
          {MATERIALES.map(m => <option key={m}>{m}</option>)}
        </select>
        <select
          value={filterEstante}
          onChange={e => setFilterEstante(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los estantes</option>
          {ESTANTES.map(e => <option key={e}>{e}</option>)}
        </select>
        <select
          value={filterNivel}
          onChange={e => setFilterNivel(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los niveles</option>
          {NIVELES.map(n => <option key={n}>{n}</option>)}
        </select>
        {(search || filterMaterial || filterEstante || filterNivel) && (
          <button
            onClick={() => { setSearch(''); setFilterMaterial(''); setFilterEstante(''); setFilterNivel('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {([
                  ['posicion', 'Posición'],
                  ['estante', 'Estante'],
                  ['material', 'Material'],
                  ['tipo', 'Tipo'],
                  ['marca', 'Marca'],
                  ['color', 'Color'],
                  ['nivel', 'Nivel'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                  >
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No hay filamentos que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {filtered.map(f => (
                <tr
                  key={f.id}
                  className={`hover:bg-gray-50 transition-colors ${editingId === f.id ? 'bg-blue-50' : ''}`}
                >
                  {editingId === f.id ? (
                    <>
                      <td className="px-3 py-2"><SelectCell value={editDraft.posicion} options={POSICIONES} onChange={v => setEditDraft(d => ({ ...d, posicion: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.estante} options={ESTANTES} onChange={v => setEditDraft(d => ({ ...d, estante: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.material} options={MATERIALES} onChange={v => setEditDraft(d => ({ ...d, material: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.tipo} options={TIPOS} onChange={v => setEditDraft(d => ({ ...d, tipo: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.marca} options={MARCAS} onChange={v => setEditDraft(d => ({ ...d, marca: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.color} options={COLORES} onChange={v => setEditDraft(d => ({ ...d, color: v }))} /></td>
                      <td className="px-3 py-2"><SelectCell value={editDraft.nivel} options={NIVELES} onChange={v => setEditDraft(d => ({ ...d, nivel: v }))} /></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleSaveEdit(f.id)}
                          disabled={saving === f.id}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md mr-1 disabled:opacity-50"
                        >
                          {saving === f.id ? '…' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.posicion}</td>
                      <td className="px-4 py-3 text-gray-600">{f.estante}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{f.material}</td>
                      <td className="px-4 py-3 text-gray-600">{f.tipo}</td>
                      <td className="px-4 py-3 text-gray-600">{f.marca}</td>
                      <td className="px-4 py-3 text-gray-800">{f.color}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${NIVEL_COLOR[f.nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                          {f.nivel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {deleteConfirm === f.id ? (
                          <>
                            <span className="text-xs text-gray-500 mr-2">¿Eliminar?</span>
                            <button
                              onClick={() => handleDelete(f.id)}
                              disabled={saving === f.id}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded mr-1 disabled:opacity-50"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingId(f.id); setEditDraft({ material: f.material, tipo: f.tipo, marca: f.marca, color: f.color, nivel: f.nivel, estante: f.estante, posicion: f.posicion }) }}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 mr-1"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(f.id)}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal agregar */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Agregar filamento</h2>
            <div className="space-y-3">
              {([
                ['Material', 'material', MATERIALES],
                ['Tipo', 'tipo', TIPOS],
                ['Marca', 'marca', MARCAS],
                ['Color', 'color', COLORES],
                ['Nivel', 'nivel', NIVELES],
                ['Estante', 'estante', ESTANTES],
                ['Posición', 'posicion', POSICIONES],
              ] as [string, keyof typeof newDraft, string[]][]).map(([label, field, opts]) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</label>
                  <select
                    value={newDraft[field]}
                    onChange={e => setNewDraft(d => ({ ...d, [field]: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={saving === 'new'}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving === 'new' ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
