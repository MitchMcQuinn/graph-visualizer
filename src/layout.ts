import { fontFamily } from './fonts'
import type { ResolvedNode } from './style'
import { fontSpec, measureWidth, wrapText } from './text'
import type { TableBorders, TableData, TableDensity, TextAlign } from './types'

export const PAD_X = 16
export const PAD_Y = 13

export type TextAnchor = 'start' | 'middle' | 'end'

export type TextRun = {
  text: string
  x: number
  y: number
  anchor: TextAnchor
  weight: number
  size: number
  color: 'title' | 'text' | 'header'
}

export type TableLayout = {
  x: number
  y: number
  width: number
  height: number
  verticals: number[]
  rows: {
    y: number
    height: number
    ruleY: number | null
    fill: string | null
    fillOpacity: number
    cells: TextRun[][]
  }[]
}

export type NodeLayout = {
  width: number
  height: number
  contentHeight: number
  icon?: { x: number; y: number; size: number }
  title: TextRun[]
  description: TextRun[]
  table: TableLayout | null
}

function columnCount(table: TableData) {
  return Math.max(1, ...table.rows.map((row) => row.length))
}

function tableInnerWidth(table: TableData, textSize: number, family: string, headerWeight: number, density: TableDensity) {
  const cols = columnCount(table)
  const compact = density === 'compact'
  const gap = cols > 1 ? (compact ? 8 : 10) : 0
  const pad = 4
  const font = fontSpec(400, textSize, family)
  const headerFont = fontSpec(headerWeight, textSize, family)
  const natural = Array.from({ length: cols }, () => 16)
  table.rows.forEach((row, rowIndex) => {
    for (let column = 0; column < cols; column += 1) {
      const text = row[column] ?? ''
      const weightFont = table.hasHeader && rowIndex === 0 ? headerFont : font
      natural[column] = Math.max(natural[column], measureWidth(text, weightFont) + pad * 2)
    }
  })
  return natural.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, cols - 1)
}

export function fittedNodeWidth(node: ResolvedNode) {
  const family = fontFamily(node.font)
  const titleFont = fontSpec(node.titleWeight, node.titleSize, family)
  const bodyFont = fontSpec(400, node.textSize, family)
  let inner = 0
  const showIcon = node.showIcon && node.icon.length > 0
  const title = node.showTitle ? node.title.trim().replace(/\s+/g, ' ') : ''
  const iconPlace = node.iconAlign === 'with-text' ? node.align : node.iconAlign
  const beside = showIcon && title.length > 0 && iconPlace !== 'center' && node.align !== 'center'
  if (beside) inner = Math.max(inner, measureWidth(title, titleFont) + node.iconSize + 8)
  else {
    if (showIcon) inner = Math.max(inner, node.iconSize)
    if (title) inner = Math.max(inner, measureWidth(title, titleFont))
  }
  if (node.showDescription && node.description.trim()) {
    inner = Math.max(inner, measureWidth(node.description.trim().replace(/\s+/g, ' '), bodyFont))
  }
  if (node.showTable && node.table.rows.length > 0) {
    inner = Math.max(inner, tableInnerWidth(node.table, node.textSize, family, node.titleWeight, node.tableDensity))
  }
  return Math.ceil(Math.max(inner, 48) + PAD_X * 2)
}

function cell(text: string, x: number, y: number, anchor: TextAnchor, weight: number, size: number, color: TextRun['color']): TextRun {
  return { text, x, y, anchor, weight, size, color }
}

function textAnchor(align: TextAlign): TextAnchor {
  if (align === 'center') return 'middle'
  if (align === 'right') return 'end'
  return 'start'
}

function layoutTable(
  table: TableData,
  options: {
    x: number
    y: number
    maxWidth: number
    textSize: number
    family: string
    align: TextAnchor
    borders: TableBorders
    density: TableDensity
    headerFill: string
    headerOpacity: number
    stripe: boolean
    stripeFill: string
    stripeOpacity: number
    headerWeight: number
  },
): TableLayout | null {
  if (!table.rows.length) return null
  const cols = columnCount(table)
  const size = options.textSize
  const compact = options.density === 'compact'
  const lineHeight = size * (compact ? 1.18 : 1.38)
  const gap = cols > 1 ? (compact ? 8 : 10) : 0
  const pad = 4
  const font = fontSpec(400, size, options.family)
  const headerFont = fontSpec(options.headerWeight, size, options.family)

  const natural = Array.from({ length: cols }, () => 16)
  table.rows.forEach((row, rowIndex) => {
    for (let c = 0; c < cols; c++) {
      const text = row[c] ?? ''
      const weightFont = table.hasHeader && rowIndex === 0 ? headerFont : font
      natural[c] = Math.max(natural[c], measureWidth(text, weightFont) + pad * 2)
    }
  })

  let colWidths = natural.slice()
  const gaps = gap * Math.max(0, cols - 1)
  const naturalTotal = colWidths.reduce((sum, width) => sum + width, 0) + gaps
  const target = options.maxWidth
  if (naturalTotal > target) {
    const room = Math.max(cols * 24, target - gaps)
    const scale = room / colWidths.reduce((sum, width) => sum + width, 0)
    colWidths = colWidths.map((width) => Math.max(24, width * scale))
  }
  const width = options.maxWidth
  const extra = width - gaps - colWidths.reduce((sum, w) => sum + w, 0)
  const share = extra / cols
  colWidths = colWidths.map((w) => w + share)

  const colX: number[] = []
  let cursor = 0
  for (const colWidth of colWidths) {
    colX.push(cursor)
    cursor += colWidth + gap
  }

  const ruledKind = options.borders === 'rows' || options.borders === 'grid'
  const rows: TableLayout['rows'] = []
  let y = 0
  table.rows.forEach((row, rowIndex) => {
    const header = table.hasHeader && rowIndex === 0
    const wrapped = Array.from({ length: cols }, (_, c) => {
      const text = (row[c] ?? '').trim()
      const lines = wrapText(text, header ? headerFont : font, Math.max(8, colWidths[c] - pad * 2))
      return lines.length ? lines : text ? [text] : ['']
    })
    const lineCount = Math.max(1, ...wrapped.map((lines) => (lines.filter(Boolean).length ? lines.length : 1)))
    const height = lineCount * lineHeight
    const last = rowIndex === table.rows.length - 1
    const ruled = !last && ruledKind
    const cells = wrapped.map((lines, c) => {
      const visible = lines.filter((line) => line.length > 0)
      const drawn = visible.length ? visible : ['']
      const anchor = options.align
      const x =
        anchor === 'middle'
          ? colX[c] + colWidths[c] / 2
          : anchor === 'end'
            ? colX[c] + colWidths[c] - pad
            : colX[c] + pad
      return drawn.map((line, lineIndex) =>
        cell(line, x, lineIndex * lineHeight, anchor, header ? options.headerWeight : 400, size, header ? 'header' : 'text'),
      )
    })
    let fill: string | null = null
    let fillOpacity = 0
    if (header && options.headerOpacity > 0) {
      fill = options.headerFill
      fillOpacity = options.headerOpacity
    } else if (!header && options.stripe && options.stripeOpacity > 0) {
      const bodyIndex = table.hasHeader ? rowIndex - 1 : rowIndex
      if (bodyIndex % 2 === 1) {
        fill = options.stripeFill
        fillOpacity = options.stripeOpacity
      }
    }
    rows.push({
      y,
      height,
      ruleY: ruled ? y + height + 1 : null,
      fill,
      fillOpacity,
      cells,
    })
    const between = last ? 0 : ruled ? (compact ? 5 : 8) : compact ? 1 : 3
    y += height + between
  })

  const verticals =
    options.borders === 'grid' && cols > 1 ? colX.slice(1).map((x) => x - gap / 2) : []

  return {
    x: options.x,
    y: options.y,
    width,
    height: y,
    verticals,
    rows,
  }
}

export function layoutNode(node: ResolvedNode): NodeLayout {
  const family = fontFamily(node.font)
  const innerW = Math.max(24, node.width - PAD_X * 2)
  const titleSize = node.titleSize
  const textSize = node.textSize
  const titleLH = titleSize * 1.28
  const textLH = textSize * 1.38
  const anchor = textAnchor(node.align)
  const left = PAD_X
  const right = node.width - PAD_X
  const anchorX = anchor === 'middle' ? node.width / 2 : anchor === 'end' ? right : left
  let cursor = PAD_Y
  let used = false
  const gap = (amount: number) => {
    if (used) cursor += amount
  }

  const showIcon = node.showIcon && node.icon.length > 0
  const titleSource = node.showTitle ? node.title.trim() : ''
  let icon: NodeLayout['icon']
  const title: TextRun[] = []
  const titleFont = fontSpec(node.titleWeight, titleSize, family)
  const iconSize = node.iconSize
  const iconPlace = node.iconAlign === 'with-text' ? node.align : node.iconAlign
  const iconXFor = (place: typeof node.align) => {
    if (place === 'center') return (node.width - iconSize) / 2
    if (place === 'right') return right - iconSize
    return left
  }

  if (showIcon || titleSource) {
    const beside = showIcon && titleSource && iconPlace !== 'center' && node.align !== 'center'
    if (beside) {
      const iconGap = 8
      const iconSpace = iconSize + iconGap
      const lines = wrapText(titleSource, titleFont, Math.max(8, innerW - iconSpace))
      const textBlock = Math.max(titleLH, lines.length * titleLH)
      const rowH = Math.max(iconSize, textBlock)
      const iconY = cursor + (rowH - iconSize) / 2
      const textTop = cursor + (lines.length <= 1 ? (rowH - textBlock) / 2 : 0)
      if (iconPlace === node.align && node.align === 'right') {
        const widest = lines.reduce((max, line) => Math.max(max, measureWidth(line, titleFont)), 0)
        icon = { x: right - widest - iconSpace, y: iconY, size: iconSize }
      } else {
        icon = { x: iconXFor(iconPlace), y: iconY, size: iconSize }
      }
      const runAnchor = node.align === 'right' ? 'end' : 'start'
      const textX = iconPlace === 'left' && node.align === 'left' ? left + iconSpace : node.align === 'right' ? right : left
      lines.forEach((line, index) => {
        title.push(cell(line, textX, textTop + index * titleLH, runAnchor, node.titleWeight, titleSize, 'title'))
      })
      cursor += rowH
    } else if (showIcon) {
      icon = { x: iconXFor(iconPlace), y: cursor + 1, size: iconSize }
      cursor += iconSize
      if (titleSource) {
        cursor += 6
        const lines = wrapText(titleSource, titleFont, innerW)
        lines.forEach((line, index) => {
          title.push(cell(line, anchorX, cursor + index * titleLH, anchor, node.titleWeight, titleSize, 'title'))
        })
        cursor += lines.length * titleLH
      }
    } else {
      const lines = wrapText(titleSource, titleFont, innerW)
      lines.forEach((line, index) => {
        title.push(cell(line, anchorX, cursor + index * titleLH, anchor, node.titleWeight, titleSize, 'title'))
      })
      cursor += lines.length * titleLH
    }
    used = true
  }

  const description: TextRun[] = []
  if (node.showDescription && node.description.trim()) {
    gap(6)
    const bodyFont = fontSpec(400, textSize, family)
    const lines = wrapText(node.description.trim(), bodyFont, innerW)
    lines.forEach((line, index) => {
      description.push(cell(line, anchorX, cursor + index * textLH, anchor, 400, textSize, 'text'))
    })
    cursor += lines.length * textLH
    used = true
  }

  let table: TableLayout | null = null
  if (node.showTable && node.table.rows.length > 0) {
    gap(8)
    table = layoutTable(node.table, {
      x: PAD_X,
      y: cursor,
      maxWidth: innerW,
      textSize,
      family,
      align: anchor,
      borders: node.tableBorders,
      density: node.tableDensity,
      headerFill: node.tableHeaderFill,
      headerOpacity: node.tableHeaderOpacity,
      stripe: node.tableStripe,
      stripeFill: node.tableStripeFill,
      stripeOpacity: node.tableStripeOpacity,
      headerWeight: node.titleWeight,
    })
    if (table) {
      cursor += table.height
      used = true
    }
  }

  let contentHeight = Math.max(52, (used ? cursor : PAD_Y) + PAD_Y)
  if (icon && node.iconOffset !== 0) {
    icon.y += node.iconOffset
    contentHeight = Math.max(contentHeight, icon.y + icon.size + PAD_Y)
  }
  const height = node.height == null ? contentHeight : Math.max(contentHeight, node.height)

  return { width: node.width, height, contentHeight, icon, title, description, table }
}
