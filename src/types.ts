export type Side = 'top' | 'right' | 'bottom' | 'left'

export type PathStyle = 'curved' | 'straight' | 'squared' | 'rounded'

export type LineStyle = 'solid' | 'dashed' | 'dotted'

export type ArrowHead = 'none' | 'arrow' | 'bullet' | 'bar'

export type TextAlign = 'left' | 'center' | 'right'

export type IconAlign = 'with-text' | TextAlign

export type FontId = 'inter' | 'source-serif' | 'newsreader' | 'plex-mono' | 'system'

export type TableBorders = 'none' | 'rows' | 'grid'

export type TableDensity = 'compact' | 'regular'

export type TableData = {
  hasHeader: boolean
  rows: string[][]
}

export type NodeStyle = {
  fill: string
  fillOpacity: number
  stroke: string
  strokeOpacity: number
  strokeWidth: number
  radius: number
  titleColor: string
  textColor: string
  titleSize: number
  textSize: number
  align: TextAlign
  iconSize: number
  iconAlign: IconAlign
  iconOffset: number
  iconColor: string
  font: FontId
  titleWeight: 600 | 700
  tableBorders: TableBorders
  tableHeaderColor: string
  tableHeaderFill: string
  tableHeaderOpacity: number
  tableStripe: boolean
  tableStripeFill: string
  tableStripeOpacity: number
  tableDensity: TableDensity
}

export type EdgeStyle = {
  pathStyle: PathStyle
  lineStyle: LineStyle
  startHead: ArrowHead
  startLength: number
  startWidth: number
  endHead: ArrowHead
  endLength: number
  endWidth: number
  color: string
  strokeWidth: number
}

export type NodeModel = {
  id: string
  x: number
  y: number
  width: number
  height: number | null
  heightAnchor: 'top' | 'center'
  title: string
  description: string
  icon: string
  showTitle: boolean
  showDescription: boolean
  showIcon: boolean
  showTable: boolean
  table: TableData
  autoWidth: boolean
  centerAnchors: boolean
  typeId: string
  style: Partial<NodeStyle>
}

export type EdgeModel = {
  id: string
  fromId: string
  toId: string
  fromSide: Side
  toSide: Side
  typeId: string
  style: Partial<EdgeStyle>
}

export type NodeType = {
  id: string
  name: string
  style: Partial<NodeStyle>
}

export type EdgeType = {
  id: string
  name: string
  style: Partial<EdgeStyle>
}

export type CustomIcon = {
  id: string
  name: string
  href: string
}

export type Defaults = {
  node: NodeStyle
  edge: EdgeStyle
  nodeWidth: number
  nodeAutoWidth: boolean
}

export type CanvasBackground =
  | { kind: 'solid'; color: string }
  | { kind: 'transparent' }
  | { kind: 'gradient'; from: string; to: string; angle: number }

export type CanvasSettings = {
  background: CanvasBackground
  showGrid: boolean
  gridColor: string
  gridGap: number
  snap: boolean
  guides: boolean
  guidePadding: number
}

export type ExportSettings = {
  padding: number
  scale: number
}

export type Doc = {
  nodes: NodeModel[]
  edges: EdgeModel[]
  icons: CustomIcon[]
  nodeTypes: NodeType[]
  edgeTypes: EdgeType[]
  defaults: Defaults
  canvas: CanvasSettings
  exportSettings: ExportSettings
  styleVersion: number
}

export type Selection =
  | { kind: 'node'; ids: string[] }
  | { kind: 'edge'; id: string }
  | null

export type Connecting = {
  fromId: string
  fromSide: Side
  x: number
  y: number
}
