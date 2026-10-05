import { coerceDoc, uid } from './model'
import type { Doc } from './types'

const VIEWS_KEY = 'graph-visualizer-views-v1'

export type SavedView = {
  id: string
  name: string
  savedAt: number
  doc: Doc
}

export function listViews(): SavedView[] {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    const views: SavedView[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const doc = coerceDoc(record.doc)
      if (!doc || typeof record.id !== 'string') continue
      views.push({
        id: record.id,
        name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Untitled',
        savedAt: typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
        doc,
      })
    }
    return views
  } catch {
    return []
  }
}

function writeViews(views: SavedView[]) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views.slice(0, 30)))
}

export function saveNamedView(name: string, doc: Doc): string | null {
  const view: SavedView = {
    id: uid('v'),
    name: name.trim() || 'Untitled',
    savedAt: Date.now(),
    doc: structuredClone(doc),
  }
  try {
    writeViews([view, ...listViews()])
    return null
  } catch {
    return 'Could not save this view. It may be too large for browser storage.'
  }
}

export function deleteNamedView(id: string) {
  try {
    writeViews(listViews().filter((view) => view.id !== id))
    return null
  } catch {
    return 'Could not update saved views.'
  }
}

export function downloadDoc(doc: Doc, filename: string) {
  const payload = { kind: 'graph-visualizer', version: 1, doc }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function readDocFile(file: File): Promise<Doc> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON')
  }
  const doc = coerceDoc(parsed)
  if (!doc) throw new Error('That file is not a graph view')
  return doc
}

export function viewFileName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'graph'}.json`
}
