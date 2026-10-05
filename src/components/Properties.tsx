import { useState } from 'react'
import { fittedNodeWidth, layoutNode } from '../layout'
import { applyEdgeStyle, applyNodeStyle, edgeStyleBase, nodeStyleBase, resolveEdge, resolveNode } from '../style'
import { useDoc } from '../store'
import type { EdgeStyle, NodeModel, NodeStyle, TableData } from '../types'
import { ColorField, Field, Segmented, SidePicker, SliderField, Toggles } from './controls'
import { IconPicker } from './IconPicker'
import { EdgeStyleFields, NodeStyleFields } from './styleFields'
import { TypesPanel } from './TypesPanel'
import { ViewsPanel } from './ViewsPanel'

function TableEditor({
  table,
  onChange,
  onDone,
}: {
  table: TableData
  onChange: (table: TableData, coalesce?: boolean) => void
  onDone: () => void
}) {
  const columns = Math.max(1, ...table.rows.map((row) => row.length), table.rows.length ? 0 : 1)
  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = table.rows.map((row, index) => {
      if (index !== rowIndex) return row
      const next = row.slice()
      while (next.length < columns) next.push('')
      next[columnIndex] = value
      return next
    })
    onChange({ ...table, rows }, true)
  }

  return (
    <div className="table-editor">
      <label className="check">
        <input
          type="checkbox"
          checked={table.hasHeader}
          onChange={(event) => onChange({ ...table, hasHeader: event.target.checked }, false)}
        />
        Header row
      </label>
      {table.rows.map((row, rowIndex) => (
        <div className="table-row" key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <input
              key={columnIndex}
              type="text"
              value={row[columnIndex] ?? ''}
              placeholder={table.hasHeader && rowIndex === 0 ? 'Header' : 'Value'}
              onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
              onBlur={onDone}
            />
          ))}
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove row"
            onClick={() => {
              onDone()
              onChange({ ...table, rows: table.rows.filter((_, index) => index !== rowIndex) }, false)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div className="row-actions">
        <button
          type="button"
          onClick={() => {
            onDone()
            onChange({ ...table, rows: [...table.rows, Array.from({ length: columns }, () => '')] }, false)
          }}
        >
          Add row
        </button>
        <button
          type="button"
          onClick={() => {
            onDone()
            const base = table.rows.length ? table.rows : [['']]
            onChange({ ...table, rows: base.map((row) => [...row, '']) }, false)
          }}
        >
          Add column
        </button>
        {columns > 1 ? (
          <button
            type="button"
            onClick={() => {
              onDone()
              onChange({ ...table, rows: table.rows.map((row) => row.slice(0, -1)) }, false)
            }}
          >
            Remove column
          </button>
        ) : null}
      </div>
    </div>
  )
}

function NodeProperties({ nodeId }: { nodeId: string }) {
  const { doc, updateNode, endCoalesce, deleteSelection } = useDoc()
  const node = doc.nodes.find((item) => item.id === nodeId)
  if (!node) return null
  const patch = (partial: Partial<NodeModel>, coalesce = false) => updateNode(node.id, partial, coalesce)
  const nodeTypes = doc.nodeTypes ?? []
  const base = nodeStyleBase(doc.defaults.node, nodeTypes, node.typeId)
  const resolved = resolveNode(node, doc.defaults.node, nodeTypes)
  const contentWidth = resolved.autoWidth ? fittedNodeWidth(resolved) : resolved.width
  const contentHeight = layoutNode({ ...resolved, width: contentWidth, height: null }).contentHeight
  const displayHeight = node.height == null ? contentHeight : Math.max(node.height, contentHeight)
  const yForHeight = (nextHeight: number) =>
    node.heightAnchor === 'center' ? node.y + (displayHeight - nextHeight) / 2 : node.y
  const setStyle = (stylePatch: Partial<NodeStyle>, coalesce = false) =>
    patch({ style: applyNodeStyle(node.style, stylePatch, base) }, coalesce)
  const resetStyle = (key: keyof NodeStyle) => {
    if (node.style[key] === undefined) return undefined
    return () => {
      const style = { ...node.style }
      delete style[key]
      patch({ style })
    }
  }

  return (
    <>
      <Field label="Title">
        <input
          type="text"
          value={node.title}
          onChange={(event) => patch({ title: event.target.value }, true)}
          onBlur={endCoalesce}
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={3}
          value={node.description}
          placeholder="Optional note"
          onChange={(event) => patch({ description: event.target.value }, true)}
          onBlur={endCoalesce}
        />
      </Field>
      <IconPicker node={node} />
      <div className="section-label">Show</div>
      <Toggles
        items={[
          { id: 'title', label: 'Title', on: node.showTitle, toggle: () => patch({ showTitle: !node.showTitle }) },
          {
            id: 'description',
            label: 'Description',
            on: node.showDescription,
            toggle: () => patch({ showDescription: !node.showDescription }),
          },
          { id: 'icon', label: 'Icon', on: node.showIcon, toggle: () => patch({ showIcon: !node.showIcon }) },
          {
            id: 'table',
            label: 'Table',
            on: node.showTable,
            toggle: () => {
              if (!node.showTable && node.table.rows.length === 0) {
                patch({ showTable: true, table: { hasHeader: false, rows: [['']] } })
              } else patch({ showTable: !node.showTable })
            },
          },
        ]}
      />
      <div className="section-label">Table</div>
      <TableEditor
        table={node.table}
        onDone={endCoalesce}
        onChange={(table, coalesce) => patch({ table, showTable: true }, coalesce)}
      />
      <div className="section-label">Appearance</div>
      <Field label="Type">
        <select value={node.typeId} onChange={(event) => patch({ typeId: event.target.value })}>
          <option value="">None</option>
          {nodeTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name.trim() || 'Untitled type'}
            </option>
          ))}
        </select>
      </Field>
      <p className="hint">
        These follow the selected type, then the global defaults. Default puts a setting back on that shared value.
      </p>
      <NodeStyleFields value={resolved} onChange={setStyle} onDone={endCoalesce} resetFor={resetStyle} />
      {Object.keys(node.style).length > 0 ? (
        <button type="button" className="full" onClick={() => patch({ style: {} })}>
          {node.typeId ? 'Use type' : 'Use defaults'}
        </button>
      ) : null}
      <div className="section-label">Placement</div>
      <div className="grid-2">
        <Field label="X">
          <input
            type="number"
            value={Math.round(node.x)}
            onChange={(event) => {
              const x = Number(event.target.value)
              if (Number.isFinite(x)) patch({ x }, true)
            }}
            onBlur={endCoalesce}
          />
        </Field>
        <Field label="Y">
          <input
            type="number"
            value={Math.round(node.y)}
            onChange={(event) => {
              const y = Number(event.target.value)
              if (Number.isFinite(y)) patch({ y }, true)
            }}
            onBlur={endCoalesce}
          />
        </Field>
      </div>
      <Segmented
        label="Width"
        value={node.autoWidth ? 'auto' : 'fixed'}
        onChange={(mode) => {
          if (mode === 'auto') patch({ autoWidth: true })
          else patch({ autoWidth: false, width: Math.min(2400, Math.max(80, Math.ceil(fittedNodeWidth(resolved)))) })
        }}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'fixed', label: 'Fixed' },
        ]}
      />
      {node.autoWidth ? (
        <p className="hint">Fits the content on one line, {Math.ceil(fittedNodeWidth(resolved))} px.</p>
      ) : (
        <SliderField
          label="Width"
          value={node.width}
          min={80}
          max={Math.max(720, node.width)}
          step={1}
          onChange={(width) => patch({ width }, true)}
          onDone={endCoalesce}
        />
      )}
      <Segmented
        label="Height"
        value={node.height == null ? 'auto' : 'fixed'}
        onChange={(mode) => {
          if (mode === 'auto') patch({ height: null, y: yForHeight(contentHeight) })
          else patch({ height: Math.ceil(contentHeight) })
        }}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'fixed', label: 'Fixed' },
        ]}
      />
      {node.height == null ? (
        <p className="hint">Fits the content, {Math.ceil(contentHeight)} px.</p>
      ) : (
        <SliderField
          label="Height"
          value={Math.max(node.height, contentHeight)}
          min={Math.ceil(contentHeight)}
          max={Math.max(720, node.height, contentHeight)}
          step={1}
          onChange={(height) => patch({ height, y: yForHeight(height) }, true)}
          onDone={endCoalesce}
        />
      )}
      <Segmented
        label="Height anchor"
        value={node.heightAnchor === 'center' ? 'center' : 'top'}
        onChange={(heightAnchor) => patch({ heightAnchor })}
        options={[
          { value: 'top', label: 'Top' },
          { value: 'center', label: 'Center' },
        ]}
      />
      <p className="hint">Top holds the top edge. Center holds the middle while the height changes.</p>
      <Segmented
        label="Anchors"
        value={node.centerAnchors ? 'center' : 'spread'}
        onChange={(mode) => patch({ centerAnchors: mode === 'center' })}
        options={[
          { value: 'spread', label: 'Spread' },
          { value: 'center', label: 'Center' },
        ]}
      />
      <p className="hint">Center meets every relationship on a side at the middle of that side.</p>
      <button type="button" className="danger" onClick={deleteSelection}>
        Delete node
      </button>
    </>
  )
}

function EdgeProperties({ edgeId }: { edgeId: string }) {
  const { doc, updateEdge, endCoalesce, deleteSelection } = useDoc()
  const edge = doc.edges.find((item) => item.id === edgeId)
  if (!edge) return null
  const patch = (partial: Partial<typeof edge>, coalesce = false) => updateEdge(edge.id, partial, coalesce)
  const edgeTypes = doc.edgeTypes ?? []
  const base = edgeStyleBase(doc.defaults.edge, edgeTypes, edge.typeId)
  const resolved = resolveEdge(edge, doc.defaults.edge, edgeTypes)
  const setStyle = (stylePatch: Partial<EdgeStyle>, coalesce = false) =>
    patch({ style: applyEdgeStyle(edge.style, stylePatch, base) }, coalesce)
  const resetStyle = (key: keyof EdgeStyle) => {
    if (edge.style[key] === undefined) return undefined
    return () => {
      const style = { ...edge.style }
      delete style[key]
      patch({ style })
    }
  }

  return (
    <>
      <p className="hint">Relationships are lines only. Titles and tables stay on nodes.</p>
      <div className="section-label">Route</div>
      <Field label="From">
        <select value={edge.fromId} onChange={(event) => patch({ fromId: event.target.value })}>
          {doc.nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title || 'Untitled'}
            </option>
          ))}
        </select>
      </Field>
      <SidePicker value={edge.fromSide} onChange={(fromSide) => patch({ fromSide })} />
      <Field label="To">
        <select value={edge.toId} onChange={(event) => patch({ toId: event.target.value })}>
          {doc.nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title || 'Untitled'}
            </option>
          ))}
        </select>
      </Field>
      <SidePicker value={edge.toSide} onChange={(toSide) => patch({ toSide })} />
      <button
        type="button"
        className="full"
        onClick={() =>
          patch({
            fromId: edge.toId,
            toId: edge.fromId,
            fromSide: edge.toSide,
            toSide: edge.fromSide,
          })
        }
      >
        Swap direction
      </button>
      <div className="section-label">Appearance</div>
      <Field label="Type">
        <select value={edge.typeId} onChange={(event) => patch({ typeId: event.target.value })}>
          <option value="">None</option>
          {edgeTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name.trim() || 'Untitled type'}
            </option>
          ))}
        </select>
      </Field>
      <p className="hint">
        These follow the selected type, then the global defaults. Default puts a setting back on that shared value.
      </p>
      <EdgeStyleFields value={resolved} onChange={setStyle} onDone={endCoalesce} resetFor={resetStyle} />
      {Object.keys(edge.style).length > 0 ? (
        <button type="button" className="full" onClick={() => patch({ style: {} })}>
          {edge.typeId ? 'Use type' : 'Use defaults'}
        </button>
      ) : null}
      <button type="button" className="danger" onClick={deleteSelection}>
        Delete relationship
      </button>
    </>
  )
}

function CanvasBackgroundFields() {
  const { doc, updateCanvas, endCoalesce } = useDoc()
  const background = doc.canvas.background
  return (
    <>
      <Segmented
        label="Background"
        value={background.kind}
        onChange={(kind) => {
          if (kind === 'transparent') {
            updateCanvas({ background: { kind: 'transparent' } })
            return
          }
          if (kind === 'gradient') {
            updateCanvas({
              background: {
                kind: 'gradient',
                from: background.kind === 'solid' ? background.color : background.kind === 'gradient' ? background.from : '#1a1a1a',
                to: background.kind === 'gradient' ? background.to : '#3a3a3a',
                angle: background.kind === 'gradient' ? background.angle : 160,
              },
            })
            return
          }
          updateCanvas({
            background: {
              kind: 'solid',
              color:
                background.kind === 'solid' ? background.color : background.kind === 'gradient' ? background.from : '#1a1a1a',
            },
          })
        }}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'transparent', label: 'Clear' },
        ]}
      />
      {background.kind === 'solid' ? (
        <ColorField
          label="Color"
          value={background.color}
          onChange={(color) => updateCanvas({ background: { kind: 'solid', color } }, true)}
          onDone={endCoalesce}
        />
      ) : null}
      {background.kind === 'gradient' ? (
        <>
          <div className="grid-2">
            <ColorField
              label="From"
              value={background.from}
              onChange={(from) => updateCanvas({ background: { ...background, from } }, true)}
              onDone={endCoalesce}
            />
            <ColorField
              label="To"
              value={background.to}
              onChange={(to) => updateCanvas({ background: { ...background, to } }, true)}
              onDone={endCoalesce}
            />
          </div>
          <SliderField
            label="Angle"
            value={background.angle}
            min={0}
            max={360}
            step={1}
            format={(value) => `${Math.round(value)}°`}
            onChange={(angle) => updateCanvas({ background: { ...background, angle } }, true)}
            onDone={endCoalesce}
          />
        </>
      ) : null}
    </>
  )
}

function DefaultsPanel() {
  const { doc, updateDefaults, endCoalesce } = useDoc()
  return (
    <>
      <p className="hint">
        Nodes and relationships use these values until a type, or the item itself, sets something else. New nodes also start at the width below.
      </p>
      <div className="section-label">Nodes</div>
      <Segmented
        label="New node width"
        value={doc.defaults.nodeAutoWidth ? 'auto' : 'fixed'}
        onChange={(mode) => updateDefaults({ nodeAutoWidth: mode === 'auto' })}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'fixed', label: 'Fixed' },
        ]}
      />
      {doc.defaults.nodeAutoWidth ? (
        <p className="hint">New nodes grow to fit their content on one line.</p>
      ) : (
        <SliderField
          label="New node width"
          value={doc.defaults.nodeWidth}
          min={120}
          max={480}
          step={1}
          onChange={(nodeWidth) => updateDefaults({ nodeWidth }, true)}
          onDone={endCoalesce}
        />
      )}
      <NodeStyleFields
        value={doc.defaults.node}
        onChange={(node, coalesce) => updateDefaults({ node }, coalesce)}
        onDone={endCoalesce}
      />
      <div className="section-label">Relationships</div>
      <EdgeStyleFields
        value={doc.defaults.edge}
        onChange={(edge, coalesce) => updateDefaults({ edge }, coalesce)}
        onDone={endCoalesce}
      />
    </>
  )
}

function CanvasProperties() {
  const { doc, updateCanvas, updateExport, endCoalesce, loadSample, clearDoc } = useDoc()
  const [tab, setTab] = useState<'canvas' | 'defaults' | 'types' | 'views'>('canvas')
  return (
    <>
      <p className="lede">
        Select a node or relationship to edit it. Drag a side anchor onto another side to connect them.
      </p>
      <div className="seg panel-tabs" role="tablist" aria-label="Canvas sections">
        {(
          [
            ['canvas', 'Canvas'],
            ['defaults', 'Defaults'],
            ['types', 'Types'],
            ['views', 'Views'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'defaults' ? <DefaultsPanel /> : null}
      {tab === 'types' ? <TypesPanel /> : null}
      {tab === 'views' ? <ViewsPanel /> : null}
      {tab === 'canvas' ? (
        <>
      <div className="section-label">Canvas</div>
      <CanvasBackgroundFields />
      <p className="hint">
        Solid colors and gradients are included in PNG and SVG exports. A transparent canvas exports with no background. The dot grid stays in the editor.
      </p>
      <Toggles
        items={[
          {
            id: 'grid',
            label: 'Grid',
            on: doc.canvas.showGrid,
            toggle: () => updateCanvas({ showGrid: !doc.canvas.showGrid }),
          },
          { id: 'snap', label: 'Snap', on: doc.canvas.snap, toggle: () => updateCanvas({ snap: !doc.canvas.snap }) },
          {
            id: 'guides',
            label: 'Guides',
            on: doc.canvas.guides !== false,
            toggle: () => updateCanvas({ guides: doc.canvas.guides === false }),
          },
        ]}
      />
      {doc.canvas.guides !== false ? (
        <SliderField
          label="Spacing"
          value={doc.canvas.guidePadding ?? 32}
          min={8}
          max={120}
          step={1}
          onChange={(guidePadding) => updateCanvas({ guidePadding }, true)}
          onDone={endCoalesce}
        />
      ) : null}
      <p className="hint">
        Drag a node near another to line up its top, center, or bottom, or to match the spacing.
      </p>
      <ColorField
        label="Grid color"
        value={doc.canvas.gridColor}
        onChange={(gridColor) => updateCanvas({ gridColor }, true)}
        onDone={endCoalesce}
      />
      <SliderField
        label="Grid gap"
        value={doc.canvas.gridGap}
        min={12}
        max={48}
        step={1}
        onChange={(gridGap) => updateCanvas({ gridGap }, true)}
        onDone={endCoalesce}
      />
      <div className="section-label">Export</div>
      <p className="hint">Padding is the margin around the diagram. Resolution keeps thin lines sharp.</p>
      <Field label="Padding">
        <input
          type="number"
          min={0}
          max={400}
          value={doc.exportSettings.padding}
          onChange={(event) => {
            const padding = Number(event.target.value)
            if (Number.isFinite(padding)) updateExport({ padding: Math.min(400, Math.max(0, padding)) }, true)
          }}
          onBlur={endCoalesce}
        />
      </Field>
      <Segmented
        label="Resolution"
        value={doc.exportSettings.scale}
        onChange={(scale) => updateExport({ scale })}
        options={[
          { value: 1, label: '1×' },
          { value: 2, label: '2×' },
          { value: 3, label: '3×' },
        ]}
      />
      <div className="row-actions">
        <button
          type="button"
          onClick={() => {
            if (doc.nodes.length === 0 || window.confirm('Replace the current diagram with the example?')) loadSample()
          }}
        >
          Load example
        </button>
        <button
          type="button"
          onClick={() => {
            if (doc.nodes.length === 0 || window.confirm('Clear the diagram?')) clearDoc()
          }}
        >
          Clear
        </button>
      </div>
        </>
      ) : null}
    </>
  )
}

function GroupProperties({ count }: { count: number }) {
  const { deleteSelection } = useDoc()
  return (
    <>
      <p className="hint">{count} nodes selected. Drag any of them to move the group together.</p>
      <button type="button" className="danger" onClick={deleteSelection}>
        Delete nodes
      </button>
    </>
  )
}

export function Properties() {
  const { selection } = useDoc()
  const nodeCount = selection?.kind === 'node' ? selection.ids.length : 0
  const title = nodeCount > 1 ? 'Nodes' : nodeCount === 1 ? 'Node' : selection?.kind === 'edge' ? 'Relationship' : 'Canvas'
  return (
    <aside className="panel" data-testid="properties">
      <div className="panel-head">{title}</div>
      <div className="panel-scroll">
        {selection?.kind === 'node' && nodeCount === 1 ? <NodeProperties nodeId={selection.ids[0]} /> : null}
        {selection?.kind === 'node' && nodeCount > 1 ? <GroupProperties count={nodeCount} /> : null}
        {selection?.kind === 'edge' ? <EdgeProperties edgeId={selection.id} /> : null}
        {selection == null ? <CanvasProperties /> : null}
      </div>
    </aside>
  )
}
