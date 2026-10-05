import { FONT_OPTIONS } from '../fonts'
import type { ArrowHead, EdgeStyle, FontId, IconAlign, NodeStyle } from '../types'
import { ColorField, Field, Segmented, SliderField } from './controls'

export function NodeStyleFields({
  value,
  onChange,
  onDone,
  resetFor,
}: {
  value: NodeStyle
  onChange: (patch: Partial<NodeStyle>, coalesce?: boolean) => void
  onDone: () => void
  resetFor?: (key: keyof NodeStyle) => (() => void) | undefined
}) {
  const reset = (key: keyof NodeStyle) => resetFor?.(key)
  return (
    <>
      <Segmented
        label="Align"
        value={value.align}
        onChange={(align) => onChange({ align })}
        onReset={reset('align')}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
      />
      <div className="section-label">Icon</div>
      <Segmented
        label="Alignment"
        value={value.iconAlign}
        onChange={(iconAlign) => onChange({ iconAlign })}
        onReset={reset('iconAlign')}
        options={[
          { value: 'with-text' as IconAlign, label: 'Text' },
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
      />
      <SliderField
        label="Vertical offset"
        value={value.iconOffset}
        min={-32}
        max={32}
        step={1}
        format={(amount) => `${amount > 0 ? '+' : ''}${Math.round(amount)} px`}
        onChange={(iconOffset) => onChange({ iconOffset }, true)}
        onDone={onDone}
        onReset={reset('iconOffset')}
      />
      <SliderField
        label="Size"
        value={value.iconSize}
        min={12}
        max={64}
        step={1}
        onChange={(iconSize) => onChange({ iconSize }, true)}
        onDone={onDone}
        onReset={reset('iconSize')}
      />
      <ColorField
        label="Color"
        value={value.iconColor}
        onChange={(iconColor) => onChange({ iconColor }, true)}
        onDone={onDone}
        onReset={reset('iconColor')}
      />
      <Field label="Font" onReset={reset('font')}>
        <select
          aria-label="Font"
          value={value.font}
          onChange={(event) => onChange({ font: event.target.value as FontId })}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </Field>
      <Segmented
        label="Title weight"
        value={value.titleWeight}
        onChange={(titleWeight) => onChange({ titleWeight })}
        onReset={reset('titleWeight')}
        options={[
          { value: 600, label: 'Semibold' },
          { value: 700, label: 'Bold' },
        ]}
      />
      <div className="grid-2">
        <ColorField label="Fill" value={value.fill} onChange={(fill) => onChange({ fill }, true)} onDone={onDone} onReset={reset('fill')} />
        <ColorField
          label="Border"
          value={value.stroke}
          onChange={(stroke) => onChange({ stroke }, true)}
          onDone={onDone}
          onReset={reset('stroke')}
        />
        <ColorField
          label="Title color"
          value={value.titleColor}
          onChange={(titleColor) => onChange({ titleColor }, true)}
          onDone={onDone}
          onReset={reset('titleColor')}
        />
        <ColorField
          label="Text color"
          value={value.textColor}
          onChange={(textColor) => onChange({ textColor }, true)}
          onDone={onDone}
          onReset={reset('textColor')}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={value.fillOpacity === 0}
          onChange={(event) => onChange({ fillOpacity: event.target.checked ? 0 : 1 })}
        />
        Transparent fill
      </label>
      <SliderField
        label="Fill opacity"
        value={value.fillOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(amount) => (amount === 0 ? 'Transparent' : `${Math.round(amount * 100)}%`)}
        onChange={(fillOpacity) => onChange({ fillOpacity }, true)}
        onDone={onDone}
        onReset={reset('fillOpacity')}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={value.strokeOpacity === 0}
          onChange={(event) => onChange({ strokeOpacity: event.target.checked ? 0 : 1 })}
        />
        Transparent border
      </label>
      <SliderField
        label="Border opacity"
        value={value.strokeOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(amount) => (amount === 0 ? 'Transparent' : `${Math.round(amount * 100)}%`)}
        onChange={(strokeOpacity) => onChange({ strokeOpacity }, true)}
        onDone={onDone}
        onReset={reset('strokeOpacity')}
      />
      <SliderField
        label="Border width"
        value={value.strokeWidth}
        min={0.5}
        max={6}
        step={0.25}
        format={(amount) => amount.toFixed(2)}
        onChange={(strokeWidth) => onChange({ strokeWidth }, true)}
        onDone={onDone}
        onReset={reset('strokeWidth')}
      />
      <SliderField
        label="Rounding"
        value={value.radius}
        min={0}
        max={64}
        step={1}
        onChange={(radius) => onChange({ radius }, true)}
        onDone={onDone}
        onReset={reset('radius')}
      />
      <SliderField
        label="Title size"
        value={value.titleSize}
        min={11}
        max={28}
        step={0.5}
        onChange={(titleSize) => onChange({ titleSize }, true)}
        onDone={onDone}
        onReset={reset('titleSize')}
      />
      <SliderField
        label="Text size"
        value={value.textSize}
        min={10}
        max={20}
        step={0.5}
        onChange={(textSize) => onChange({ textSize }, true)}
        onDone={onDone}
        onReset={reset('textSize')}
      />
      <div className="section-label">Table style</div>
      <Segmented
        label="Borders"
        value={value.tableBorders}
        onChange={(tableBorders) => onChange({ tableBorders })}
        onReset={reset('tableBorders')}
        options={[
          { value: 'none', label: 'None' },
          { value: 'rows', label: 'Rows' },
          { value: 'grid', label: 'Grid' },
        ]}
      />
      <Segmented
        label="Density"
        value={value.tableDensity}
        onChange={(tableDensity) => onChange({ tableDensity })}
        onReset={reset('tableDensity')}
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'regular', label: 'Regular' },
        ]}
      />
      <ColorField
        label="Header text"
        value={value.tableHeaderColor}
        onChange={(tableHeaderColor) => onChange({ tableHeaderColor }, true)}
        onDone={onDone}
        onReset={reset('tableHeaderColor')}
      />
      <ColorField
        label="Header fill"
        value={value.tableHeaderFill}
        onChange={(tableHeaderFill) => onChange({ tableHeaderFill }, true)}
        onDone={onDone}
        onReset={reset('tableHeaderFill')}
      />
      <SliderField
        label="Header opacity"
        value={value.tableHeaderOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(amount) => (amount === 0 ? 'Off' : `${Math.round(amount * 100)}%`)}
        onChange={(tableHeaderOpacity) => onChange({ tableHeaderOpacity }, true)}
        onDone={onDone}
        onReset={reset('tableHeaderOpacity')}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={value.tableStripe}
          onChange={(event) => onChange({ tableStripe: event.target.checked })}
        />
        Striped rows
      </label>
      <ColorField
        label="Stripe color"
        value={value.tableStripeFill}
        onChange={(tableStripeFill) => onChange({ tableStripeFill }, true)}
        onDone={onDone}
        onReset={reset('tableStripeFill')}
      />
      <SliderField
        label="Stripe opacity"
        value={value.tableStripeOpacity}
        min={0}
        max={0.4}
        step={0.02}
        format={(amount) => (amount === 0 ? 'Off' : `${Math.round(amount * 100)}%`)}
        onChange={(tableStripeOpacity) => onChange({ tableStripeOpacity }, true)}
        onDone={onDone}
        onReset={reset('tableStripeOpacity')}
      />
    </>
  )
}

function ArrowEndFields({
  label,
  head,
  length,
  width,
  onHead,
  onLength,
  onWidth,
  onDone,
  resetHead,
  resetLength,
  resetWidth,
}: {
  label: string
  head: ArrowHead
  length: number
  width: number
  onHead: (head: ArrowHead) => void
  onLength: (length: number) => void
  onWidth: (width: number) => void
  onDone: () => void
  resetHead?: () => void
  resetLength?: () => void
  resetWidth?: () => void
}) {
  return (
    <>
      <Segmented
        label={`${label} head`}
        value={head}
        onChange={onHead}
        onReset={resetHead}
        options={[
          { value: 'none' as ArrowHead, label: 'None' },
          { value: 'arrow' as ArrowHead, label: 'Arrow' },
          { value: 'bullet' as ArrowHead, label: 'Bullet' },
          { value: 'bar' as ArrowHead, label: 'Bar' },
        ]}
      />
      {head === 'none' ? null : (
        <SliderField
          label={`${label} size`}
          value={length}
          min={6}
          max={32}
          step={1}
          format={(amount) => `${Math.round(amount)} px`}
          onChange={onLength}
          onDone={onDone}
          onReset={resetLength}
        />
      )}
      {head === 'arrow' || head === 'bar' ? (
        <SliderField
          label={`${label} width`}
          value={width}
          min={4}
          max={28}
          step={1}
          format={(amount) => `${Math.round(amount)} px`}
          onChange={onWidth}
          onDone={onDone}
          onReset={resetWidth}
        />
      ) : null}
    </>
  )
}

export function EdgeStyleFields({
  value,
  onChange,
  onDone,
  resetFor,
}: {
  value: EdgeStyle
  onChange: (patch: Partial<EdgeStyle>, coalesce?: boolean) => void
  onDone: () => void
  resetFor?: (key: keyof EdgeStyle) => (() => void) | undefined
}) {
  const reset = (key: keyof EdgeStyle) => resetFor?.(key)
  return (
    <>
      <Segmented
        label="Path"
        value={value.pathStyle}
        onChange={(pathStyle) => onChange({ pathStyle })}
        onReset={reset('pathStyle')}
        options={[
          { value: 'curved', label: 'Curve' },
          { value: 'straight', label: 'Straight' },
          { value: 'squared', label: 'Square' },
          { value: 'rounded', label: 'Round' },
        ]}
      />
      <Segmented
        label="Line"
        value={value.lineStyle}
        onChange={(lineStyle) => onChange({ lineStyle })}
        onReset={reset('lineStyle')}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
        ]}
      />
      <ArrowEndFields
        label="Start"
        head={value.startHead}
        length={value.startLength}
        width={value.startWidth}
        onHead={(startHead) => onChange({ startHead })}
        onLength={(startLength) => onChange({ startLength }, true)}
        onWidth={(startWidth) => onChange({ startWidth }, true)}
        onDone={onDone}
        resetHead={reset('startHead')}
        resetLength={reset('startLength')}
        resetWidth={reset('startWidth')}
      />
      <ArrowEndFields
        label="End"
        head={value.endHead}
        length={value.endLength}
        width={value.endWidth}
        onHead={(endHead) => onChange({ endHead })}
        onLength={(endLength) => onChange({ endLength }, true)}
        onWidth={(endWidth) => onChange({ endWidth }, true)}
        onDone={onDone}
        resetHead={reset('endHead')}
        resetLength={reset('endLength')}
        resetWidth={reset('endWidth')}
      />
      <ColorField label="Line" value={value.color} onChange={(color) => onChange({ color }, true)} onDone={onDone} onReset={reset('color')} />
      <SliderField
        label="Line width"
        value={value.strokeWidth}
        min={0.5}
        max={6}
        step={0.25}
        format={(amount) => amount.toFixed(2)}
        onChange={(strokeWidth) => onChange({ strokeWidth }, true)}
        onDone={onDone}
        onReset={reset('strokeWidth')}
      />
    </>
  )
}
