import { useMemo, useRef, useState } from 'react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { iconLabel, lucideIconName, searchLucideIcons } from '../icons'
import { uid } from '../model'
import { useDoc } from '../store'
import type { NodeModel } from '../types'

export function IconPicker({ node }: { node: NodeModel }) {
  const { doc, updateNode, addIcon, removeIcon } = useDoc()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchLucideIcons(query), [query])
  const currentLucide = lucideIconName(node.icon)
  const currentCustom = node.icon.startsWith('custom:')
    ? doc.icons.find((icon) => icon.id === node.icon.slice('custom:'.length))
    : undefined
  const triggerLabel = currentCustom?.name ?? (currentLucide ? iconLabel(currentLucide) : 'None')

  const choose = (icon: string) => {
    updateNode(node.id, { icon, showIcon: icon.length > 0 })
    setOpen(false)
  }

  const upload = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    const svg = file.name.toLowerCase().endsWith('.svg')
    const image = file.type.startsWith('image/') || svg
    if (!image) {
      setError('Use an SVG, PNG, or WebP file.')
      return
    }
    if (file.size > 250_000) {
      setError('Icons need to be under 250 KB.')
      return
    }
    const href = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('Could not read that file'))
      reader.readAsDataURL(file)
    }).catch(() => '')
    if (!href.startsWith('data:image/') && !(svg && href.startsWith('data:'))) {
      setError('Could not read that image.')
      return
    }
    if (href.length > 350_000) {
      setError('That image is too large to store.')
      return
    }
    const id = uid('i')
    const name = file.name.replace(/\.[^.]+$/, '') || 'Icon'
    addIcon({ id, name, href: href.startsWith('data:image/') ? href : href.replace(/^data:[^;,]*/, 'data:image/svg+xml') })
    choose(`custom:${id}`)
  }

  return (
    <div className="field">
      <span>Icon</span>
      <button type="button" className="icon-trigger" onClick={() => setOpen((value) => !value)}>
        {currentLucide ? <DynamicIcon name={currentLucide} size={16} strokeWidth={1.75} /> : null}
        {currentCustom ? <img src={currentCustom.href} alt="" width={16} height={16} /> : null}
        {triggerLabel}
      </button>
      {open ? (
        <div className="icon-picker">
          <input
            data-testid="icon-search"
            type="text"
            value={query}
            placeholder="Search Lucide icons"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="row-actions">
            <button type="button" onClick={() => choose('')}>
              None
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/svg+xml,image/png,image/webp,image/jpeg,.svg"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void upload(file)
              }}
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="hint icon-caption">{query.trim() ? 'Lucide' : 'Common Lucide icons'}</div>
          <div className="icon-grid icon-scroll">
            {results.map((name) => (
              <button
                key={name}
                type="button"
                title={iconLabel(name)}
                aria-label={iconLabel(name)}
                aria-pressed={node.icon === `lucide:${name}`}
                onClick={() => choose(`lucide:${name}`)}
              >
                <DynamicIcon name={name} size={16} strokeWidth={1.75} />
              </button>
            ))}
          </div>
          {results.length === 0 ? <p className="hint">No Lucide icons match that search.</p> : null}
          {doc.icons.length > 0 ? (
            <>
              <div className="hint icon-caption">Your icons</div>
              <div className="custom-icons">
                {doc.icons.map((icon) => (
                  <div key={icon.id} className="view-row">
                    <button
                      type="button"
                      className="icon-trigger"
                      aria-pressed={node.icon === `custom:${icon.id}`}
                      onClick={() => choose(`custom:${icon.id}`)}
                    >
                      <img src={icon.href} alt="" width={16} height={16} />
                      {icon.name}
                    </button>
                    <button type="button" onClick={() => removeIcon(icon.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
