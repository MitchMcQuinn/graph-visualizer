import { useState } from 'react'
import { applyEdgeStyle, applyNodeStyle } from '../style'
import { useDoc } from '../store'
import type { EdgeStyle, EdgeType, NodeStyle, NodeType } from '../types'
import { Field } from './controls'
import { EdgeStyleFields, NodeStyleFields } from './styleFields'

export function TypesPanel() {
  const { doc, addNodeType, updateNodeType, deleteNodeType, addEdgeType, updateEdgeType, deleteEdgeType, endCoalesce } = useDoc()
  const nodeTypes = doc.nodeTypes ?? []
  const edgeTypes = doc.edgeTypes ?? []
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [edgeId, setEdgeId] = useState<string | null>(null)
  const nodeType = nodeTypes.find((type) => type.id === nodeId) ?? null
  const edgeType = edgeTypes.find((type) => type.id === edgeId) ?? null

  return (
    <>
      <p className="hint">
        A type shares the settings you change here. Anything left alone keeps following the global defaults. Choose a type on a node or relationship to use it.
      </p>
      <div className="section-label">Node types</div>
      <TypeList
        types={nodeTypes}
        selectedId={nodeType?.id ?? null}
        counts={countBy(doc.nodes.map((node) => node.typeId))}
        onSelect={setNodeId}
      />
      <button
        type="button"
        className="full"
        disabled={nodeTypes.length >= 40}
        onClick={() => {
          const id = addNodeType()
          if (id) setNodeId(id)
        }}
      >
        Add node type
      </button>
      {nodeType ? (
        <NodeTypeEditor
          type={nodeType}
          defaults={doc.defaults.node}
          onName={(name, coalesce) => updateNodeType(nodeType.id, { name }, coalesce)}
          onStyle={(style, coalesce) => updateNodeType(nodeType.id, { style }, coalesce)}
          onDone={endCoalesce}
          onDelete={() => {
            deleteNodeType(nodeType.id)
            setNodeId(null)
          }}
        />
      ) : null}
      <div className="section-label">Relationship types</div>
      <TypeList
        types={edgeTypes}
        selectedId={edgeType?.id ?? null}
        counts={countBy(doc.edges.map((edge) => edge.typeId))}
        onSelect={setEdgeId}
      />
      <button
        type="button"
        className="full"
        disabled={edgeTypes.length >= 40}
        onClick={() => {
          const id = addEdgeType()
          if (id) setEdgeId(id)
        }}
      >
        Add relationship type
      </button>
      {edgeType ? (
        <EdgeTypeEditor
          type={edgeType}
          defaults={doc.defaults.edge}
          onName={(name, coalesce) => updateEdgeType(edgeType.id, { name }, coalesce)}
          onStyle={(style, coalesce) => updateEdgeType(edgeType.id, { style }, coalesce)}
          onDone={endCoalesce}
          onDelete={() => {
            deleteEdgeType(edgeType.id)
            setEdgeId(null)
          }}
        />
      ) : null}
    </>
  )
}

function countBy(ids: string[]) {
  const counts = new Map<string, number>()
  for (const id of ids) {
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

function TypeList({
  types,
  selectedId,
  counts,
  onSelect,
}: {
  types: { id: string; name: string }[]
  selectedId: string | null
  counts: Map<string, number>
  onSelect: (id: string) => void
}) {
  if (types.length === 0) return null
  return (
    <div className="view-list">
      {types.map((type) => {
        const count = counts.get(type.id) ?? 0
        return (
          <div className="type-row" key={type.id}>
            <button type="button" className="type-pick" aria-pressed={type.id === selectedId} onClick={() => onSelect(type.id)}>
              {type.name.trim() || 'Untitled type'}
            </button>
            <span className="type-count">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function NodeTypeEditor({
  type,
  defaults,
  onName,
  onStyle,
  onDone,
  onDelete,
}: {
  type: NodeType
  defaults: NodeStyle
  onName: (name: string, coalesce?: boolean) => void
  onStyle: (style: Partial<NodeStyle>, coalesce?: boolean) => void
  onDone: () => void
  onDelete: () => void
}) {
  const resolved = { ...defaults, ...type.style }
  const resetFor = (key: keyof NodeStyle) => {
    if (type.style[key] === undefined) return undefined
    return () => {
      const style = { ...type.style }
      delete style[key]
      onStyle(style)
    }
  }
  return (
    <div className="type-editor">
      <Field label="Name">
        <input
          type="text"
          value={type.name}
          onChange={(event) => onName(event.target.value, true)}
          onBlur={() => {
            onDone()
            if (!type.name.trim()) onName('Node type')
          }}
        />
      </Field>
      <NodeStyleFields
        value={resolved}
        onChange={(patch, coalesce) => onStyle(applyNodeStyle(type.style, patch, defaults), coalesce)}
        onDone={onDone}
        resetFor={resetFor}
      />
      <button type="button" className="danger" onClick={onDelete}>
        Delete type
      </button>
    </div>
  )
}

function EdgeTypeEditor({
  type,
  defaults,
  onName,
  onStyle,
  onDone,
  onDelete,
}: {
  type: EdgeType
  defaults: EdgeStyle
  onName: (name: string, coalesce?: boolean) => void
  onStyle: (style: Partial<EdgeStyle>, coalesce?: boolean) => void
  onDone: () => void
  onDelete: () => void
}) {
  const resolved = { ...defaults, ...type.style }
  const resetFor = (key: keyof EdgeStyle) => {
    if (type.style[key] === undefined) return undefined
    return () => {
      const style = { ...type.style }
      delete style[key]
      onStyle(style)
    }
  }
  return (
    <div className="type-editor">
      <Field label="Name">
        <input
          type="text"
          value={type.name}
          onChange={(event) => onName(event.target.value, true)}
          onBlur={() => {
            onDone()
            if (!type.name.trim()) onName('Relationship type')
          }}
        />
      </Field>
      <EdgeStyleFields
        value={resolved}
        onChange={(patch, coalesce) => onStyle(applyEdgeStyle(type.style, patch, defaults), coalesce)}
        onDone={onDone}
        resetFor={resetFor}
      />
      <button type="button" className="danger" onClick={onDelete}>
        Delete type
      </button>
    </div>
  )
}
