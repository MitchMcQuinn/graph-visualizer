import { gradientVector } from './background'
import { DIAGRAM_CONTENT_ID, LATIN_EXT_RANGE, LATIN_RANGE } from './constants'
import { fontFaceName } from './fonts'
import { fontsInUse } from './style'
import type { CanvasBackground, Doc, FontId } from './types'

const MAX_DIMENSION = 8192

type FontFile = () => Promise<{ default: string }>

const fontFiles: Record<string, FontFile> = {
  'inter-400': () => import('@fontsource/inter/files/inter-latin-400-normal.woff2?url'),
  'inter-400-ext': () => import('@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url'),
  'inter-600': () => import('@fontsource/inter/files/inter-latin-600-normal.woff2?url'),
  'inter-600-ext': () => import('@fontsource/inter/files/inter-latin-ext-600-normal.woff2?url'),
  'inter-700': () => import('@fontsource/inter/files/inter-latin-700-normal.woff2?url'),
  'inter-700-ext': () => import('@fontsource/inter/files/inter-latin-ext-700-normal.woff2?url'),
  'source-serif-400': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2?url'),
  'source-serif-400-ext': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-ext-400-normal.woff2?url'),
  'source-serif-600': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2?url'),
  'source-serif-600-ext': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-ext-600-normal.woff2?url'),
  'source-serif-700': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2?url'),
  'source-serif-700-ext': () => import('@fontsource/source-serif-4/files/source-serif-4-latin-ext-700-normal.woff2?url'),
  'newsreader-400': () => import('@fontsource/newsreader/files/newsreader-latin-400-normal.woff2?url'),
  'newsreader-400-ext': () => import('@fontsource/newsreader/files/newsreader-latin-ext-400-normal.woff2?url'),
  'newsreader-600': () => import('@fontsource/newsreader/files/newsreader-latin-600-normal.woff2?url'),
  'newsreader-600-ext': () => import('@fontsource/newsreader/files/newsreader-latin-ext-600-normal.woff2?url'),
  'newsreader-700': () => import('@fontsource/newsreader/files/newsreader-latin-700-normal.woff2?url'),
  'newsreader-700-ext': () => import('@fontsource/newsreader/files/newsreader-latin-ext-700-normal.woff2?url'),
  'plex-mono-400': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'),
  'plex-mono-400-ext': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff2?url'),
  'plex-mono-600': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url'),
  'plex-mono-600-ext': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-600-normal.woff2?url'),
  'plex-mono-700': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2?url'),
  'plex-mono-700-ext': () => import('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-700-normal.woff2?url'),
}

const embedded = new Map<string, Promise<string>>()

async function fontDataUrl(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load fonts for export')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return `data:font/woff2;base64,${btoa(binary)}`
}

function face(family: string, weight: number, range: string, dataUrl: string) {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url('${dataUrl}') format('woff2');unicode-range:${range};}`
}

async function embedFace(id: FontId, weight: number) {
  const family = fontFaceName(id)
  if (!family) return ''
  const key = `${id}-${weight}`
  const cached = embedded.get(key)
  if (cached) return cached
  const pending = (async () => {
    const latin = fontFiles[`${id}-${weight}`]
    const ext = fontFiles[`${id}-${weight}-ext`]
    if (!latin || !ext) return ''
    const [latinFile, extFile] = await Promise.all([latin(), ext()])
    const [latinUrl, extUrl] = await Promise.all([fontDataUrl(latinFile.default), fontDataUrl(extFile.default)])
    return face(family, weight, LATIN_RANGE, latinUrl) + face(family, weight, LATIN_EXT_RANGE, extUrl)
  })()
  embedded.set(key, pending)
  return pending
}

async function fontCss(doc: Doc) {
  const used = fontsInUse(doc)
  const weights = used.bold ? [400, 600, 700] : [400, 600]
  const faces = await Promise.all(
    used.ids.filter((id) => fontFaceName(id)).flatMap((id) => weights.map((weight) => embedFace(id, weight))),
  )
  return faces.join('')
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function appendBackground(svg: SVGSVGElement, background: CanvasBackground, x: number, y: number, width: number, height: number) {
  if (background.kind === 'transparent') return
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(width))
  rect.setAttribute('height', String(height))
  if (background.kind === 'solid') {
    rect.setAttribute('fill', background.color)
    svg.append(rect)
    return
  }
  const vector = gradientVector(background.angle)
  const defs = document.createElementNS(SVG_NS, 'defs')
  const gradient = document.createElementNS(SVG_NS, 'linearGradient')
  gradient.setAttribute('id', 'export-background')
  gradient.setAttribute('gradientUnits', 'objectBoundingBox')
  gradient.setAttribute('x1', String(vector.x1))
  gradient.setAttribute('y1', String(vector.y1))
  gradient.setAttribute('x2', String(vector.x2))
  gradient.setAttribute('y2', String(vector.y2))
  const start = document.createElementNS(SVG_NS, 'stop')
  start.setAttribute('offset', '0%')
  start.setAttribute('stop-color', background.from)
  const end = document.createElementNS(SVG_NS, 'stop')
  end.setAttribute('offset', '100%')
  end.setAttribute('stop-color', background.to)
  gradient.append(start, end)
  defs.append(gradient)
  rect.setAttribute('fill', 'url(#export-background)')
  svg.append(defs, rect)
}

async function buildExportSvg(doc: Doc) {
  await document.fonts.ready
  const source = document.getElementById(DIAGRAM_CONTENT_ID)
  if (!(source instanceof SVGGraphicsElement)) throw new Error('Diagram is not ready to export')
  const box = source.getBBox()
  if (box.width < 1 || box.height < 1) throw new Error('Add a node before exporting')

  const padding = Math.max(0, doc.exportSettings.padding)
  const x = box.x - padding
  const y = box.y - padding
  const width = box.width + padding * 2
  const height = box.height + padding * 2
  const css = await fontCss(doc)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('xmlns', SVG_NS)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`)
  const style = document.createElementNS(SVG_NS, 'style')
  style.textContent = css
  svg.append(style)
  appendBackground(svg, doc.canvas.background, x, y, width, height)
  svg.append(source.cloneNode(true))
  return { svg, width, height }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function serializeSvg(svg: SVGSVGElement) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
}

export async function exportDiagramSvg(doc: Doc) {
  const { svg } = await buildExportSvg(doc)
  downloadBlob(new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg')
}

export async function exportDiagramPng(doc: Doc) {
  const { svg, width, height } = await buildExportSvg(doc)
  const scale = doc.exportSettings.scale
  if (width * scale > MAX_DIMENSION || height * scale > MAX_DIMENSION) {
    throw new Error('That export is too large. Lower the resolution or the padding.')
  }

  const blob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render the PNG'))
    })
    image.src = url
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create the PNG')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('Could not create the PNG')
    downloadBlob(png, 'diagram.png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
