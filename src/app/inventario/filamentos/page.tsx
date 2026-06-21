'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Filamento = {
  id: string
  material: string
  tipo: string
  marca: string
  color: string
  nivel: string
  estante: string
  posicion: string
  en_uso: boolean
}

type Maestro = {
  id: string
  categoria: string
  valor: string
  orden: number
}

type MaestrosMap = Record<string, string[]>

type SortKey = keyof Omit<Filamento, 'id' | 'en_uso'>
type Tab = 'filamentos' | 'maestros'

// ─── Constantes que NO van a Supabase ────────────────────────────────────────

const POSICIONES = [
  'AD 1','AD 2','AD 3','AD 4','AD 5','AD 6','AD 7','AD 8','AD 9','AD 10',
  'AD 11','AD 12','AD 13','AD 14','AD 15','AD 16','AD 17','AD 18','AD 19','AD 20','AD 21',
  'AT 1','AT 2','AT 3','AT 4','AT 5','AT 6','AT 7','AT 8','AT 9','AT 10',
  'AT 11','AT 12','AT 13','AT 14','AT 15','AT 16','AT 17','AT 18','AT 19','AT 20','AT 21',
]

const NIVEL_COLOR: Record<string, string> = {
  'Cerrado':      'bg-[#16223a] text-[#60a5fa]',
  'Lleno':        'bg-[#14291a] text-[#4ade80]',
  'Tres cuartos': 'bg-[#0f2a22] text-[#34d399]',
  'Medio':        'bg-[#2a2410] text-[#eab308]',
  'Poco':         'bg-[#2a1515] text-[#f87171]',
}

const NIVEL_DOT: Record<string, string> = {
  'Cerrado':      'bg-[#16223a]0',
  'Lleno':        'bg-[#14291a]0',
  'Tres cuartos': 'bg-emerald-400',
  'Medio':        'bg-yellow-400',
  'Poco':         'bg-[#2a1515]0',
}

const CATEGORIAS: { key: string; label: string }[] = [
  { key: 'materiales', label: 'Materiales' },
  { key: 'tipos',      label: 'Tipos' },
  { key: 'marcas',     label: 'Marcas' },
  { key: 'colores',    label: 'Colores' },
  { key: 'estantes',   label: 'Estantes' },
  { key: 'niveles',    label: 'Niveles' },
]

const EMPTY_FILAMENTO = (m: MaestrosMap): Omit<Filamento, 'id'> => ({
  material: m.materiales?.[0] ?? 'PLA',
  tipo:     m.tipos?.[0]     ?? 'Normal',
  marca:    m.marcas?.[0]    ?? 'Grilon3',
  color:    m.colores?.[0]   ?? 'Negro',
  nivel:    m.niveles?.[0]   ?? 'Lleno',
  estante:  m.estantes?.[0]  ?? 'Rack',
  posicion: 'AT 1',
  en_uso:   false,
})

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FilamentosPage() {
  // — Filamentos
  const [filamentos, setFilamentos] = useState<Filamento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Omit<Filamento, 'id'> | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newDraft, setNewDraft] = useState<Omit<Filamento, 'id'> | null>(null)
  const [search, setSearch] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterEstante, setFilterEstante] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [filterEnUso, setFilterEnUso] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('posicion')
  const [sortAsc, setSortAsc] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('filamentos')

  // — Maestros
  const [maestrosMap, setMaestrosMap] = useState<MaestrosMap>({})
  const [maestrosRaw, setMaestrosRaw] = useState<Maestro[]>([])
  const [loadingMaestros, setLoadingMaestros] = useState(true)
  const [editingMaestro, setEditingMaestro] = useState<string | null>(null)
  const [newValor, setNewValor] = useState('')
  const [savingMaestro, setSavingMaestro] = useState(false)
  const [deleteConfirmMaestro, setDeleteConfirmMaestro] = useState<string | null>(null)

  // ─── Carga ────────────────────────────────────────────────────────────────

  const fetchFilamentos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('filamentos').select('*').order('estante').order('posicion')
    if (!error && data) setFilamentos(data)
    setLoading(false)
  }, [])

  const fetchMaestros = useCallback(async () => {
    setLoadingMaestros(true)
    const { data, error } = await supabase
      .from('maestros').select('*').order('orden')
    if (!error && data) {
      setMaestrosRaw(data)
      const map: MaestrosMap = {}
      for (const row of data) {
        if (!map[row.categoria]) map[row.categoria] = []
        map[row.categoria].push(row.valor)
      }
      setMaestrosMap(map)
    }
    setLoadingMaestros(false)
  }, [])

  useEffect(() => {
    fetchFilamentos()
    fetchMaestros()
  }, [fetchFilamentos, fetchMaestros])

  // ─── Maestros: agregar ────────────────────────────────────────────────────

  const handleAddMaestro = async (categoria: string) => {
    const valor = newValor.trim()
    if (!valor) return
    setSavingMaestro(true)
    const existentes = maestrosRaw.filter(m => m.categoria === categoria)
    const maxOrden = existentes.length ? Math.max(...existentes.map(m => m.orden)) : 0
    const { data, error } = await supabase
      .from('maestros')
      .insert({ categoria, valor, orden: maxOrden + 1 })
      .select().single()
    if (!error && data) {
      setMaestrosRaw(prev => [...prev, data])
      setMaestrosMap(prev => ({
        ...prev,
        [categoria]: [...(prev[categoria] ?? []), valor],
      }))
      setNewValor('')
      setEditingMaestro(null)
    }
    setSavingMaestro(false)
  }

  // ─── Maestros: eliminar ───────────────────────────────────────────────────

  const handleDeleteMaestro = async (id: string, categoria: string, valor: string) => {
    setSavingMaestro(true)
    const { error } = await supabase.from('maestros').delete().eq('id', id)
    if (!error) {
      setMaestrosRaw(prev => prev.filter(m => m.id !== id))
      setMaestrosMap(prev => ({
        ...prev,
        [categoria]: (prev[categoria] ?? []).filter(v => v !== valor),
      }))
    }
    setDeleteConfirmMaestro(null)
    setSavingMaestro(false)
  }

  // ─── Filamentos: filtrar + ordenar ───────────────────────────────────────

  const filtered = filamentos
    .filter(f => {
      const q = search.toLowerCase()
      const matchSearch = !q || [f.material, f.tipo, f.marca, f.color, f.estante, f.posicion]
        .some(v => v.toLowerCase().includes(q))
      return matchSearch
        && (!filterMaterial || f.material === filterMaterial)
        && (!filterEstante || f.estante === filterEstante)
        && (!filterNivel || f.nivel === filterNivel)
        && (!filterEnUso || f.en_uso)
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  // ─── Filamentos: CRUD ─────────────────────────────────────────────────────

  const handleSaveEdit = async (id: string) => {
    if (!editDraft) return
    setSaving(id)
    const { error } = await supabase.from('filamentos').update(editDraft).eq('id', id)
    if (!error) {
      setFilamentos(prev => prev.map(f => f.id === id ? { ...f, ...editDraft } : f))
      setEditingId(null)
    }
    setSaving(null)
  }

  const handleAdd = async () => {
    if (!newDraft) return
    setSaving('new')
    const { data, error } = await supabase.from('filamentos').insert(newDraft).select().single()
    if (!error && data) {
      setFilamentos(prev => [...prev, data])
      setShowAdd(false)
      setNewDraft(null)
    }
    setSaving(null)
  }

  const handleDelete = async (id: string) => {
    setSaving(id)
    const { error } = await supabase.from('filamentos').delete().eq('id', id)
    if (!error) setFilamentos(prev => prev.filter(f => f.id !== id))
    setDeleteConfirm(null)
    setSaving(null)
  }

  const handleToggleEnUso = async (id: string, current: boolean) => {
    setFilamentos(prev => prev.map(f => f.id === id ? { ...f, en_uso: !current } : f))
    const { error } = await supabase.from('filamentos').update({ en_uso: !current }).eq('id', id)
    if (error) setFilamentos(prev => prev.map(f => f.id === id ? { ...f, en_uso: current } : f))
  }

  // ─── Contadores ───────────────────────────────────────────────────────────

  const niveles = maestrosMap.niveles ?? ['Cerrado', 'Lleno', 'Tres cuartos', 'Medio', 'Poco']
  const contadores = niveles.map(n => ({ nivel: n, count: filamentos.filter(f => f.nivel === n).length }))
  const enUsoCount = filamentos.filter(f => f.en_uso).length

  // ─── Sub-componentes ──────────────────────────────────────────────────────

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-xs opacity-40">
      {sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  )

  const SelectCell = ({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm border border-[#2a2a28] rounded px-1 py-0.5 bg-[#1a1a18] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f5f0]">Filamentos</h1>
          <p className="text-sm text-[#9a9a92] mt-0.5">
            {filamentos.length} bobinas en stock · {filtered.length} mostrando
            {enUsoCount > 0 && <span className="ml-2 text-[#f97316] font-medium">· {enUsoCount} en uso</span>}
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setNewDraft(EMPTY_FILAMENTO(maestrosMap)) }}
          className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Agregar filamento
        </button>
      </div>

      {/* Resumen niveles */}
      <div className="flex flex-wrap items-center gap-4 mb-5 px-4 py-3 bg-[#111110] rounded-xl border border-[#232320]">
        <span className="text-sm font-medium text-[#9a9a92]">{filamentos.length} filamentos</span>
        <div className="w-px h-4 bg-[#2a2a28]" />
        {contadores.map(({ nivel, count }) => count > 0 && (
          <button
            key={nivel}
            onClick={() => setFilterNivel(filterNivel === nivel ? '' : nivel)}
            className={`flex items-center gap-1.5 text-sm transition-opacity ${filterNivel && filterNivel !== nivel ? 'opacity-40' : 'opacity-100'}`}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${NIVEL_DOT[nivel] ?? 'bg-[#6b6b65]'}`} />
            <span className="font-semibold text-[#f5f5f0]">{count}</span>
            <span className="text-[#9a9a92]">{nivel}</span>
          </button>
        ))}
        {enUsoCount > 0 && (
          <>
            <div className="w-px h-4 bg-[#2a2a28]" />
            <button
              onClick={() => setFilterEnUso(!filterEnUso)}
              className={`flex items-center gap-1.5 text-sm ${filterEnUso ? 'text-[#f97316] font-semibold' : 'text-[#9a9a92]'}`}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span className="font-semibold text-[#f5f5f0]">{enUsoCount}</span>
              <span>En uso</span>
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#2a2a28] mb-5">
        {(['filamentos', 'maestros'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#16a34a] text-[#4ade80]'
                : 'border-transparent text-[#9a9a92] hover:text-[#d4d4cf]'
            }`}
          >
            {tab === 'filamentos' ? 'Filamentos' : 'Maestros y ubicaciones'}
          </button>
        ))}
      </div>

      {/* ══════════ TAB FILAMENTOS ══════════ */}
      {activeTab === 'filamentos' && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input
              type="text" placeholder="Buscar…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm bg-[#1a1a18] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] w-44"
            />
            <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}
              className="border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm bg-[#1a1a18] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option value="">Todos los materiales</option>
              {(maestrosMap.materiales ?? []).map(m => <option key={m}>{m}</option>)}
            </select>
            <select value={filterEstante} onChange={e => setFilterEstante(e.target.value)}
              className="border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm bg-[#1a1a18] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option value="">Todos los estantes</option>
              {(maestrosMap.estantes ?? []).map(e => <option key={e}>{e}</option>)}
            </select>
            <select value={filterNivel} onChange={e => setFilterNivel(e.target.value)}
              className="border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm bg-[#1a1a18] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option value="">Todos los niveles</option>
              {(maestrosMap.niveles ?? []).map(n => <option key={n}>{n}</option>)}
            </select>
            <button
              onClick={() => setFilterEnUso(!filterEnUso)}
              className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm transition-colors ${
                filterEnUso ? 'bg-[#2a1d0f] border-[#f97316]/40 text-[#f97316] font-medium' : 'border-[#2a2a28] text-[#9a9a92] hover:bg-[#111110]'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" /> En uso
            </button>
            {(search || filterMaterial || filterEstante || filterNivel || filterEnUso) && (
              <button
                onClick={() => { setSearch(''); setFilterMaterial(''); setFilterEstante(''); setFilterNivel(''); setFilterEnUso(false) }}
                className="text-sm text-[#9a9a92] hover:text-[#d4d4cf] underline"
              >Limpiar</button>
            )}
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-[#6b6b65]">Cargando…</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2a2a28]">
              <table className="w-full text-sm">
                <thead className="bg-[#111110] border-b border-[#2a2a28]">
                  <tr>
                    {([
                      ['posicion','Posición'],['estante','Estante'],['material','Material'],
                      ['tipo','Tipo'],['marca','Marca'],['color','Color'],['nivel','Nivel'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} onClick={() => handleSort(key)}
                        className="text-left px-4 py-3 font-medium text-[#9a9a92] cursor-pointer hover:text-[#f5f5f0] select-none whitespace-nowrap">
                        {label}<SortIcon col={key} />
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-medium text-[#9a9a92] whitespace-nowrap">En uso</th>
                    <th className="px-4 py-3 text-right font-medium text-[#9a9a92]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232320]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-12 text-[#6b6b65]">No hay filamentos que coincidan.</td></tr>
                  )}
                  {filtered.map(f => (
                    <tr key={f.id} className={`transition-colors ${f.en_uso ? 'bg-[#2a1d0f] hover:bg-orange-100' : editingId === f.id ? 'bg-[#16223a]' : 'hover:bg-[#111110]'}`}>
                      {editingId === f.id && editDraft ? (
                        <>
                          <td className="px-3 py-2"><SelectCell value={editDraft.posicion} options={POSICIONES} onChange={v => setEditDraft(d => d ? { ...d, posicion: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.estante} options={maestrosMap.estantes ?? []} onChange={v => setEditDraft(d => d ? { ...d, estante: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.material} options={maestrosMap.materiales ?? []} onChange={v => setEditDraft(d => d ? { ...d, material: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.tipo} options={maestrosMap.tipos ?? []} onChange={v => setEditDraft(d => d ? { ...d, tipo: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.marca} options={maestrosMap.marcas ?? []} onChange={v => setEditDraft(d => d ? { ...d, marca: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.color} options={maestrosMap.colores ?? []} onChange={v => setEditDraft(d => d ? { ...d, color: v } : d)} /></td>
                          <td className="px-3 py-2"><SelectCell value={editDraft.nivel} options={maestrosMap.niveles ?? []} onChange={v => setEditDraft(d => d ? { ...d, nivel: v } : d)} /></td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={editDraft.en_uso}
                              onChange={e => setEditDraft(d => d ? { ...d, en_uso: e.target.checked } : d)}
                              className="w-4 h-4 accent-orange-500" />
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button onClick={() => handleSaveEdit(f.id)} disabled={saving === f.id}
                              className="text-xs bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-1 rounded-md mr-1 disabled:opacity-50">
                              {saving === f.id ? '…' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-[#9a9a92] hover:text-[#d4d4cf] px-2 py-1">Cancelar</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-xs text-[#9a9a92]">{f.posicion}</td>
                          <td className="px-4 py-3 text-[#9a9a92]">{f.estante}</td>
                          <td className="px-4 py-3 font-medium text-[#f5f5f0]">{f.material}</td>
                          <td className="px-4 py-3 text-[#9a9a92]">{f.tipo}</td>
                          <td className="px-4 py-3 text-[#9a9a92]">{f.marca}</td>
                          <td className="px-4 py-3 text-[#f5f5f0]">{f.color}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${NIVEL_COLOR[f.nivel] ?? 'bg-[#232320] text-[#9a9a92]'}`}>
                              {f.nivel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleToggleEnUso(f.id, f.en_uso)}
                              title={f.en_uso ? 'Marcar disponible' : 'Marcar en uso'}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${f.en_uso ? 'bg-orange-400 border-orange-400 text-white' : 'border-[#2a2a28] hover:border-[#f97316]/40'}`}>
                              {f.en_uso && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {deleteConfirm === f.id ? (
                              <>
                                <span className="text-xs text-[#9a9a92] mr-2">¿Eliminar?</span>
                                <button onClick={() => handleDelete(f.id)} disabled={saving === f.id}
                                  className="text-xs bg-[#dc2626] hover:bg-[#b91c1c] text-white px-2 py-1 rounded mr-1 disabled:opacity-50">Sí</button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-xs text-[#9a9a92] hover:text-[#d4d4cf] px-2 py-1">No</button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditingId(f.id); setEditDraft({ material: f.material, tipo: f.tipo, marca: f.marca, color: f.color, nivel: f.nivel, estante: f.estante, posicion: f.posicion, en_uso: f.en_uso }) }}
                                  className="text-xs text-[#60a5fa] hover:text-[#93c5fd] px-2 py-1 mr-1">Editar</button>
                                <button onClick={() => setDeleteConfirm(f.id)} className="text-xs text-[#f87171] hover:text-[#fca5a5] px-2 py-1">Eliminar</button>
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
        </>
      )}

      {/* ══════════ TAB MAESTROS ══════════ */}
      {activeTab === 'maestros' && (
        <div className="space-y-5">
          {loadingMaestros ? (
            <div className="flex items-center justify-center h-48 text-[#6b6b65]">Cargando maestros…</div>
          ) : (
            <>
              {/* Ocupación por estante - PRIMERO */}
              <div className="border border-[#2a2a28] rounded-xl p-4 bg-[#1a1a18]">
                <h3 className="text-sm font-semibold text-[#d4d4cf] mb-3">Ocupación por estante</h3>
                <div className="flex gap-4">
                  {(maestrosMap.estantes ?? []).map(estante => {
                    const count = filamentos.filter(f => f.estante === estante).length
                    return (
                      <div key={estante} className="flex-1 text-center p-3 bg-[#111110] rounded-lg">
                        <p className="text-2xl font-bold text-[#f5f5f0]">{count}</p>
                        <p className="text-xs text-[#9a9a92] mt-0.5">{estante}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {CATEGORIAS.map(({ key, label }) => {
                  const items = maestrosRaw.filter(m => m.categoria === key)
                  const isEditing = editingMaestro === key
                  return (
                    <div key={key} className="border border-[#2a2a28] rounded-xl p-4 bg-[#1a1a18]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[#d4d4cf]">
                          {label}
                          <span className="ml-2 text-xs font-normal text-[#6b6b65]">{items.length} opciones</span>
                        </h3>
                        <button
                          onClick={() => { setEditingMaestro(isEditing ? null : key); setNewValor('') }}
                          className={`text-xs px-2 py-1 rounded-md transition-colors ${isEditing ? 'bg-[#232320] text-[#9a9a92]' : 'bg-[#14291a] text-[#4ade80] hover:bg-[#1a3322]'}`}
                        >
                          {isEditing ? 'Cerrar' : '+ Agregar'}
                        </button>
                      </div>

                      {isEditing && (
                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={newValor}
                            onChange={e => setNewValor(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddMaestro(key)}
                            placeholder={`Nuevo ${label.toLowerCase().slice(0, -1)}…`}
                            className="flex-1 border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddMaestro(key)}
                            disabled={savingMaestro || !newValor.trim()}
                            className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {savingMaestro ? '…' : 'OK'}
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {items.map(item => (
                          <div key={item.id} className="inline-flex">
                            {deleteConfirmMaestro === item.id ? (
                              <div className="flex items-center gap-1 bg-[#2a1515] border border-[#4a2020] rounded-full px-2 py-0.5">
                                <span className="text-xs text-[#f87171]">{item.valor}</span>
                                <button onClick={() => handleDeleteMaestro(item.id, key, item.valor)}
                                  disabled={savingMaestro}
                                  className="text-xs text-[#f87171] hover:text-[#fca5a5] font-bold disabled:opacity-50">✕</button>
                                <button onClick={() => setDeleteConfirmMaestro(null)}
                                  className="text-xs text-[#6b6b65] hover:text-[#9a9a92]">↩</button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-[#232320] text-[#d4d4cf] rounded-full px-2.5 py-0.5">
                                {item.valor}
                                {isEditing && (
                                  <button
                                    onClick={() => setDeleteConfirmMaestro(item.id)}
                                    className="ml-0.5 text-[#4a4a46] hover:text-[#f87171] transition-colors leading-none"
                                    title="Eliminar"
                                  >×</button>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Posiciones */}
              <div className="border border-[#2a2a28] rounded-xl p-4 bg-[#1a1a18]">
                <h3 className="text-sm font-semibold text-[#d4d4cf] mb-3">
                  Posiciones
                  <span className="ml-2 text-xs font-normal text-[#6b6b65]">{POSICIONES.length} posiciones</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {['AD', 'AT'].map(prefix => {
                    const pos = POSICIONES.filter(p => p.startsWith(prefix))
                    return (
                      <div key={prefix}>
                        <p className="text-xs font-medium text-[#9a9a92] mb-1.5">{prefix} ({pos.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {pos.map(p => (
                            <span key={p} className="text-xs bg-[#232320] text-[#9a9a92] rounded px-1.5 py-0.5 font-mono">{p}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal agregar filamento */}
      {showAdd && newDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a18] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-[#f5f5f0] mb-5">Agregar filamento</h2>
            <div className="space-y-3">
              {([
                ['Material', 'material', maestrosMap.materiales ?? []],
                ['Tipo',     'tipo',     maestrosMap.tipos     ?? []],
                ['Marca',    'marca',    maestrosMap.marcas    ?? []],
                ['Color',    'color',    maestrosMap.colores   ?? []],
                ['Nivel',    'nivel',    maestrosMap.niveles   ?? []],
                ['Estante',  'estante',  maestrosMap.estantes  ?? []],
                ['Posición', 'posicion', POSICIONES],
              ] as [string, keyof typeof newDraft, string[]][]).map(([label, field, opts]) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-[#9a9a92] w-20 flex-shrink-0">{label}</label>
                  <select
                    value={newDraft[field] as string}
                    onChange={e => setNewDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                    className="flex-1 border border-[#2a2a28] rounded-lg px-3 py-1.5 text-sm bg-[#1a1a18] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                  >
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#9a9a92] w-20 flex-shrink-0">En uso</label>
                <input type="checkbox" checked={newDraft.en_uso}
                  onChange={e => setNewDraft(d => d ? { ...d, en_uso: e.target.checked } : d)}
                  className="w-4 h-4 accent-orange-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="text-sm text-[#9a9a92] hover:text-[#d4d4cf] px-4 py-2">Cancelar</button>
              <button onClick={handleAdd} disabled={saving === 'new'}
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                {saving === 'new' ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
