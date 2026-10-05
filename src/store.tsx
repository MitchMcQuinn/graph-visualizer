import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react'
import type {
  CanvasSettings,
  Connecting,
  CustomIcon,
  Doc,
  EdgeModel,
  EdgeStyle,
  ExportSettings,
  NodeModel,
  NodeStyle,
  Selection,
  Side,
} from './types'
import { clamp } from './geometry'
import { cloneNode, createEdge, createNode, emptyDoc, loadDoc, sampleDoc, saveDoc, uid } from './model'

type HistoryState = {
  doc: Doc
  past: Doc[]
  future: Doc[]
  coalescing: boolean
  selection: Selection
  fitToken: number
}

type Action =
  | { type: 'commit'; recipe: (doc: Doc) => Doc; coalesce: boolean }
  | { type: 'replace'; recipe: (doc: Doc) => Doc }
  | { type: 'checkpoint'; before: Doc }
  | { type: 'end-coalesce' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; selection: Selection }
  | { type: 'load'; doc: Doc; fit: boolean }

function sameSelection(a: Selection, b: Selection) {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'edge' && b.kind === 'edge') return a.id === b.id
  if (a.kind === 'node' && b.kind === 'node') {
    if (a.ids.length !== b.ids.length) return false
    const left = [...a.ids].sort()
    return left.every((id, index) => id === [...b.ids].sort()[index])
  }
  return false
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'commit': {
      const next = action.recipe(state.doc)
      if (next === state.doc) return state
      if (action.coalesce && state.coalescing) return { ...state, doc: next }
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-80),
        future: [],
        coalescing: action.coalesce,
      }
    }
    case 'replace':
      return { ...state, doc: action.recipe(state.doc) }
    case 'checkpoint':
      if (action.before === state.doc) return { ...state, coalescing: false }
      return {
        ...state,
        past: [...state.past, action.before].slice(-80),
        future: [],
        coalescing: false,
      }
    case 'end-coalesce':
      return state.coalescing ? { ...state, coalescing: false } : state
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        coalescing: false,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        doc: next,
        future: state.future.slice(1),
        past: [...state.past, state.doc].slice(-80),
        coalescing: false,
      }
    }
    case 'select':
      if (sameSelection(state.selection, action.selection)) return state
      return { ...state, selection: action.selection, coalescing: false }
    case 'load':
      return {
        ...state,
        doc: action.doc,
        past: [...state.past, state.doc].slice(-80),
        future: [],
        coalescing: false,
        selection: null,
        fitToken: action.fit ? state.fitToken + 1 : state.fitToken,
      }
    default:
      return state
  }
}

type DocApi = {
  doc: Doc
  selection: Selection
  canUndo: boolean
  canRedo: boolean
  fitToken: number
  select: (selection: Selection) => void
  commit: (recipe: (doc: Doc) => Doc, coalesce?: boolean) => void
  replace: (recipe: (doc: Doc) => Doc) => void
  checkpoint: (before: Doc) => void
  endCoalesce: () => void
  undo: () => void
  redo: () => void
  updateNode: (id: string, patch: Partial<NodeModel>, coalesce?: boolean) => void
  updateEdge: (id: string, patch: Partial<EdgeModel>, coalesce?: boolean) => void
  updateCanvas: (patch: Partial<CanvasSettings>, coalesce?: boolean) => void
  updateExport: (patch: Partial<ExportSettings>, coalesce?: boolean) => void
  updateDefaults: (patch: { node?: Partial<NodeStyle>; edge?: Partial<EdgeStyle>; nodeWidth?: number; nodeAutoWidth?: boolean }, coalesce?: boolean) => void
  addNodeType: () => string
  updateNodeType: (id: string, patch: { name?: string; style?: Partial<NodeStyle> }, coalesce?: boolean) => void
  deleteNodeType: (id: string) => void
  addEdgeType: () => string
  updateEdgeType: (id: string, patch: { name?: string; style?: Partial<EdgeStyle> }, coalesce?: boolean) => void
  deleteEdgeType: (id: string) => void
  addIcon: (icon: CustomIcon) => void
  removeIcon: (id: string) => void
  loadDocument: (doc: Doc) => void
  addNode: (at: { x: number; y: number }) => string
  addEdge: (input: { fromId: string; fromSide: Side; toId: string; toSide: Side }) => string
  deleteSelection: () => void
  duplicateSelection: () => void
  copySelection: () => boolean
  pasteNode: () => void
  loadSample: () => void
  clearDoc: () => void
}

type ViewState = { panX: number; panY: number; zoom: number }

export type InteractionBridge = {
  cancelConnect: () => boolean
}

type ViewApi = {
  view: ViewState
  setView: Dispatch<SetStateAction<ViewState>>
  svgRef: RefObject<SVGSVGElement | null>
  viewportRef: RefObject<{ width: number; height: number }>
  userMovedRef: RefObject<boolean>
  interactionRef: RefObject<InteractionBridge>
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number }
  zoomAt: (clientX: number, clientY: number, nextZoom: number) => void
  fit: () => void
}

let nodeClipboard: { nodes: NodeModel[]; pastes: number } | null = null

function uniqueTypeName(types: { name: string }[], base: string) {
  const names = new Set(types.map((type) => type.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}

const DocContext = createContext<DocApi | null>(null)
const ViewContext = createContext<ViewApi | null>(null)

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    doc: loadDoc(),
    past: [],
    future: [],
    coalescing: false,
    selection: null,
    fitToken: 0,
  }))
  const [view, setView] = useStateSafe()
  const svgRef = useRef<SVGSVGElement>(null)
  const viewportRef = useRef({ width: 800, height: 600 })
  const userMovedRef = useRef(false)
  const interactionRef = useRef<InteractionBridge>({ cancelConnect: () => false })
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const timer = window.setTimeout(() => saveDoc(state.doc), 200)
    return () => window.clearTimeout(timer)
  }, [state.doc])

  const select = useCallback((selection: Selection) => dispatch({ type: 'select', selection }), [])
  const commit = useCallback(
    (recipe: (doc: Doc) => Doc, coalesce = false) => dispatch({ type: 'commit', recipe, coalesce }),
    [],
  )
  const replace = useCallback((recipe: (doc: Doc) => Doc) => dispatch({ type: 'replace', recipe }), [])
  const checkpoint = useCallback((before: Doc) => dispatch({ type: 'checkpoint', before }), [])
  const endCoalesce = useCallback(() => dispatch({ type: 'end-coalesce' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const updateNode = useCallback(
    (id: string, patch: Partial<NodeModel>, coalesce = false) => {
      commit(
        (doc) => ({ ...doc, nodes: doc.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) }),
        coalesce,
      )
    },
    [commit],
  )
  const updateEdge = useCallback(
    (id: string, patch: Partial<EdgeModel>, coalesce = false) => {
      commit(
        (doc) => ({ ...doc, edges: doc.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)) }),
        coalesce,
      )
    },
    [commit],
  )
  const updateCanvas = useCallback(
    (patch: Partial<CanvasSettings>, coalesce = false) => {
      commit((doc) => ({ ...doc, canvas: { ...doc.canvas, ...patch } }), coalesce)
    },
    [commit],
  )
  const updateExport = useCallback(
    (patch: Partial<ExportSettings>, coalesce = false) => {
      commit((doc) => ({ ...doc, exportSettings: { ...doc.exportSettings, ...patch } }), coalesce)
    },
    [commit],
  )
  const updateDefaults = useCallback(
    (patch: { node?: Partial<NodeStyle>; edge?: Partial<EdgeStyle>; nodeWidth?: number; nodeAutoWidth?: boolean }, coalesce = false) => {
      commit(
        (doc) => ({
          ...doc,
          defaults: {
            node: patch.node ? { ...doc.defaults.node, ...patch.node } : doc.defaults.node,
            edge: patch.edge ? { ...doc.defaults.edge, ...patch.edge } : doc.defaults.edge,
            nodeWidth: patch.nodeWidth ?? doc.defaults.nodeWidth,
            nodeAutoWidth: patch.nodeAutoWidth ?? doc.defaults.nodeAutoWidth,
          },
        }),
        coalesce,
      )
    },
    [commit],
  )
  const addNodeType = useCallback(() => {
    if ((state.doc.nodeTypes ?? []).length >= 40) return ''
    const id = uid('nt')
    commit((doc) => {
      const types = doc.nodeTypes ?? []
      if (types.length >= 40 || types.some((type) => type.id === id)) return doc
      return { ...doc, nodeTypes: [...types, { id, name: uniqueTypeName(types, 'Node type'), style: {} }] }
    })
    return id
  }, [commit, state.doc.nodeTypes])
  const updateNodeType = useCallback(
    (id: string, patch: { name?: string; style?: Partial<NodeStyle> }, coalesce = false) => {
      commit(
        (doc) => ({
          ...doc,
          nodeTypes: (doc.nodeTypes ?? []).map((type) =>
            type.id === id
              ? { ...type, name: patch.name === undefined ? type.name : patch.name.slice(0, 48), style: patch.style ?? type.style }
              : type,
          ),
        }),
        coalesce,
      )
    },
    [commit],
  )
  const deleteNodeType = useCallback(
    (id: string) => {
      commit((doc) => ({
        ...doc,
        nodeTypes: (doc.nodeTypes ?? []).filter((type) => type.id !== id),
        nodes: doc.nodes.map((node) => (node.typeId === id ? { ...node, typeId: '' } : node)),
      }))
    },
    [commit],
  )
  const addEdgeType = useCallback(() => {
    if ((state.doc.edgeTypes ?? []).length >= 40) return ''
    const id = uid('et')
    commit((doc) => {
      const types = doc.edgeTypes ?? []
      if (types.length >= 40 || types.some((type) => type.id === id)) return doc
      return { ...doc, edgeTypes: [...types, { id, name: uniqueTypeName(types, 'Relationship type'), style: {} }] }
    })
    return id
  }, [commit, state.doc.edgeTypes])
  const updateEdgeType = useCallback(
    (id: string, patch: { name?: string; style?: Partial<EdgeStyle> }, coalesce = false) => {
      commit(
        (doc) => ({
          ...doc,
          edgeTypes: (doc.edgeTypes ?? []).map((type) =>
            type.id === id
              ? { ...type, name: patch.name === undefined ? type.name : patch.name.slice(0, 48), style: patch.style ?? type.style }
              : type,
          ),
        }),
        coalesce,
      )
    },
    [commit],
  )
  const deleteEdgeType = useCallback(
    (id: string) => {
      commit((doc) => ({
        ...doc,
        edgeTypes: (doc.edgeTypes ?? []).filter((type) => type.id !== id),
        edges: doc.edges.map((edge) => (edge.typeId === id ? { ...edge, typeId: '' } : edge)),
      }))
    },
    [commit],
  )
  const addIcon = useCallback(
    (icon: CustomIcon) => {
      commit((doc) => ({ ...doc, icons: [...doc.icons, icon].slice(-40) }))
    },
    [commit],
  )
  const removeIcon = useCallback(
    (id: string) => {
      const token = `custom:${id}`
      commit((doc) => ({
        ...doc,
        icons: doc.icons.filter((icon) => icon.id !== id),
        nodes: doc.nodes.map((node) => (node.icon === token ? { ...node, icon: '', showIcon: false } : node)),
      }))
    },
    [commit],
  )
  const loadDocument = useCallback((doc: Doc) => dispatch({ type: 'load', doc, fit: true }), [])
  const addNode = useCallback(
    (at: { x: number; y: number }) => {
      let created = ''
      commit((doc) => {
        const node = createNode(at, { width: doc.defaults.nodeWidth, autoWidth: doc.defaults.nodeAutoWidth === true })
        created = node.id
        return { ...doc, nodes: [...doc.nodes, node] }
      })
      select({ kind: 'node', ids: [created] })
      return created
    },
    [commit, select],
  )
  const addEdge = useCallback(
    (input: { fromId: string; fromSide: Side; toId: string; toSide: Side }) => {
      const edge = createEdge(input)
      commit((doc) => ({ ...doc, edges: [...doc.edges, edge] }))
      return edge.id
    },
    [commit],
  )
  const deleteSelection = useCallback(() => {
    const selection = state.selection
    if (!selection) return
    commit((doc) => {
      if (selection.kind === 'node') {
        const ids = new Set(selection.ids)
        return {
          ...doc,
          nodes: doc.nodes.filter((node) => !ids.has(node.id)),
          edges: doc.edges.filter((edge) => !ids.has(edge.fromId) && !ids.has(edge.toId)),
        }
      }
      return { ...doc, edges: doc.edges.filter((edge) => edge.id !== selection.id) }
    })
    select(null)
  }, [commit, select, state.selection])
  const duplicateSelection = useCallback(() => {
    const selection = state.selection
    if (!selection) return
    if (selection.kind === 'node') {
      const ids = new Set(selection.ids)
      const sources = state.doc.nodes.filter((node) => ids.has(node.id))
      if (!sources.length) return
      const copies = sources.map((source) => cloneNode(source, { x: source.x + 28, y: source.y + 28 }))
      commit((doc) => ({ ...doc, nodes: [...doc.nodes, ...copies] }))
      select({ kind: 'node', ids: copies.map((copy) => copy.id) })
      return
    }
    const source = state.doc.edges.find((edge) => edge.id === selection.id)
    if (!source) return
    const copy = createEdge(
      { fromId: source.fromId, toId: source.toId, fromSide: source.fromSide, toSide: source.toSide },
      { ...source, id: uid('e'), style: { ...source.style } },
    )
    commit((doc) => ({ ...doc, edges: [...doc.edges, copy] }))
    select({ kind: 'edge', id: copy.id })
  }, [commit, select, state.doc.edges, state.doc.nodes, state.selection])
  const copySelection = useCallback(() => {
    if (state.selection?.kind !== 'node') return false
    const ids = new Set(state.selection.ids)
    const sources = state.doc.nodes.filter((node) => ids.has(node.id))
    if (!sources.length) return false
    nodeClipboard = {
      nodes: sources.map((source) => ({
        ...source,
        table: { hasHeader: source.table.hasHeader, rows: source.table.rows.map((row) => [...row]) },
        style: { ...source.style },
      })),
      pastes: 0,
    }
    return true
  }, [state.doc.nodes, state.selection])
  const pasteNode = useCallback(() => {
    const clip = nodeClipboard
    if (!clip) return
    clip.pastes += 1
    const copies = clip.nodes.map((node) => cloneNode(node, { x: node.x + 28 * clip.pastes, y: node.y + 28 * clip.pastes }))
    commit((doc) => ({ ...doc, nodes: [...doc.nodes, ...copies] }))
    select({ kind: 'node', ids: copies.map((copy) => copy.id) })
  }, [commit, select])
  const loadSample = useCallback(() => dispatch({ type: 'load', doc: sampleDoc(), fit: true }), [])
  const clearDoc = useCallback(() => {
    dispatch({ type: 'load', doc: emptyDoc(state.doc), fit: false })
  }, [state.doc])

  const docApi = useMemo<DocApi>(
    () => ({
      doc: state.doc,
      selection: state.selection,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      fitToken: state.fitToken,
      select,
      commit,
      replace,
      checkpoint,
      endCoalesce,
      undo,
      redo,
      updateNode,
      updateEdge,
      updateCanvas,
      updateExport,
      updateDefaults,
      addNodeType,
      updateNodeType,
      deleteNodeType,
      addEdgeType,
      updateEdgeType,
      deleteEdgeType,
      addIcon,
      removeIcon,
      loadDocument,
      addNode,
      addEdge,
      deleteSelection,
      duplicateSelection,
      copySelection,
      pasteNode,
      loadSample,
      clearDoc,
    }),
    [
      state.doc,
      state.selection,
      state.past.length,
      state.future.length,
      state.fitToken,
      select,
      commit,
      replace,
      checkpoint,
      endCoalesce,
      undo,
      redo,
      updateNode,
      updateEdge,
      updateCanvas,
      updateExport,
      updateDefaults,
      addNodeType,
      updateNodeType,
      deleteNodeType,
      addEdgeType,
      updateEdgeType,
      deleteEdgeType,
      addIcon,
      removeIcon,
      loadDocument,
      addNode,
      addEdge,
      deleteSelection,
      duplicateSelection,
      copySelection,
      pasteNode,
      loadSample,
      clearDoc,
    ],
  )

  const actionsRef = useRef(docApi)
  actionsRef.current = docApi

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const api = actionsRef.current
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (meta && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) api.redo()
        else api.undo()
        return
      }
      if (meta && key === 'd') {
        event.preventDefault()
        api.duplicateSelection()
        return
      }
      if (meta && key === 'c') {
        if (api.copySelection()) event.preventDefault()
        return
      }
      if (meta && key === 'v') {
        event.preventDefault()
        api.pasteNode()
        return
      }
      if (event.key === 'Escape') {
        if (interactionRef.current.cancelConnect()) return
        api.select(null)
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        api.deleteSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    const current = viewRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: (clientX - rect.left - current.panX) / current.zoom,
      y: (clientY - rect.top - current.panY) / current.zoom,
    }
  }, [])

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoom: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const current = viewRef.current
    const zoom = clamp(nextZoom, 0.2, 2.5)
    const mx = clientX - rect.left
    const my = clientY - rect.top
    const wx = (mx - current.panX) / current.zoom
    const wy = (my - current.panY) / current.zoom
    userMovedRef.current = true
    setView({ zoom, panX: mx - wx * zoom, panY: my - wy * zoom })
  }, [])

  const fit = useCallback(() => {
    const svg = svgRef.current
    const group = document.getElementById(DIAGRAM_ID)
    if (!svg || !(group instanceof SVGGraphicsElement)) return
    const box = group.getBBox()
    if (box.width < 1 || box.height < 1) return
    const rect = svg.getBoundingClientRect()
    viewportRef.current = { width: rect.width, height: rect.height }
    const pad = 80
    const zoom = clamp(
      Math.min((rect.width - pad) / box.width, (rect.height - pad) / box.height),
      0.25,
      1.35,
    )
    setView({
      zoom,
      panX: (rect.width - box.width * zoom) / 2 - box.x * zoom,
      panY: (rect.height - box.height * zoom) / 2 - box.y * zoom,
    })
  }, [])

  const viewApi = useMemo<ViewApi>(
    () => ({
      view,
      setView,
      svgRef,
      viewportRef,
      userMovedRef,
      interactionRef,
      clientToWorld,
      zoomAt,
      fit,
    }),
    [view, clientToWorld, zoomAt, fit],
  )

  return (
    <DocContext.Provider value={docApi}>
      <ViewContext.Provider value={viewApi}>{children}</ViewContext.Provider>
    </DocContext.Provider>
  )
}

function useStateSafe() {
  return useReducer(
    (_: ViewState, next: SetStateAction<ViewState>) => (typeof next === 'function' ? next(_) : next),
    { panX: 40, panY: 40, zoom: 1 },
  ) as [ViewState, Dispatch<SetStateAction<ViewState>>]
}

const DIAGRAM_ID = 'diagram-content'

export function useDoc() {
  const value = useContext(DocContext)
  if (!value) throw new Error('useDoc must be used within EditorProvider')
  return value
}

export function useView() {
  const value = useContext(ViewContext)
  if (!value) throw new Error('useView must be used within EditorProvider')
  return value
}

export type { Connecting }
