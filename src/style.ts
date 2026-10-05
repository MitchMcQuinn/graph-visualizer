import { clamp } from './geometry'
import type { CustomIcon, Defaults, Doc, EdgeModel, EdgeStyle, EdgeType, FontId, IconAlign, NodeModel, NodeStyle, NodeType, TextAlign } from './types'

export const defaultNodeStyle: NodeStyle = {
  fill: '#1c1c1c',
  fillOpacity: 1,
  stroke: '#c8c8c8',
  strokeOpacity: 1,
  strokeWidth: 1.25,
  radius: 8,
  titleColor: '#ffffff',
  textColor: '#a6a6a6',
  titleSize: 15,
  textSize: 12.5,
  align: 'left',
  iconSize: 16,
  iconAlign: 'with-text',
  iconOffset: 0,
  iconColor: '#ffffff',
  font: 'inter',
  titleWeight: 600,
  tableBorders: 'none',
  tableHeaderColor: '#ffffff',
  tableHeaderFill: '#2a2a2a',
  tableHeaderOpacity: 0,
  tableStripe: false,
  tableStripeFill: '#ffffff',
  tableStripeOpacity: 0.06,
  tableDensity: 'regular',
}

export const defaultEdgeStyle: EdgeStyle = {
  pathStyle: 'curved',
  lineStyle: 'solid',
  startHead: 'none',
  startLength: 11,
  startWidth: 8,
  endHead: 'arrow',
  endLength: 11,
  endWidth: 8,
  color: '#d0d0d0',
  strokeWidth: 1.25,
}

export const defaultNodeWidth = 200

export function defaultDefaults(): Defaults {
  return {
    node: { ...defaultNodeStyle },
    edge: { ...defaultEdgeStyle },
    nodeWidth: defaultNodeWidth,
    nodeAutoWidth: false,
  }
}

export type ResolvedNode = NodeModel & NodeStyle
export type ResolvedEdge = EdgeModel & EdgeStyle

export function nodeStyleBase(defaults: NodeStyle, types: NodeType[], typeId: string): NodeStyle {
  const type = typeId ? types.find((item) => item.id === typeId) : undefined
  return type ? { ...defaults, ...type.style } : defaults
}

export function edgeStyleBase(defaults: EdgeStyle, types: EdgeType[], typeId: string): EdgeStyle {
  const type = typeId ? types.find((item) => item.id === typeId) : undefined
  return type ? { ...defaults, ...type.style } : defaults
}

export function resolveNode(node: NodeModel, defaults: NodeStyle, types: NodeType[] = []): ResolvedNode {
  return { ...node, ...nodeStyleBase(defaults, types, node.typeId), ...node.style }
}

export function resolveEdge(edge: EdgeModel, defaults: EdgeStyle, types: EdgeType[] = []): ResolvedEdge {
  return { ...edge, ...edgeStyleBase(defaults, types, edge.typeId), ...edge.style }
}

function sameValue(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.001
  return Object.is(a, b)
}

export function applyNodeStyle(current: Partial<NodeStyle> | undefined, patch: Partial<NodeStyle>, defaults: NodeStyle) {
  const next: Partial<NodeStyle> = { ...current, ...patch }
  for (const key of Object.keys(patch) as (keyof NodeStyle)[]) {
    if (sameValue(next[key], defaults[key])) delete next[key]
  }
  return next
}

export function applyEdgeStyle(current: Partial<EdgeStyle> | undefined, patch: Partial<EdgeStyle>, defaults: EdgeStyle) {
  const next: Partial<EdgeStyle> = { ...current, ...patch }
  for (const key of Object.keys(patch) as (keyof EdgeStyle)[]) {
    if (sameValue(next[key], defaults[key])) delete next[key]
  }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const aligns = new Set<TextAlign>(['left', 'center', 'right'])
const iconAligns = new Set<IconAlign>(['with-text', 'left', 'center', 'right'])
const fonts = new Set<FontId>(['inter', 'source-serif', 'newsreader', 'plex-mono', 'system'])

function readNodeField<K extends keyof NodeStyle>(key: K, value: unknown): NodeStyle[K] | undefined {
  switch (key) {
    case 'fill':
    case 'stroke':
    case 'titleColor':
    case 'textColor':
    case 'iconColor':
    case 'tableHeaderColor':
    case 'tableHeaderFill':
    case 'tableStripeFill':
      return (typeof value === 'string' ? value : undefined) as NodeStyle[K] | undefined
    case 'fillOpacity':
    case 'strokeOpacity':
    case 'tableHeaderOpacity':
    case 'tableStripeOpacity':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : undefined) as NodeStyle[K] | undefined
    case 'strokeWidth':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0.5, 8) : undefined) as NodeStyle[K] | undefined
    case 'radius':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 80) : undefined) as NodeStyle[K] | undefined
    case 'titleSize':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 10, 32) : undefined) as NodeStyle[K] | undefined
    case 'textSize':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 9, 24) : undefined) as NodeStyle[K] | undefined
    case 'iconSize':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 8, 96) : undefined) as NodeStyle[K] | undefined
    case 'iconOffset':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), -48, 48) : undefined) as NodeStyle[K] | undefined
    case 'align':
      return (typeof value === 'string' && aligns.has(value as TextAlign) ? value : undefined) as NodeStyle[K] | undefined
    case 'iconAlign':
      return (typeof value === 'string' && iconAligns.has(value as IconAlign) ? value : undefined) as NodeStyle[K] | undefined
    case 'font':
      return (typeof value === 'string' && fonts.has(value as FontId) ? value : undefined) as NodeStyle[K] | undefined
    case 'titleWeight':
      return (value === 600 || value === 700 ? value : undefined) as NodeStyle[K] | undefined
    case 'tableBorders':
      return (value === 'none' || value === 'rows' || value === 'grid' ? value : undefined) as NodeStyle[K] | undefined
    case 'tableStripe':
      return (typeof value === 'boolean' ? value : undefined) as NodeStyle[K] | undefined
    case 'tableDensity':
      return (value === 'compact' || value === 'regular' ? value : undefined) as NodeStyle[K] | undefined
    default:
      return undefined
  }
}

const nodeStyleKeys = Object.keys(defaultNodeStyle) as (keyof NodeStyle)[]

export function pickNodeStyle(source: Record<string, unknown>, dropDefaults: boolean): Partial<NodeStyle> {
  const style: Partial<NodeStyle> = {}
  for (const key of nodeStyleKeys) {
    const value = readNodeField(key, source[key])
    if (value === undefined) continue
    if (dropDefaults && sameValue(value, defaultNodeStyle[key])) continue
    style[key] = value as never
  }
  return style
}

export function nodeStyleOverrides(raw: Record<string, unknown>): Partial<NodeStyle> {
  if (isRecord(raw.style)) return pickNodeStyle(raw.style, false)
  return pickNodeStyle(raw, true)
}

export function normalizeNodeDefaults(value: unknown): NodeStyle {
  const raw = isRecord(value) ? value : {}
  return { ...defaultNodeStyle, ...pickNodeStyle(raw, false) }
}

function readEdgeField<K extends keyof EdgeStyle>(key: K, value: unknown): EdgeStyle[K] | undefined {
  switch (key) {
    case 'pathStyle':
      return (
        value === 'curved' || value === 'straight' || value === 'squared' || value === 'rounded' ? value : undefined
      ) as EdgeStyle[K] | undefined
    case 'lineStyle':
      return (value === 'solid' || value === 'dashed' || value === 'dotted' ? value : undefined) as EdgeStyle[K] | undefined
    case 'startHead':
    case 'endHead':
      return (value === 'none' || value === 'arrow' || value === 'bullet' || value === 'bar' ? value : undefined) as EdgeStyle[K] | undefined
    case 'startLength':
    case 'endLength':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 4, 48) : undefined) as EdgeStyle[K] | undefined
    case 'startWidth':
    case 'endWidth':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 2, 40) : undefined) as EdgeStyle[K] | undefined
    case 'color':
      return (typeof value === 'string' ? value : undefined) as EdgeStyle[K] | undefined
    case 'strokeWidth':
      return (typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0.5, 8) : undefined) as EdgeStyle[K] | undefined
    default:
      return undefined
  }
}

const edgeStyleKeys = Object.keys(defaultEdgeStyle) as (keyof EdgeStyle)[]

export function pickEdgeStyle(source: Record<string, unknown>, dropDefaults: boolean): Partial<EdgeStyle> {
  const style: Partial<EdgeStyle> = {}
  for (const key of edgeStyleKeys) {
    const value = readEdgeField(key, source[key])
    if (value === undefined) continue
    if (dropDefaults && sameValue(value, defaultEdgeStyle[key])) continue
    style[key] = value as never
  }
  return style
}

const arrowEndKeys = ['startHead', 'startLength', 'startWidth', 'endHead', 'endLength', 'endWidth'] as const

export type LegacyArrow = {
  arrow: 'none' | 'end' | 'start' | 'both'
  arrowHead: 'arrow' | 'bullet'
  arrowLength: number
  arrowWidth: number
}

const legacyArrowDefault: LegacyArrow = {
  arrow: 'end',
  arrowHead: 'arrow',
  arrowLength: 11,
  arrowWidth: 8,
}

function legacyArrowPatch(source: Record<string, unknown>): Partial<LegacyArrow> {
  const patch: Partial<LegacyArrow> = {}
  if (source.arrow === 'none' || source.arrow === 'end' || source.arrow === 'start' || source.arrow === 'both') {
    patch.arrow = source.arrow
  }
  if (source.arrowHead === 'arrow' || source.arrowHead === 'bullet') patch.arrowHead = source.arrowHead
  if (typeof source.arrowLength === 'number' && Number.isFinite(source.arrowLength)) patch.arrowLength = clamp(source.arrowLength, 4, 48)
  if (typeof source.arrowWidth === 'number' && Number.isFinite(source.arrowWidth)) patch.arrowWidth = clamp(source.arrowWidth, 2, 40)
  return patch
}

export function legacyArrowBaseline(value: unknown): LegacyArrow {
  return { ...legacyArrowDefault, ...legacyArrowPatch(isRecord(value) ? value : {}) }
}

function endsFromLegacy(style: LegacyArrow): Pick<EdgeStyle, (typeof arrowEndKeys)[number]> {
  const startOn = style.arrow === 'start' || style.arrow === 'both'
  const endOn = style.arrow === 'end' || style.arrow === 'both'
  return {
    startHead: startOn ? style.arrowHead : 'none',
    endHead: endOn ? style.arrowHead : 'none',
    startLength: style.arrowLength,
    endLength: style.arrowLength,
    startWidth: style.arrowWidth,
    endWidth: style.arrowWidth,
  }
}

function migrateArrowOverride(style: Record<string, unknown>, defaults: LegacyArrow): Partial<EdgeStyle> {
  if (Object.keys(legacyArrowPatch(style)).length === 0) return {}
  const resolved = endsFromLegacy({ ...defaults, ...legacyArrowPatch(style) })
  const base = endsFromLegacy(defaults)
  const migrated: Partial<EdgeStyle> = {}
  for (const key of arrowEndKeys) {
    if (!sameValue(resolved[key], base[key])) migrated[key] = resolved[key] as never
  }
  return migrated
}

export function edgeStyleOverrides(raw: Record<string, unknown>, legacyDefaults?: LegacyArrow): Partial<EdgeStyle> {
  const source = isRecord(raw.style) ? raw.style : raw
  const picked = pickEdgeStyle(source, source === raw)
  if (!legacyDefaults) return picked
  return { ...migrateArrowOverride(source, legacyDefaults), ...picked }
}

export function normalizeEdgeDefaults(value: unknown, legacy = false): EdgeStyle {
  const raw = isRecord(value) ? value : {}
  const picked = pickEdgeStyle(raw, false)
  if (!legacy) return { ...defaultEdgeStyle, ...picked }
  return { ...defaultEdgeStyle, ...endsFromLegacy(legacyArrowBaseline(raw)), ...picked }
}

const legacyIcons: Record<string, string> = {
  user: 'user',
  users: 'users',
  building: 'building-2',
  phone: 'phone',
  mail: 'mail',
  globe: 'globe',
  database: 'database',
  shield: 'shield',
  flag: 'flag',
  map: 'map-pin',
  megaphone: 'megaphone',
  briefcase: 'briefcase',
  layers: 'layers',
  tag: 'tag',
  workflow: 'workflow',
  box: 'box',
}

export function normalizeIconRef(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return ''
  if (value.startsWith('lucide:') || value.startsWith('custom:')) return value
  const mapped = legacyIcons[value] ?? value
  return `lucide:${mapped}`
}

export function normalizeIcons(value: unknown): CustomIcon[] {
  if (!Array.isArray(value)) return []
  const icons: CustomIcon[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string') continue
    const href = typeof item.href === 'string' ? item.href : ''
    if (!href.startsWith('data:image/') || href.length > 400_000) continue
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 80) : 'Icon'
    icons.push({ id: item.id, name, href })
    if (icons.length >= 40) break
  }
  return icons
}

const typeLimit = 40

export function normalizeNodeTypes(value: unknown): NodeType[] {
  if (!Array.isArray(value)) return []
  const types: NodeType[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    seen.add(item.id)
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 48) : 'Type'
    types.push({ id: item.id, name, style: pickNodeStyle(isRecord(item.style) ? item.style : {}, false) })
    if (types.length >= typeLimit) break
  }
  return types
}

export function normalizeEdgeTypes(value: unknown): EdgeType[] {
  if (!Array.isArray(value)) return []
  const types: EdgeType[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    seen.add(item.id)
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 48) : 'Type'
    types.push({ id: item.id, name, style: pickEdgeStyle(isRecord(item.style) ? item.style : {}, false) })
    if (types.length >= typeLimit) break
  }
  return types
}

export function fontsInUse(doc: Doc) {
  const ids = new Set<FontId>()
  let bold = false
  for (const node of doc.nodes) {
    const resolved = resolveNode(node, doc.defaults.node, doc.nodeTypes ?? [])
    ids.add(resolved.font)
    if (resolved.titleWeight === 700) bold = true
  }
  if (ids.size === 0) ids.add(doc.defaults.node.font)
  return { ids: [...ids], bold }
}
