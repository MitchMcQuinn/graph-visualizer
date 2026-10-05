import type { EdgeModel, PathStyle, Side } from './types'

export type Point = { x: number; y: number }

export type Rect = { x: number; y: number; width: number; height: number }

export type Anchor = {
  point: Point
  normal: Point
  side: Side
}

export type Route = {
  d: string
}

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

export const SIDE_NORMAL: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function dedupe(points: Point[]) {
  const out: Point[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (prev && dist(prev, point) < 0.6) continue
    out.push(point)
  }
  const simple: Point[] = []
  for (let i = 0; i < out.length; i++) {
    const curr = out[i]
    const prev = simple[simple.length - 1]
    const next = out[i + 1]
    if (!prev || !next) {
      simple.push(curr)
      continue
    }
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
    if (Math.abs(cross) < 0.6) continue
    simple.push(curr)
  }
  return simple
}

export function anchorOnRect(rect: Rect, side: Side, index: number, count: number): Anchor {
  const span = side === 'top' || side === 'bottom' ? rect.width : rect.height
  const inset = Math.min(28, Math.max(14, span * 0.2))
  const usable = span - inset * 2
  const t = count <= 1 || usable <= 4 ? 0.5 : index / (count - 1)
  const along = usable <= 4 ? span / 2 : inset + usable * t
  const point =
    side === 'top'
      ? { x: rect.x + along, y: rect.y }
      : side === 'bottom'
        ? { x: rect.x + along, y: rect.y + rect.height }
        : side === 'left'
          ? { x: rect.x, y: rect.y + along }
          : { x: rect.x + rect.width, y: rect.y + along }
  return { point, normal: SIDE_NORMAL[side], side }
}

export function buildAnchorMap(edges: EdgeModel[], rects: Map<string, Rect>) {
  const groups = new Map<string, { key: string; sort: number }[]>()
  const add = (edge: EdgeModel, end: 'from' | 'to') => {
    const nodeId = end === 'from' ? edge.fromId : edge.toId
    const side = end === 'from' ? edge.fromSide : edge.toSide
    const other = rects.get(end === 'from' ? edge.toId : edge.fromId)
    const sort = !other
      ? 0
      : side === 'top' || side === 'bottom'
        ? other.x + other.width / 2
        : other.y + other.height / 2
    const groupKey = `${nodeId}:${side}`
    const list = groups.get(groupKey) ?? []
    list.push({ key: `${edge.id}:${end}`, sort })
    groups.set(groupKey, list)
  }
  for (const edge of edges) {
    add(edge, 'from')
    add(edge, 'to')
  }
  const map = new Map<string, { index: number; count: number }>()
  for (const list of groups.values()) {
    list.sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key))
    list.forEach((item, index) => map.set(item.key, { index, count: list.length }))
  }
  return map
}

function curvedPath(from: Anchor, to: Anchor) {
  const distance = dist(from.point, to.point)
  let out = Math.max(56, Math.min(240, distance * 0.45))
  let into = out
  const leaving = (to.point.x - from.point.x) * from.normal.x + (to.point.y - from.point.y) * from.normal.y
  const arriving = (from.point.x - to.point.x) * to.normal.x + (from.point.y - to.point.y) * to.normal.y
  if (leaving < 40) out = Math.max(out, 90 + Math.abs(Math.min(0, leaving)) * 0.45)
  if (arriving < 40) into = Math.max(into, 90 + Math.abs(Math.min(0, arriving)) * 0.45)
  const c1 = { x: from.point.x + from.normal.x * out, y: from.point.y + from.normal.y * out }
  const c2 = { x: to.point.x + to.normal.x * into, y: to.point.y + to.normal.y * into }
  return `M ${round(from.point.x)} ${round(from.point.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.point.x)} ${round(to.point.y)}`
}

function straightPath(from: Anchor, to: Anchor) {
  return `M ${round(from.point.x)} ${round(from.point.y)} L ${round(to.point.x)} ${round(to.point.y)}`
}

function orthogonalPoints(from: Anchor, to: Anchor) {
  const stub = 32
  const start = {
    x: from.point.x + from.normal.x * stub,
    y: from.point.y + from.normal.y * stub,
  }
  const end = {
    x: to.point.x + to.normal.x * stub,
    y: to.point.y + to.normal.y * stub,
  }
  const points = [from.point, start]
  const fromHorizontal = Math.abs(from.normal.x) > 0.5
  const toHorizontal = Math.abs(to.normal.x) > 0.5
  if (fromHorizontal === toHorizontal) {
    if (fromHorizontal) {
      const midX = (start.x + end.x) / 2
      points.push({ x: midX, y: start.y }, { x: midX, y: end.y })
    } else {
      const midY = (start.y + end.y) / 2
      points.push({ x: start.x, y: midY }, { x: end.x, y: midY })
    }
  } else if (fromHorizontal) {
    points.push({ x: end.x, y: start.y })
  } else {
    points.push({ x: start.x, y: end.y })
  }
  points.push(end, to.point)
  return dedupe(points)
}

function pathFromPoints(points: Point[], radius: number) {
  if (points.length === 0) return ''
  if (points.length < 3 || radius <= 0) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`).join(' ')
  }
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const inLen = dist(prev, curr)
    const outLen = dist(curr, next)
    const trim = Math.min(radius, inLen / 2, outLen / 2)
    if (trim < 1 || inLen < 1 || outLen < 1) {
      d += ` L ${round(curr.x)} ${round(curr.y)}`
      continue
    }
    const p1 = {
      x: curr.x + ((prev.x - curr.x) / inLen) * trim,
      y: curr.y + ((prev.y - curr.y) / inLen) * trim,
    }
    const p2 = {
      x: curr.x + ((next.x - curr.x) / outLen) * trim,
      y: curr.y + ((next.y - curr.y) / outLen) * trim,
    }
    d += ` L ${round(p1.x)} ${round(p1.y)} Q ${round(curr.x)} ${round(curr.y)} ${round(p2.x)} ${round(p2.y)}`
  }
  const last = points[points.length - 1]
  d += ` L ${round(last.x)} ${round(last.y)}`
  return d
}

type PathCmd =
  | { op: 'M' | 'L'; at: Point }
  | { op: 'Q'; control: Point; at: Point }
  | { op: 'C'; c1: Point; c2: Point; at: Point }

function parsePath(d: string): PathCmd[] {
  const tokens = d.match(/[MLCQ]|-?\d*\.?\d+/g) ?? []
  const commands: PathCmd[] = []
  let index = 0
  while (index < tokens.length) {
    const op = tokens[index]
    const read = () => ({ x: Number(tokens[index++]), y: Number(tokens[index++]) })
    index += 1
    if (op === 'M' || op === 'L') commands.push({ op, at: read() })
    else if (op === 'Q') commands.push({ op, control: read(), at: read() })
    else if (op === 'C') commands.push({ op, c1: read(), c2: read(), at: read() })
  }
  return commands
}

function moveToward(from: Point, to: Point, distance: number) {
  const length = dist(from, to)
  if (length < 1) return from
  const travel = Math.min(distance, length * 0.85)
  return {
    x: from.x + ((to.x - from.x) / length) * travel,
    y: from.y + ((to.y - from.y) / length) * travel,
  }
}

function commandEnd(command: PathCmd) {
  return command.at
}

function serializePath(commands: PathCmd[]) {
  return commands
    .map((command) => {
      const at = `${round(command.at.x)} ${round(command.at.y)}`
      if (command.op === 'M' || command.op === 'L') return `${command.op} ${at}`
      if (command.op === 'Q') return `Q ${round(command.control.x)} ${round(command.control.y)} ${at}`
      if (command.op === 'C') return `C ${round(command.c1.x)} ${round(command.c1.y)} ${round(command.c2.x)} ${round(command.c2.y)} ${at}`
      return ''
    })
    .join(' ')
}

export function shortenPath(d: string, start: number, end: number) {
  if (start <= 0 && end <= 0) return d
  const commands = parsePath(d)
  if (commands.length < 2) return d
  if (start > 0 && commands[0].op === 'M') {
    const next = commands[1]
    const toward = next.op === 'C' ? next.c1 : next.op === 'Q' ? next.control : next.at
    commands[0].at = moveToward(commands[0].at, toward, start)
  }
  if (end > 0) {
    const last = commands[commands.length - 1]
    const toward =
      last.op === 'C' ? last.c2 : last.op === 'Q' ? last.control : commandEnd(commands[commands.length - 2])
    last.at = moveToward(last.at, toward, end)
  }
  return serializePath(commands)
}

export function routeEdge(pathStyle: PathStyle, from: Anchor, to: Anchor): Route {
  if (pathStyle === 'straight') return { d: straightPath(from, to) }
  if (pathStyle === 'squared') return { d: pathFromPoints(orthogonalPoints(from, to), 0) }
  if (pathStyle === 'rounded') return { d: pathFromPoints(orthogonalPoints(from, to), 14) }
  return { d: curvedPath(from, to) }
}

export function previewPath(from: Anchor, cursor: Point) {
  const distance = dist(from.point, cursor)
  const handle = Math.max(36, Math.min(180, distance * 0.45))
  const c = { x: from.point.x + from.normal.x * handle, y: from.point.y + from.normal.y * handle }
  return `M ${round(from.point.x)} ${round(from.point.y)} Q ${round(c.x)} ${round(c.y)} ${round(cursor.x)} ${round(cursor.y)}`
}

export function nearestSide(
  point: Point,
  rects: { id: string; rect: Rect }[],
  zoom: number,
): { id: string; side: Side } | null {
  const radius = 16 / Math.max(zoom, 0.2)
  let best: { id: string; side: Side } | null = null
  let bestDist = radius
  for (const item of rects) {
    for (const side of SIDES) {
      const anchor = anchorOnRect(item.rect, side, 0, 1)
      const gap = dist(point, anchor.point)
      if (gap <= bestDist) {
        bestDist = gap
        best = { id: item.id, side }
      }
    }
  }
  return best
}
