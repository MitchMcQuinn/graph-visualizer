import type { PointerEvent } from 'react'
import { fontFamily } from '../fonts'
import { DiagramIcon } from '../icons'
import type { NodeLayout, TableLayout, TextRun } from '../layout'
import type { ResolvedEdge, ResolvedNode } from '../style'
import type { ArrowHead, CustomIcon, LineStyle } from '../types'

export function arrowSize(head: ArrowHead, length: number, width: number) {
  if (head === 'none') return null
  if (head === 'bullet') return { length, width: length }
  if (head === 'bar') return { length: width, width: length }
  return { length, width }
}

export function arrowInset(head: ArrowHead, length: number, width: number) {
  if (head === 'none') return 0
  if (head === 'bar') return width / 2
  return length / 2
}

export function dashArray(style: LineStyle, strokeWidth: number) {
  if (style === 'dashed') return `${Math.max(7, strokeWidth * 5)} ${Math.max(4.5, strokeWidth * 3)}`
  if (style === 'dotted') return `0.01 ${Math.max(4.2, strokeWidth * 3.3)}`
  return undefined
}

function Runs({
  runs,
  titleColor,
  textColor,
  headerColor,
  fontFamily: family,
}: {
  runs: TextRun[]
  titleColor: string
  textColor: string
  headerColor?: string
  fontFamily: string
}) {
  return runs.map((run, index) =>
    run.text ? (
      <text
        key={`${run.y}-${index}`}
        x={run.x}
        y={run.y}
        fill={run.color === 'title' ? titleColor : run.color === 'header' ? (headerColor ?? titleColor) : textColor}
        fontSize={run.size}
        fontWeight={run.weight}
        fontFamily={family}
        textAnchor={run.anchor}
        dominantBaseline="hanging"
      >
        {run.text}
      </text>
    ) : null,
  )
}

export function TableView({
  table,
  titleColor,
  textColor,
  headerColor,
  fontFamily: family,
}: {
  table: TableLayout
  titleColor: string
  textColor: string
  headerColor: string
  fontFamily: string
}) {
  return (
    <g transform={`translate(${table.x} ${table.y})`}>
      {table.rows.map((row, index) =>
        row.fill ? (
          <rect
            key={`fill-${index}`}
            x={0}
            y={row.y}
            width={table.width}
            height={row.height}
            fill={row.fill}
            fillOpacity={row.fillOpacity}
          />
        ) : null,
      )}
      {table.verticals.map((x, index) => (
        <line
          key={`v-${index}`}
          x1={x}
          y1={0}
          x2={x}
          y2={table.height}
          stroke={textColor}
          strokeOpacity={0.28}
          strokeWidth={1}
        />
      ))}
      {table.rows.map((row, index) =>
        row.ruleY == null ? null : (
          <line
            key={`r-${index}`}
            x1={0}
            x2={table.width}
            y1={row.ruleY}
            y2={row.ruleY}
            stroke={textColor}
            strokeOpacity={0.28}
            strokeWidth={1}
          />
        ),
      )}
      {table.rows.map((row, rowIndex) => (
        <g key={rowIndex} transform={`translate(0 ${row.y})`}>
          {row.cells.map((lines, cellIndex) => (
            <Runs key={cellIndex} runs={lines} titleColor={titleColor} textColor={textColor} headerColor={headerColor} fontFamily={family} />
          ))}
        </g>
      ))}
    </g>
  )
}

function ArrowMarker({
  id,
  orient,
  head,
  length,
  width,
  color,
}: {
  id: string
  orient: 'auto' | 'auto-start-reverse'
  head: ArrowHead
  length: number
  width: number
  color: string
}) {
  const size = arrowSize(head, length, width)
  if (!size) return null
  const inset = Math.min(0.6, size.width * 0.08)
  return (
    <marker
      id={id}
      markerWidth={size.length}
      markerHeight={size.width}
      refX={size.length / 2}
      refY={size.width / 2}
      orient={orient}
      markerUnits="userSpaceOnUse"
      overflow="visible"
    >
      {head === 'bullet' ? (
        <circle cx={size.length / 2} cy={size.width / 2} r={size.length / 2} fill={color} />
      ) : head === 'bar' ? (
        <rect x={0} y={0} width={size.length} height={size.width} fill={color} />
      ) : (
        <path d={`M 0 ${inset} L ${size.length} ${size.width / 2} L 0 ${size.width - inset} Z`} fill={color} />
      )}
    </marker>
  )
}

export function EdgeMarkers({ edges }: { edges: ResolvedEdge[] }) {
  return (
    <defs>
      {edges.flatMap((edge) => [
        <ArrowMarker
          key={`${edge.id}-end`}
          id={`arrow-end-${edge.id}`}
          orient="auto"
          head={edge.endHead}
          length={edge.endLength}
          width={edge.endWidth}
          color={edge.color}
        />,
        <ArrowMarker
          key={`${edge.id}-start`}
          id={`arrow-start-${edge.id}`}
          orient="auto-start-reverse"
          head={edge.startHead}
          length={edge.startLength}
          width={edge.startWidth}
          color={edge.color}
        />,
      ])}
    </defs>
  )
}

export function EdgePath({ edge, d }: { edge: ResolvedEdge; d: string }) {
  return (
    <path
      data-edge-id={edge.id}
      d={d}
      fill="none"
      stroke={edge.color}
      strokeWidth={edge.strokeWidth}
      strokeDasharray={dashArray(edge.lineStyle, edge.strokeWidth)}
      strokeLinecap={edge.lineStyle === 'dotted' ? 'round' : 'butt'}
      strokeLinejoin={edge.pathStyle === 'squared' ? 'miter' : 'round'}
      markerEnd={edge.endHead === 'none' ? undefined : `url(#arrow-end-${edge.id})`}
      markerStart={edge.startHead === 'none' ? undefined : `url(#arrow-start-${edge.id})`}
      pointerEvents="none"
    />
  )
}

export function NodeShape({
  node,
  layout,
  icons,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  node: ResolvedNode
  layout: NodeLayout
  icons: CustomIcon[]
  onPointerDown: (event: PointerEvent<SVGGElement>) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const stroke = node.strokeOpacity > 0 ? node.strokeWidth : 0
  const family = fontFamily(node.font)
  return (
    <g
      data-hit="node"
      data-node-id={node.id}
      transform={`translate(${node.x} ${node.y})`}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{ cursor: 'grab' }}
    >
      <rect
        x={stroke / 2}
        y={stroke / 2}
        width={Math.max(0, layout.width - stroke)}
        height={Math.max(0, layout.height - stroke)}
        rx={Math.max(0, node.radius - stroke / 2)}
        ry={Math.max(0, node.radius - stroke / 2)}
        fill={node.fillOpacity > 0 ? node.fill : 'none'}
        fillOpacity={node.fillOpacity}
        stroke={stroke > 0 ? node.stroke : 'none'}
        strokeOpacity={node.strokeOpacity}
        strokeWidth={stroke}
      />
      {layout.icon ? (
        <DiagramIcon
          icon={node.icon}
          icons={icons}
          x={layout.icon.x}
          y={layout.icon.y}
          size={layout.icon.size}
          color={node.iconColor}
          maskId={`icon-mask-${node.id}`}
        />
      ) : null}
      <Runs runs={layout.title} titleColor={node.titleColor} textColor={node.textColor} fontFamily={family} />
      <Runs runs={layout.description} titleColor={node.titleColor} textColor={node.textColor} fontFamily={family} />
      {layout.table ? (
        <TableView table={layout.table} titleColor={node.titleColor} textColor={node.textColor} headerColor={node.tableHeaderColor} fontFamily={family} />
      ) : null}
    </g>
  )
}
