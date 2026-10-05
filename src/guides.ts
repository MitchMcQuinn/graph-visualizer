import type { Rect } from './geometry'

export type GuideLine = {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'align' | 'gap'
}

type Candidate = { delta: number; guides: GuideLine[] }

const mark = {
  start: (rect: Rect, axis: 'x' | 'y') => (axis === 'x' ? rect.x : rect.y),
  center: (rect: Rect, axis: 'x' | 'y') => (axis === 'x' ? rect.x + rect.width / 2 : rect.y + rect.height / 2),
  end: (rect: Rect, axis: 'x' | 'y') => (axis === 'x' ? rect.x + rect.width : rect.y + rect.height),
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

function gapTicks(x1: number, y1: number, x2: number, y2: number, tick: number): GuideLine[] {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const nx = (-dy / length) * tick
  const ny = (dx / length) * tick
  return [
    { x1, y1, x2, y2, kind: 'gap' },
    { x1: x1 - nx, y1: y1 - ny, x2: x1 + nx, y2: y1 + ny, kind: 'gap' },
    { x1: x2 - nx, y1: y2 - ny, x2: x2 + nx, y2: y2 + ny, kind: 'gap' },
  ]
}

function alignLine(axis: 'x' | 'y', at: number, moving: Rect, still: Rect, pad: number): GuideLine {
  if (axis === 'x') {
    const y1 = Math.min(moving.y, still.y) - pad
    const y2 = Math.max(moving.y + moving.height, still.y + still.height) + pad
    return { x1: at, y1, x2: at, y2, kind: 'align' }
  }
  const x1 = Math.min(moving.x, still.x) - pad
  const x2 = Math.max(moving.x + moving.width, still.x + still.width) + pad
  return { x1, y1: at, x2, y2: at, kind: 'align' }
}

function choose(candidates: Candidate[]): { delta: number; guides: GuideLine[]; snapped: boolean } {
  if (!candidates.length) return { delta: 0, guides: [], snapped: false }
  candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
  const delta = candidates[0].delta
  const guides = candidates.filter((item) => Math.abs(item.delta - delta) < 0.05).flatMap((item) => item.guides)
  return { delta, guides, snapped: true }
}

function gapBetween(a: Rect, b: Rect, axis: 'x' | 'y') {
  if (axis === 'x') {
    const left = a.x <= b.x ? a : b
    const right = a.x <= b.x ? b : a
    return right.x - (left.x + left.width)
  }
  const top = a.y <= b.y ? a : b
  const bottom = a.y <= b.y ? b : a
  return bottom.y - (top.y + top.height)
}

function observedGaps(still: Rect[], axis: 'x' | 'y') {
  const gaps: number[] = []
  for (let i = 0; i < still.length; i += 1) {
    for (let j = i + 1; j < still.length; j += 1) {
      const a = still[i]
      const b = still[j]
      const shared =
        axis === 'x'
          ? overlap(a.y, a.y + a.height, b.y, b.y + b.height)
          : overlap(a.x, a.x + a.width, b.x, b.x + b.width)
      if (shared < 12) continue
      const gap = gapBetween(a, b, axis)
      if (gap >= 8 && gap <= 400) gaps.push(gap)
    }
  }
  return gaps
}

function spacingTargets(still: Rect[], axis: 'x' | 'y', padding: number) {
  const targets = [padding]
  for (const gap of observedGaps(still, axis)) {
    if (!targets.some((target) => Math.abs(target - gap) < 1)) targets.push(gap)
  }
  return targets
}

function candidatesForAxis(moving: Rect[], still: Rect[], axis: 'x' | 'y', padding: number, threshold: number, pad: number) {
  const found: Candidate[] = []
  const targets = spacingTargets(still, axis, padding)
  for (const item of moving) {
    for (const other of still) {
      for (const key of ['start', 'center', 'end'] as const) {
        const delta = mark[key](other, axis) - mark[key](item, axis)
        if (Math.abs(delta) > threshold) continue
        found.push({ delta, guides: [alignLine(axis, mark[key](other, axis), item, other, pad)] })
      }
      const shared =
        axis === 'x'
          ? overlap(item.y, item.y + item.height, other.y, other.y + other.height)
          : overlap(item.x, item.x + item.width, other.x, other.x + other.width)
      if (shared < 12) continue
      for (const target of targets) {
        if (axis === 'x') {
          const mid = (Math.max(item.y, other.y) + Math.min(item.y + item.height, other.y + other.height)) / 2
          const gapRight = item.x - (other.x + other.width)
          if (gapRight > -threshold && Math.abs(gapRight - target) <= threshold) {
            const x1 = other.x + other.width
            found.push({ delta: target - gapRight, guides: gapTicks(x1, mid, x1 + target, mid, pad * 0.6) })
          }
          const gapLeft = other.x - (item.x + item.width)
          if (gapLeft > -threshold && Math.abs(gapLeft - target) <= threshold) {
            const x2 = other.x
            found.push({ delta: gapLeft - target, guides: gapTicks(x2 - target, mid, x2, mid, pad * 0.6) })
          }
        } else {
          const mid = (Math.max(item.x, other.x) + Math.min(item.x + item.width, other.x + other.width)) / 2
          const gapBelow = item.y - (other.y + other.height)
          if (gapBelow > -threshold && Math.abs(gapBelow - target) <= threshold) {
            const y1 = other.y + other.height
            found.push({ delta: target - gapBelow, guides: gapTicks(mid, y1, mid, y1 + target, pad * 0.6) })
          }
          const gapAbove = other.y - (item.y + item.height)
          if (gapAbove > -threshold && Math.abs(gapAbove - target) <= threshold) {
            const y2 = other.y
            found.push({ delta: gapAbove - target, guides: gapTicks(mid, y2 - target, mid, y2, pad * 0.6) })
          }
        }
      }
    }
  }
  return found
}

export function snapToGuides(
  moving: Rect[],
  still: Rect[],
  padding: number,
  threshold: { x: number; y: number },
  pad: number,
) {
  const x = choose(candidatesForAxis(moving, still, 'x', padding, threshold.x, pad))
  const y = choose(candidatesForAxis(moving, still, 'y', padding, threshold.y, pad))
  return { dx: x.delta, dy: y.delta, guides: [...x.guides, ...y.guides], snappedX: x.snapped, snappedY: y.snapped }
}
