const cache = new Map<string, number>()
let context: CanvasRenderingContext2D | null = null

function ctx() {
  if (context) return context
  const canvas = document.createElement('canvas')
  context = canvas.getContext('2d')
  return context
}

export function clearMeasureCache() {
  cache.clear()
}

export function fontSpec(weight: number, size: number, family = 'Inter, system-ui, sans-serif') {
  return `${weight} ${size}px ${family}`
}

export function measureWidth(text: string, font: string) {
  const key = `${font}\n${text}`
  const hit = cache.get(key)
  if (hit != null) return hit
  const drawing = ctx()
  let width = text.length * 8
  if (drawing) {
    drawing.font = font
    width = drawing.measureText(text).width
  }
  cache.set(key, width)
  return width
}

export function wrapText(text: string, font: string, maxWidth: number) {
  const source = text.replace(/\s+/g, ' ').trim()
  if (!source) return []
  if (maxWidth <= 8) return [source]
  const words = source.split(' ')
  const lines: string[] = []
  let current = ''

  const pushHard = (word: string) => {
    let chunk = ''
    for (const char of word) {
      const next = chunk + char
      if (chunk && measureWidth(next, font) > maxWidth) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk = next
      }
    }
    return chunk
  }

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (measureWidth(trial, font) <= maxWidth) {
      current = trial
      continue
    }
    if (current) lines.push(current)
    if (measureWidth(word, font) > maxWidth) current = pushHard(word)
    else current = word
  }
  if (current) lines.push(current)
  return lines
}
