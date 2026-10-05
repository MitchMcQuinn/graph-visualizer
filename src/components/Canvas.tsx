import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gradientVector } from '../background'
import { DIAGRAM_CONTENT_ID } from '../constants'
import { anchorOnRect, buildAnchorMap, nearestSide, previewPath, routeEdge, shortenPath, SIDES, type Rect, type Route } from '../geometry'
import { snapToGuides, type GuideLine } from '../guides'
import { fittedNodeWidth, layoutNode, type NodeLayout } from '../layout'
import { resolveEdge, resolveNode, type ResolvedEdge, type ResolvedNode } from '../style'
import { useDoc, useView } from '../store'
import { clearMeasureCache } from '../text'
import type { CanvasBackground, Doc, Side } from '../types'
import { EdgeMarkers, EdgePath, NodeShape, arrowInset, dashArray } from './diagram'

type Scene = {
  layouts: Map<string, NodeLayout>
  rects: Map<string, Rect>
  routes: Map<string, Route>
  nodes: ResolvedNode[]
  edges: ResolvedEdge[]
}

type Box = { x: number; y: number; width: number; height: number }

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number; moved: boolean; deselect: boolean }
  | { kind: 'nodes'; origins: { id: string; x: number; y: number }[]; sx: number; sy: number; moved: boolean; before: Doc; stickyX: boolean; stickyY: boolean }
  | { kind: 'resize'; id: string; sx: number; sy: number; ow: number; oh: number; oy: number; vertical: boolean; moved: boolean; before: Doc }
  | { kind: 'connect'; fromId: string; fromSide: Side; sx: number; sy: number; moved: boolean }
  | { kind: 'marquee'; sx: number; sy: number; x: number; y: number; moved: boolean; box: Box; additive: boolean; baseIds: string[] }

function intersects(a: Rect, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function normalizeBox(x0: number, y0: number, x1: number, y1: number): Box {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }
}

function strokePath(edge: ResolvedEdge, d: string) {
  return shortenPath(
    d,
    arrowInset(edge.startHead, edge.startLength, edge.startWidth),
    arrowInset(edge.endHead, edge.endLength, edge.endWidth),
  )
}

function rectEntries(rects: Map<string, Rect>) {
  return [...rects.entries()].map(([id, rect]) => ({ id, rect }))
}

export function Canvas() {
  const api = useDoc()
  const { doc, selection, fitToken } = api
  const { view, setView, svgRef, viewportRef, userMovedRef, interactionRef, clientToWorld, zoomAt, fit } = useView()
  const [fontEpoch, setFontEpoch] = useState(0)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const [hotSide, setHotSide] = useState<{ id: string; side: Side } | null>(null)
  const [connectDrag, setConnectDrag] = useState<{ fromId: string; fromSide: Side; x: number; y: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [guides, setGuides] = useState<GuideLine[]>([])
  const gesture = useRef<Gesture | null>(null)
  const apiRef = useRef(api)
  const docRef = useRef(doc)
  const sceneRef = useRef<Scene | null>(null)
  const viewRef = useRef(view)
  apiRef.current = api
  docRef.current = doc
  viewRef.current = view

  const scene = useMemo(() => {
    const nodes = doc.nodes.map((node) => {
      const resolved = resolveNode(node, doc.defaults.node, doc.nodeTypes ?? [])
      return resolved.autoWidth ? { ...resolved, width: fittedNodeWidth(resolved) } : resolved
    })
    const edges = doc.edges.map((edge) => resolveEdge(edge, doc.defaults.edge, doc.edgeTypes ?? []))
    const layouts = new Map<string, NodeLayout>()
    const rects = new Map<string, Rect>()
    for (const node of nodes) {
      const layout = layoutNode(node)
      layouts.set(node.id, layout)
      rects.set(node.id, { x: node.x, y: node.y, width: node.width, height: layout.height })
    }
    const anchorMap = buildAnchorMap(edges, rects)
    const centered = new Set(nodes.filter((node) => node.centerAnchors).map((node) => node.id))
    const routes = new Map<string, Route>()
    for (const edge of edges) {
      const fromRect = rects.get(edge.fromId)
      const toRect = rects.get(edge.toId)
      if (!fromRect || !toRect) continue
      const fromSlot = centered.has(edge.fromId) ? { index: 0, count: 1 } : (anchorMap.get(`${edge.id}:from`) ?? { index: 0, count: 1 })
      const toSlot = centered.has(edge.toId) ? { index: 0, count: 1 } : (anchorMap.get(`${edge.id}:to`) ?? { index: 0, count: 1 })
      const from = anchorOnRect(fromRect, edge.fromSide, fromSlot.index, fromSlot.count)
      const to = anchorOnRect(toRect, edge.toSide, toSlot.index, toSlot.count)
      routes.set(edge.id, routeEdge(edge.pathStyle, from, to))
    }
    return { layouts, rects, routes, nodes, edges }
  }, [doc.nodes, doc.edges, doc.defaults, doc.nodeTypes, doc.edgeTypes, fontEpoch])
  sceneRef.current = scene

  useEffect(() => {
    let cancel = false
    const refresh = () => {
      if (cancel) return
      clearMeasureCache()
      setFontEpoch((value) => value + 1)
    }
    document.fonts.ready.then(refresh)
    document.fonts.addEventListener('loadingdone', refresh)
    return () => {
      cancel = true
      document.fonts.removeEventListener('loadingdone', refresh)
    }
  }, [])

  useLayoutEffect(() => {
    userMovedRef.current = false
    let frames = 0
    let raf = 0
    const run = () => {
      if (userMovedRef.current) return
      const group = document.getElementById(DIAGRAM_CONTENT_ID)
      const box = group instanceof SVGGraphicsElement ? group.getBBox() : null
      if ((!box || box.width < 1) && frames < 24) {
        frames += 1
        raf = requestAnimationFrame(run)
        return
      }
      fit()
    }
    run()
    return () => cancelAnimationFrame(raf)
  }, [fitToken, fit, userMovedRef])

  useEffect(() => {
    if (fontEpoch === 0 || userMovedRef.current) return
    fit()
  }, [fontEpoch, fit, userMovedRef])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect()
      viewportRef.current = { width: rect.width, height: rect.height }
      setViewport({ width: rect.width, height: rect.height })
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [svgRef, viewportRef])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = viewRef.current
      const factor = Math.exp(-event.deltaY * 0.0014)
      zoomAt(event.clientX, event.clientY, current.zoom * factor)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, zoomAt])

  interactionRef.current.cancelConnect = () => {
    if (!gesture.current || gesture.current.kind !== 'connect') {
      if (!connectDrag) return false
    }
    gesture.current = null
    setConnectDrag(null)
    setHotSide(null)
    return true
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current
      if (!current) return
      const zoom = viewRef.current.zoom
      if (current.kind === 'pan') {
        const dx = event.clientX - current.sx
        const dy = event.clientY - current.sy
        if (!current.moved && Math.hypot(dx, dy) < 3) return
        current.moved = true
        userMovedRef.current = true
        setGrabbing(true)
        setView({ panX: current.panX + dx, panY: current.panY + dy, zoom: viewRef.current.zoom })
        return
      }
      if (current.kind === 'nodes') {
        if (!current.moved && Math.hypot(event.clientX - current.sx, event.clientY - current.sy) < 3) return
        current.moved = true
        userMovedRef.current = true
        setGrabbing(true)
        let dx = (event.clientX - current.sx) / zoom
        let dy = (event.clientY - current.sy) / zoom
        const canvas = docRef.current.canvas
        const sceneNow = sceneRef.current
        if (canvas.guides !== false && sceneNow) {
          const movingIds = new Set(current.origins.map((origin) => origin.id))
          const moving = current.origins.flatMap((origin) => {
            const rect = sceneNow.rects.get(origin.id)
            if (!rect) return []
            return [{ x: origin.x + dx, y: origin.y + dy, width: rect.width, height: rect.height }]
          })
          const still = [...sceneNow.rects.entries()].filter(([id]) => !movingIds.has(id)).map(([, rect]) => rect)
          const pad = 8 / zoom
          const snap = snapToGuides(
            moving,
            still,
            canvas.guidePadding ?? 32,
            { x: (current.stickyX ? 14 : 8) / zoom, y: (current.stickyY ? 14 : 8) / zoom },
            pad,
          )
          if (snap.snappedX) dx += snap.dx
          else if (canvas.snap) dx = Math.round(dx / canvas.gridGap) * canvas.gridGap
          if (snap.snappedY) dy += snap.dy
          else if (canvas.snap) dy = Math.round(dy / canvas.gridGap) * canvas.gridGap
          current.stickyX = snap.snappedX
          current.stickyY = snap.snappedY
          setGuides(snap.guides)
        } else {
          if (canvas.snap) {
            const step = canvas.gridGap
            dx = Math.round(dx / step) * step
            dy = Math.round(dy / step) * step
          }
          setGuides([])
        }
        const origins = new Map(current.origins.map((origin) => [origin.id, origin]))
        apiRef.current.replace((doc) => ({
          ...doc,
          nodes: doc.nodes.map((node) => {
            const origin = origins.get(node.id)
            return origin ? { ...node, x: origin.x + dx, y: origin.y + dy } : node
          }),
        }))
        return
      }
      if (current.kind === 'marquee') {
        const world = clientToWorld(event.clientX, event.clientY)
        if (!current.moved && Math.hypot(event.clientX - current.sx, event.clientY - current.sy) < 3) return
        current.moved = true
        const box = normalizeBox(current.x, current.y, world.x, world.y)
        current.box = box
        setMarquee(box)
        return
      }
      if (current.kind === 'resize') {
        const canvas = docRef.current.canvas
        const centered = docRef.current.nodes.find((node) => node.id === current.id)?.heightAnchor === 'center'
        let width = current.ow + (event.clientX - current.sx) / zoom
        let height = current.oh + ((event.clientY - current.sy) / zoom) * (centered ? 2 : 1)
        if (canvas.snap) {
          const step = canvas.gridGap
          width = Math.round(width / step) * step
          height = Math.round(height / step) * step
        }
        width = Math.min(2400, Math.max(80, width))
        height = Math.min(2400, Math.max(52, height))
        const dx = Math.abs(event.clientX - current.sx)
        const dy = Math.abs(event.clientY - current.sy)
        if (!current.moved && dx < 2 && dy < 2) return
        current.moved = true
        if (dy >= 2) current.vertical = true
        apiRef.current.replace((doc) => ({
          ...doc,
          nodes: doc.nodes.map((node) => {
            if (node.id !== current.id) return node
            if (!current.vertical) return { ...node, width, autoWidth: false }
            const resolved = resolveNode({ ...node, width, autoWidth: false, height: null }, doc.defaults.node, doc.nodeTypes ?? [])
            const content = layoutNode(resolved).contentHeight
            const display = height > content + 0.5 ? height : content
            const y = node.heightAnchor === 'center' ? current.oy + (current.oh - display) / 2 : current.oy
            return { ...node, width, autoWidth: false, height: display > content + 0.5 ? display : null, y }
          }),
        }))
        return
      }
      if (current.kind !== 'connect') return
      const world = clientToWorld(event.clientX, event.clientY)
      const moved = Math.hypot(event.clientX - current.sx, event.clientY - current.sy) > 4
      current.moved = current.moved || moved
      setConnectDrag({ fromId: current.fromId, fromSide: current.fromSide, x: world.x, y: world.y })
      const sceneNow = sceneRef.current
      if (!sceneNow) return
      setHotSide(nearestSide(world, rectEntries(sceneNow.rects), zoom))
    }

    const up = (event: PointerEvent) => {
      const current = gesture.current
      gesture.current = null
      setGrabbing(false)
      setGuides([])
      if (!current) return
      if (current.kind === 'pan') {
        if (!current.moved && current.deselect) apiRef.current.select(null)
        return
      }
      if (current.kind === 'nodes' && current.moved) {
        const changed = current.origins.some((origin) => {
          const after = docRef.current.nodes.find((node) => node.id === origin.id)
          return after && (after.x !== origin.x || after.y !== origin.y)
        })
        if (changed) apiRef.current.checkpoint(current.before)
        return
      }
      if (current.kind === 'marquee') {
        setMarquee(null)
        if (!current.moved) return
        const rects = sceneRef.current?.rects
        const hit = rects ? [...rects.entries()].filter(([, rect]) => intersects(rect, current.box)).map(([id]) => id) : []
        const ids = current.additive ? [...new Set([...current.baseIds, ...hit])] : hit
        apiRef.current.select(ids.length ? { kind: 'node', ids } : null)
        return
      }
      if (current.kind === 'resize' && current.moved) {
        const before = current.before.nodes.find((node) => node.id === current.id)
        const after = docRef.current.nodes.find((node) => node.id === current.id)
        if (
          before &&
          after &&
          (before.width !== after.width || before.height !== after.height || before.y !== after.y || before.autoWidth !== after.autoWidth)
        ) {
          apiRef.current.checkpoint(current.before)
        }
        return
      }
      if (current.kind === 'connect') {
        setConnectDrag(null)
        setHotSide(null)
        if (!current.moved) return
        const world = clientToWorld(event.clientX, event.clientY)
        const sceneNow = sceneRef.current
        if (!sceneNow) return
        const hit = nearestSide(world, rectEntries(sceneNow.rects), viewRef.current.zoom)
        if (!hit) return
        const id = apiRef.current.addEdge({
          fromId: current.fromId,
          fromSide: current.fromSide,
          toId: hit.id,
          toSide: hit.side,
        })
        apiRef.current.select({ kind: 'edge', id })
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [clientToWorld, setView, userMovedRef])

  const zoom = view.zoom
  const gap = doc.canvas.gridGap
  const worldX = -view.panX / zoom
  const worldY = -view.panY / zoom
  const worldW = viewport.width / zoom
  const worldH = viewport.height / zoom

  const connectFrom = connectDrag ? scene.rects.get(connectDrag.fromId) : undefined
  const connectPreview =
    connectDrag && connectFrom
      ? previewPath(anchorOnRect(connectFrom, connectDrag.fromSide, 0, 1), { x: connectDrag.x, y: connectDrag.y })
      : null

  const selectedIds = selection?.kind === 'node' ? selection.ids : []
  const hint = connectDrag
    ? 'Release on a side anchor to connect. Press Esc to cancel.'
    : selectedIds.length > 1
      ? 'Drag to move the group. Right-drag to select. ⌘C copies, ⌘V pastes.'
      : selectedIds.length === 1
        ? 'Drag to move. Right-drag to select. Drag the corner to resize.'
        : selection?.kind === 'edge'
          ? 'Edit the relationship in the panel. Delete to remove.'
          : 'Drag to pan. Right-drag to select nodes. Scroll to zoom.'

  return (
    <div className="stage">
      <svg
        ref={svgRef}
        className={grabbing ? 'canvas grabbing' : 'canvas'}
        data-testid="canvas"
        role="application"
        aria-label="Diagram canvas"
        onPointerDown={(event) => {
          if (event.button === 1 || event.button === 2) event.preventDefault()
          if (event.button === 2) {
            const world = clientToWorld(event.clientX, event.clientY)
            gesture.current = {
              kind: 'marquee',
              sx: event.clientX,
              sy: event.clientY,
              x: world.x,
              y: world.y,
              moved: false,
              box: { x: world.x, y: world.y, width: 0, height: 0 },
              additive: event.shiftKey,
              baseIds: selection?.kind === 'node' ? selection.ids : [],
            }
            return
          }
          if (event.altKey || event.button === 1) {
            if (event.button !== 0 && event.button !== 1) return
            gesture.current = {
              kind: 'pan',
              sx: event.clientX,
              sy: event.clientY,
              panX: viewRef.current.panX,
              panY: viewRef.current.panY,
              moved: false,
              deselect: false,
            }
            return
          }
          if (event.button !== 0) return
          const target = event.target
          if (target instanceof Element && target.closest('[data-hit]')) return
          gesture.current = {
            kind: 'pan',
            sx: event.clientX,
            sy: event.clientY,
            panX: viewRef.current.panX,
            panY: viewRef.current.panY,
            moved: false,
            deselect: true,
          }
        }}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <CanvasBackdrop background={doc.canvas.background} />
        <defs>
          <pattern id="dot-grid" width={gap} height={gap} patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.75" fill={doc.canvas.gridColor} />
          </pattern>
        </defs>
        <g transform={`translate(${view.panX} ${view.panY}) scale(${zoom})`}>
          <rect
            x={worldX - gap}
            y={worldY - gap}
            width={worldW + gap * 2}
            height={worldH + gap * 2}
            fill={doc.canvas.showGrid ? 'url(#dot-grid)' : 'transparent'}
          />
          {doc.edges.map((edge) => {
            const route = scene.routes.get(edge.id)
            if (!route) return null
            return (
              <path
                key={`hit-${edge.id}`}
                data-hit="edge"
                d={route.d}
                fill="none"
                stroke="transparent"
                strokeWidth={18 / zoom}
                style={{ cursor: 'pointer' }}
                data-edge-id={edge.id}
                onPointerDown={(event) => {
                  if (event.button !== 0 || event.altKey) return
                  event.stopPropagation()
                  api.select({ kind: 'edge', id: edge.id })
                }}
              />
            )
          })}
          {selection?.kind === 'edge'
            ? (() => {
                const edge = scene.edges.find((item) => item.id === selection.id)
                const route = edge ? scene.routes.get(edge.id) : undefined
                if (!edge || !route) return null
                return (
                  <path
                    d={strokePath(edge, route.d)}
                    fill="none"
                    stroke="#9ec1ff"
                    strokeWidth={edge.strokeWidth + 3}
                    strokeDasharray={dashArray(edge.lineStyle, edge.strokeWidth)}
                    strokeLinecap={edge.lineStyle === 'dotted' ? 'round' : 'butt'}
                    pointerEvents="none"
                  />
                )
              })()
            : null}
          <g id={DIAGRAM_CONTENT_ID}>
            <EdgeMarkers edges={scene.edges} />
            {scene.edges.map((edge) => {
              const route = scene.routes.get(edge.id)
              if (!route) return null
              return <EdgePath key={edge.id} edge={edge} d={strokePath(edge, route.d)} />
            })}
            {scene.nodes.map((node) => {
              const layout = scene.layouts.get(node.id)
              if (!layout) return null
              return (
                <NodeShape
                  key={node.id}
                  node={node}
                  icons={doc.icons}
                  layout={layout}
                  onPointerEnter={() => setHoverNode(node.id)}
                  onPointerLeave={() => setHoverNode((current) => (current === node.id ? null : current))}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || event.altKey) return
                    event.stopPropagation()
                    api.endCoalesce()
                    const currentIds = selection?.kind === 'node' ? selection.ids : []
                    if (event.shiftKey) {
                      const next = currentIds.includes(node.id) ? currentIds.filter((id) => id !== node.id) : [...currentIds, node.id]
                      api.select(next.length ? { kind: 'node', ids: next } : null)
                      return
                    }
                    const ids = currentIds.includes(node.id) ? currentIds : [node.id]
                    api.select({ kind: 'node', ids })
                    const origins = ids.flatMap((id) => {
                      const item = doc.nodes.find((candidate) => candidate.id === id)
                      return item ? [{ id, x: item.x, y: item.y }] : []
                    })
                    gesture.current = {
                      kind: 'nodes',
                      origins,
                      sx: event.clientX,
                      sy: event.clientY,
                      moved: false,
                      before: docRef.current,
                      stickyX: false,
                      stickyY: false,
                    }
                  }}
                />
              )
            })}
          </g>
          {selectedIds.map((id) => {
            const node = scene.nodes.find((item) => item.id === id)
            const layout = node ? scene.layouts.get(node.id) : undefined
            if (!node || !layout) return null
            const pad = 4 / zoom
            return (
              <rect
                key={id}
                x={node.x - pad}
                y={node.y - pad}
                width={layout.width + pad * 2}
                height={layout.height + pad * 2}
                rx={node.radius + pad}
                fill="none"
                stroke="#9ec1ff"
                strokeWidth={1.25 / zoom}
                pointerEvents="none"
              />
            )
          })}
          {doc.nodes.map((node) => {
            const layout = scene.layouts.get(node.id)
            if (!layout) return null
            const visible = connectDrag || hoverNode === node.id || (selectedIds.length === 1 && selectedIds[0] === node.id)
            if (!visible) return null
            const rect = scene.rects.get(node.id)
            if (!rect) return null
            return SIDES.map((side) => {
              const anchor = anchorOnRect(rect, side, 0, 1)
              const hot = hotSide?.id === node.id && hotSide.side === side
              const source = connectDrag?.fromId === node.id && connectDrag.fromSide === side
              const radius = (hot || source ? 6.5 : 4.5) / zoom
              return (
                <g
                  key={`${node.id}-${side}`}
                  data-hit="anchor"
                  style={{ cursor: 'crosshair' }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || event.altKey) return
                    event.stopPropagation()
                    api.endCoalesce()
                    const world = clientToWorld(event.clientX, event.clientY)
                    gesture.current = {
                      kind: 'connect',
                      fromId: node.id,
                      fromSide: side,
                      sx: event.clientX,
                      sy: event.clientY,
                      moved: false,
                    }
                    setConnectDrag({ fromId: node.id, fromSide: side, x: world.x, y: world.y })
                  }}
                >
                  <circle cx={anchor.point.x} cy={anchor.point.y} r={14 / zoom} fill="transparent" />
                  <circle
                    cx={anchor.point.x}
                    cy={anchor.point.y}
                    r={radius}
                    fill={hot || source ? '#9ec1ff' : '#f3f3f3'}
                    stroke="#1a1a1a"
                    strokeWidth={1.2 / zoom}
                    pointerEvents="none"
                  />
                </g>
              )
            })
          })}
          {connectPreview ? (
            <path d={connectPreview} fill="none" stroke="#f2f2f2" strokeWidth={1.4 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} pointerEvents="none" />
          ) : null}
          {guides.map((guide, index) => (
            <line
              key={`${guide.kind}-${index}`}
              data-guide={guide.kind}
              x1={guide.x1}
              y1={guide.y1}
              x2={guide.x2}
              y2={guide.y2}
              stroke="#3c7dff"
              strokeWidth={1 / zoom}
              pointerEvents="none"
            />
          ))}
          {marquee && marquee.width + marquee.height > 0 ? (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(158, 193, 255, 0.12)"
              stroke="#9ec1ff"
              strokeWidth={1 / zoom}
              pointerEvents="none"
            />
          ) : null}
          {selectedIds.length === 1
            ? (() => {
                const node = doc.nodes.find((item) => item.id === selectedIds[0])
                const layout = node ? scene.layouts.get(node.id) : undefined
                if (!node || !layout) return null
                const size = 8 / zoom
                return (
                  <rect
                    data-hit="resize"
                    x={node.x + layout.width - size}
                    y={node.y + layout.height - size}
                    width={size}
                    height={size}
                    rx={1.5 / zoom}
                    fill="#f4f4f4"
                    stroke="#1a1a1a"
                    strokeWidth={1 / zoom}
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || event.altKey) return
                      event.stopPropagation()
                      api.endCoalesce()
                      gesture.current = {
                        kind: 'resize',
                        id: node.id,
                        sx: event.clientX,
                        sy: event.clientY,
                        ow: layout.width,
                        oh: layout.height,
                        oy: node.y,
                        vertical: false,
                        moved: false,
                        before: docRef.current,
                      }
                    }}
                  />
                )
              })()
            : null}
        </g>
      </svg>
      <div className="status">
        <span>{hint}</span>
        <div className="zoom-controls">
          <button
            type="button"
            onClick={() => {
              const rect = svgRef.current?.getBoundingClientRect()
              if (!rect) return
              zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.zoom / 1.15)
            }}
            aria-label="Zoom out"
          >
            −
          </button>
          <span>{Math.round(view.zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => {
              const rect = svgRef.current?.getBoundingClientRect()
              if (!rect) return
              zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.zoom * 1.15)
            }}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

function CanvasBackdrop({ background }: { background: CanvasBackground }) {
  const vector = background.kind === 'gradient' ? gradientVector(background.angle) : null
  const fill =
    background.kind === 'solid'
      ? background.color
      : background.kind === 'gradient'
        ? 'url(#canvas-gradient)'
        : 'url(#canvas-checker)'
  return (
    <>
      <defs>
        <pattern id="canvas-checker" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#121212" />
          <rect width="8" height="8" fill="#1c1c1c" />
          <rect x="8" y="8" width="8" height="8" fill="#1c1c1c" />
        </pattern>
        {background.kind === 'gradient' && vector ? (
          <linearGradient
            id="canvas-gradient"
            gradientUnits="objectBoundingBox"
            x1={vector.x1}
            y1={vector.y1}
            x2={vector.x2}
            y2={vector.y2}
          >
            <stop offset="0%" stopColor={background.from} />
            <stop offset="100%" stopColor={background.to} />
          </linearGradient>
        ) : null}
      </defs>
      <rect width="100%" height="100%" fill={fill} />
    </>
  )
}
