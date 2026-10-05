import { clamp } from './geometry'
import {
  defaultDefaults,
  defaultNodeWidth,
  edgeStyleOverrides,
  nodeStyleOverrides,
  legacyArrowBaseline,
  normalizeEdgeDefaults,
  normalizeEdgeTypes,
  normalizeIconRef,
  normalizeIcons,
  normalizeNodeDefaults,
  normalizeNodeTypes,
} from './style'
import type { CanvasBackground, Doc, EdgeModel, EdgeStyle, NodeModel, Side, TableData } from './types'

export function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().replace(/-/g, '')}`
}

const defaultTable = (): TableData => ({ hasHeader: false, rows: [['name']] })

export function createNode(at: { x: number; y: number }, overrides: Partial<NodeModel> = {}): NodeModel {
  const node: NodeModel = {
    id: uid('n'),
    x: at.x,
    y: at.y,
    width: defaultNodeWidth,
    height: null,
    heightAnchor: 'top',
    title: 'Node',
    description: '',
    icon: '',
    showTitle: true,
    showDescription: true,
    showIcon: false,
    showTable: true,
    table: defaultTable(),
    autoWidth: false,
    centerAnchors: false,
    typeId: '',
    style: {},
    ...overrides,
  }
  node.style = { ...node.style }
  return node
}

export function cloneNode(source: NodeModel, at: { x: number; y: number }) {
  return createNode(at, {
    ...source,
    id: uid('n'),
    x: at.x,
    y: at.y,
    table: { hasHeader: source.table.hasHeader, rows: source.table.rows.map((row) => [...row]) },
    style: { ...source.style },
  })
}

export function createEdge(
  ends: { fromId: string; toId: string; fromSide: Side; toSide: Side },
  overrides: Partial<EdgeModel> = {},
): EdgeModel {
  const edge: EdgeModel = {
    id: uid('e'),
    fromId: ends.fromId,
    toId: ends.toId,
    fromSide: ends.fromSide,
    toSide: ends.toSide,
    typeId: '',
    style: {},
    ...overrides,
  }
  edge.style = { ...edge.style }
  return edge
}

function node(id: string, x: number, y: number, width: number, title: string, rows: string[][]): NodeModel {
  return createNode({ x, y }, { id, width, title, table: { hasHeader: false, rows }, showIcon: false, icon: '' })
}

function edge(
  id: string,
  fromId: string,
  toId: string,
  fromSide: Side,
  toSide: Side,
  extras: Partial<EdgeStyle> = {},
): EdgeModel {
  return createEdge({ fromId, toId, fromSide, toSide }, { id, style: extras })
}

export function sampleDoc(): Doc {
  return {
    nodes: [
      node('phone', 36, 28, 196, 'Phone', [['number'], ['extension']]),
      node('email', 36, 176, 196, 'Email', [['address']]),
      node('person', 508, 36, 210, 'Person', [['name']]),
      node('authority', 36, 372, 196, 'Authority', [['name']]),
      node('client', 286, 372, 200, 'Client', [['name']]),
      node('department', 508, 292, 210, 'Department', [['name']]),
      node('team', 848, 156, 206, 'Team', [['name']]),
      node('domain', 286, 548, 210, 'Domain', [['name'], ['is_regulated (true/false)']]),
      node('campaign', 848, 508, 220, 'Campaign', [['name']]),
      node('region', 508, 736, 220, 'Region', [['name']]),
    ],
    edges: [
      edge('touch', 'phone', 'person', 'right', 'left'),
      edge('emailTouch', 'email', 'person', 'right', 'left'),
      edge('represents', 'person', 'department', 'bottom', 'top', { pathStyle: 'straight' }),
      edge('teamRole', 'person', 'team', 'right', 'top'),
      edge('teamDept', 'team', 'department', 'left', 'right'),
      edge('domainWork', 'client', 'domain', 'bottom', 'top', { pathStyle: 'straight' }),
      edge('owns', 'team', 'campaign', 'bottom', 'top', { pathStyle: 'straight' }),
      edge('governed', 'domain', 'authority', 'left', 'bottom'),
      edge('proposed', 'domain', 'region', 'right', 'top'),
      edge('applies', 'campaign', 'region', 'left', 'right'),
    ],
    icons: [],
    nodeTypes: [],
    edgeTypes: [],
    defaults: defaultDefaults(),
    canvas: {
      background: { kind: 'solid', color: '#1a1a1a' },
      showGrid: true,
      gridColor: '#3c3c3c',
      gridGap: 22,
      snap: false,
      guides: true,
      guidePadding: 32,
    },
    exportSettings: { padding: 48, scale: 2 },
    styleVersion: 5,
  }
}

export function emptyDoc(from?: Doc): Doc {
  const base = from ?? sampleDoc()
  return { ...base, nodes: [], edges: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function num(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function normalizeTable(value: unknown): TableData {
  if (!isRecord(value) || !Array.isArray(value.rows)) return { hasHeader: false, rows: [] }
  return {
    hasHeader: value.hasHeader === true,
    rows: value.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [])),
  }
}

const sideSet = new Set<Side>(['top', 'right', 'bottom', 'left'])

function asSide(value: unknown, fallback: Side): Side {
  return typeof value === 'string' && sideSet.has(value as Side) ? (value as Side) : fallback
}

function normalizeNode(value: unknown, legacyIconColor: boolean, legacyHeaderColor: boolean, typeIds: Set<string>): NodeModel | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const style = nodeStyleOverrides(value)
  if (legacyHeaderColor && style.titleColor && !style.tableHeaderColor) style.tableHeaderColor = style.titleColor
  if (legacyIconColor) {
    const source = isRecord(value.style) ? value.style : value
    if (!('iconColor' in source) && style.titleColor) style.iconColor = style.titleColor
  }
  return {
    id: value.id,
    x: num(value.x, 0),
    y: num(value.y, 0),
    width: clamp(num(value.width, defaultNodeWidth), 80, 2400),
    height: typeof value.height === 'number' && Number.isFinite(value.height) ? clamp(value.height, 52, 2400) : null,
    heightAnchor: value.heightAnchor === 'center' ? 'center' : 'top',
    title: str(value.title, 'Node'),
    description: str(value.description, ''),
    icon: normalizeIconRef(value.icon),
    showTitle: value.showTitle !== false,
    showDescription: value.showDescription !== false,
    showIcon: value.showIcon === true,
    showTable: value.showTable !== false,
    table: normalizeTable(value.table),
    autoWidth: value.autoWidth === true,
    centerAnchors: value.centerAnchors === true,
    typeId: typeof value.typeId === 'string' && typeIds.has(value.typeId) ? value.typeId : '',
    style,
  }
}

function normalizeEdge(value: unknown, typeIds: Set<string>, legacyArrows?: ReturnType<typeof legacyArrowBaseline>): EdgeModel | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (typeof value.fromId !== 'string' || typeof value.toId !== 'string') return null
  return {
    id: value.id,
    fromId: value.fromId,
    toId: value.toId,
    fromSide: asSide(value.fromSide, 'right'),
    toSide: asSide(value.toSide, 'left'),
    typeId: typeof value.typeId === 'string' && typeIds.has(value.typeId) ? value.typeId : '',
    style: edgeStyleOverrides(value, legacyArrows),
  }
}

function normalizeBackground(value: unknown): CanvasBackground {
  if (typeof value === 'string') return { kind: 'solid', color: value }
  if (!isRecord(value)) return { kind: 'solid', color: '#1a1a1a' }
  if (value.kind === 'transparent') return { kind: 'transparent' }
  if (value.kind === 'gradient') {
    return {
      kind: 'gradient',
      from: str(value.from, '#1a1a1a'),
      to: str(value.to, '#3a3a3a'),
      angle: clamp(num(value.angle, 160), 0, 360),
    }
  }
  return { kind: 'solid', color: str(value.color, '#1a1a1a') }
}

export function normalizeDoc(value: unknown): Doc {
  const fallback = sampleDoc()
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return fallback
  const legacyIconColor = num(value.styleVersion, 1) < 2
  const legacyArrows = num(value.styleVersion, 1) < 3
  const legacyHeaderColor = num(value.styleVersion, 1) < 5
  const nodeTypes = normalizeNodeTypes(value.nodeTypes).map((type) => {
    if (!legacyHeaderColor || !type.style.titleColor || type.style.tableHeaderColor) return type
    return { ...type, style: { ...type.style, tableHeaderColor: type.style.titleColor } }
  })
  const edgeTypes = normalizeEdgeTypes(value.edgeTypes)
  const nodeTypeIds = new Set(nodeTypes.map((type) => type.id))
  const edgeTypeIds = new Set(edgeTypes.map((type) => type.id))
  const nodes = value.nodes
    .map((node) => normalizeNode(node, legacyIconColor, legacyHeaderColor, nodeTypeIds))
    .filter((node): node is NodeModel => !!node)
  const ids = new Set(nodes.map((node) => node.id))
  const defaults = isRecord(value.defaults) ? value.defaults : {}
  const legacyArrow = legacyArrows ? legacyArrowBaseline(defaults.edge) : undefined
  const edges = value.edges
    .map((edge) => normalizeEdge(edge, edgeTypeIds, legacyArrow))
    .filter((edge): edge is EdgeModel => !!edge && ids.has(edge.fromId) && ids.has(edge.toId))
  const canvas = isRecord(value.canvas) ? value.canvas : {}
  const exportSettings = isRecord(value.exportSettings) ? value.exportSettings : {}
  const rawNodeDefaults = isRecord(defaults.node) ? defaults.node : {}
  const nodeDefaults = normalizeNodeDefaults(rawNodeDefaults)
  if (legacyIconColor && !('iconColor' in rawNodeDefaults)) nodeDefaults.iconColor = nodeDefaults.titleColor
  if (legacyHeaderColor && !('tableHeaderColor' in rawNodeDefaults)) nodeDefaults.tableHeaderColor = nodeDefaults.titleColor
  return {
    nodes,
    edges,
    icons: normalizeIcons(value.icons),
    nodeTypes,
    edgeTypes,
    defaults: {
      node: nodeDefaults,
      edge: normalizeEdgeDefaults(defaults.edge, legacyArrows),
      nodeWidth: clamp(num(defaults.nodeWidth, defaultNodeWidth), 120, 720),
      nodeAutoWidth: defaults.nodeAutoWidth === true,
    },
    canvas: {
      background: normalizeBackground(canvas.background),
      showGrid: canvas.showGrid !== false,
      gridColor: str(canvas.gridColor, fallback.canvas.gridColor),
      gridGap: clamp(num(canvas.gridGap, fallback.canvas.gridGap), 12, 64),
      snap: canvas.snap === true,
      guides: canvas.guides !== false,
      guidePadding: clamp(num(canvas.guidePadding, 32), 8, 160),
    },
    exportSettings: {
      padding: clamp(num(exportSettings.padding, fallback.exportSettings.padding), 0, 400),
      scale: [1, 2, 3].includes(num(exportSettings.scale, 2)) ? num(exportSettings.scale, 2) : 2,
    },
    styleVersion: 5,
  }
}

export function coerceDoc(value: unknown): Doc | null {
  const payload = isRecord(value) && value.kind === 'graph-visualizer' ? value.doc : value
  if (!isRecord(payload) || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) return null
  return normalizeDoc(payload)
}

const STORAGE_KEY = 'graph-visualizer-doc-v1'

let blockSave = false

export function loadDoc(): Doc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return sampleDoc()
    return normalizeDoc(JSON.parse(raw))
  } catch {
    blockSave = true
    return sampleDoc()
  }
}

export function saveDoc(doc: Doc) {
  if (blockSave) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    /* ignore quota and private-mode failures */
  }
}
