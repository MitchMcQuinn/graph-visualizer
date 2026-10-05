import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic'
import type { CustomIcon } from './types'

export const COMMON_ICONS: IconName[] = [
  'user',
  'users',
  'building-2',
  'phone',
  'mail',
  'globe',
  'database',
  'shield',
  'flag',
  'map-pin',
  'megaphone',
  'briefcase',
  'layers',
  'tag',
  'workflow',
  'box',
  'star',
  'heart',
]

const lucideNames = new Set<string>(iconNames)

export function isLucideName(name: string): name is IconName {
  return lucideNames.has(name)
}

export function lucideIconName(icon: string): IconName | null {
  if (!icon.startsWith('lucide:')) return null
  const name = icon.slice('lucide:'.length)
  return isLucideName(name) ? name : null
}

export function searchLucideIcons(query: string): IconName[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return COMMON_ICONS
  const matches: IconName[] = []
  for (const name of iconNames) {
    if (!name.includes(needle)) continue
    matches.push(name)
    if (matches.length >= 60) break
  }
  return matches
}

export function iconLabel(name: string) {
  return name.replace(/-/g, ' ')
}

export function DiagramIcon({
  icon,
  icons,
  x,
  y,
  size,
  color,
  maskId,
}: {
  icon: string
  icons: CustomIcon[]
  x: number
  y: number
  size: number
  color: string
  maskId: string
}) {
  if (icon.startsWith('custom:')) {
    const found = icons.find((item) => item.id === icon.slice('custom:'.length))
    if (!found) return null
    return (
      <g transform={`translate(${x} ${y})`} pointerEvents="none">
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={size}
          height={size}
          style={{ maskType: 'alpha' }}
        >
          <image href={found.href} x="0" y="0" width={size} height={size} preserveAspectRatio="xMidYMid meet" />
        </mask>
        <rect width={size} height={size} fill={color} mask={`url(#${maskId})`} />
      </g>
    )
  }
  const name = lucideIconName(icon)
  if (!name) return null
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <DynamicIcon name={name} size={size} color={color} stroke={color} strokeWidth={1.75} />
    </g>
  )
}
