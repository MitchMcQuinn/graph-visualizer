import type { FontId } from './types'

export const FONT_OPTIONS: { id: FontId; label: string; family: string; face: string | null }[] = [
  { id: 'inter', label: 'Inter', family: 'Inter, system-ui, sans-serif', face: 'Inter' },
  { id: 'source-serif', label: 'Source Serif', family: '"Source Serif 4", Georgia, serif', face: 'Source Serif 4' },
  { id: 'newsreader', label: 'Newsreader', family: 'Newsreader, Georgia, serif', face: 'Newsreader' },
  { id: 'plex-mono', label: 'IBM Plex Mono', family: '"IBM Plex Mono", ui-monospace, monospace', face: 'IBM Plex Mono' },
  { id: 'system', label: 'System', family: 'system-ui, sans-serif', face: null },
]

const byId = new Map(FONT_OPTIONS.map((font) => [font.id, font]))

export function fontOption(id: FontId) {
  return byId.get(id) ?? FONT_OPTIONS[0]
}

export function fontFamily(id: FontId) {
  return fontOption(id).family
}

export function fontFaceName(id: FontId) {
  return fontOption(id).face
}
