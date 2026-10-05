import type { ReactNode } from 'react'
import type { Side } from '../types'

function ResetButton({ onReset }: { onReset?: () => void }) {
  if (!onReset) return null
  return (
    <button type="button" className="linkish" onClick={onReset}>
      Default
    </button>
  )
}

export function Field({ label, children, onReset }: { label: string; children: ReactNode; onReset?: () => void }) {
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        <ResetButton onReset={onReset} />
      </div>
      {children}
    </div>
  )
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onDone,
  format,
  onReset,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  onDone: () => void
  format?: (value: number) => string
  onReset?: () => void
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        <span className="field-meta">
          <ResetButton onReset={onReset} />
          <span className="value">{format ? format(value) : value}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onDone}
        onBlur={onDone}
      />
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  onDone,
  onReset,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onDone: () => void
  onReset?: () => void
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        <ResetButton onReset={onReset} />
      </div>
      <div className="color-row">
        <input
          type="color"
          value={hex}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onDone}
        />
        <input
          type="text"
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onDone}
        />
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  onReset,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  onReset?: () => void
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        <ResetButton onReset={onReset} />
      </div>
      <div className="seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => {
              if (option.value !== value) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggles({
  items,
}: {
  items: { id: string; label: string; on: boolean; toggle: () => void }[]
}) {
  return (
    <div className="toggles" role="group" aria-label="Visible parts">
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.on} onClick={item.toggle}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

const SIDE_LABEL: Record<Side, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
}

export function SidePicker({ value, onChange }: { value: Side; onChange: (side: Side) => void }) {
  return (
    <div className="side-picker">
      {(['top', 'left', 'right', 'bottom'] as Side[]).map((side) => (
        <button
          key={side}
          type="button"
          data-side={side}
          aria-pressed={value === side}
          onClick={() => onChange(side)}
        >
          {SIDE_LABEL[side]}
        </button>
      ))}
      <div className="side-node" aria-hidden="true" />
    </div>
  )
}
