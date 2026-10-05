import { useRef, useState } from 'react'
import { Download, FolderOpen, Plus, Redo2, Trash2, Undo2 } from 'lucide-react'
import { exportDiagramPng, exportDiagramSvg } from '../exportPng'
import { useDoc, useView } from '../store'
import { downloadDoc, readDocFile } from '../views'

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

export function TopBar() {
  const { doc, canUndo, canRedo, undo, redo, addNode, deleteSelection, selection, updateExport, endCoalesce, loadDocument } =
    useDoc()
  const { svgRef, clientToWorld, fit, userMovedRef } = useView()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <rect x="1" y="1" width="7" height="5.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="10" y="11" width="7" height="5.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 4 H11.5 Q14 4 14 7.5 V11" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span>Graph Visualizer</span>
      </div>
      <div className="toolbar">
        <button
          type="button"
          data-testid="add-node"
          onClick={() => {
            const svg = svgRef.current
            if (!svg) return
            const rect = svg.getBoundingClientRect()
            const world = clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
            addNode({ x: world.x - 100, y: world.y - 40 })
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Add node
        </button>
        <button type="button" title={`${mod}Z`} aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={15} />
        </button>
        <button type="button" title={`${mod}Shift+Z`} aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={15} />
        </button>
        <button type="button" title="Delete" aria-label="Delete selection" disabled={!selection} onClick={deleteSelection}>
          <Trash2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            userMovedRef.current = true
            fit()
          }}
        >
          Fit
        </button>
      </div>
      <div className="export-bar">
        <label className="inline-field">
          Padding
          <input
            data-testid="export-padding"
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
        </label>
        <div className="seg" role="group" aria-label="Resolution">
          {[1, 2, 3].map((scale) => (
            <button
              key={scale}
              type="button"
              aria-pressed={doc.exportSettings.scale === scale}
              onClick={() => updateExport({ scale })}
            >
              {scale}×
            </button>
          ))}
        </div>
        <button type="button" data-testid="open-json" onClick={() => fileRef.current?.click()}>
          <FolderOpen size={15} />
          Open
        </button>
        <button type="button" data-testid="export-json" onClick={() => downloadDoc(doc, 'graph.json')}>
          JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void readDocFile(file)
              .then((next) => {
                if (doc.nodes.length > 0 && !window.confirm('Replace the current diagram with this file?')) return
                setError(null)
                loadDocument(next)
              })
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : 'Could not open that file')
              })
          }}
        />
        <button
          type="button"
          data-testid="export-svg"
          disabled={busy || doc.nodes.length === 0}
          onClick={() => {
            setBusy(true)
            setError(null)
            void exportDiagramSvg(doc)
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : 'Export failed')
              })
              .finally(() => setBusy(false))
          }}
        >
          <Download size={15} />
          {busy ? 'Exporting…' : 'Export SVG'}
        </button>
        <button
          type="button"
          className="primary"
          data-testid="export-png"
          disabled={busy || doc.nodes.length === 0}
          onClick={() => {
            setBusy(true)
            setError(null)
            void exportDiagramPng(doc)
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : 'Export failed')
              })
              .finally(() => setBusy(false))
          }}
        >
          <Download size={15} />
          {busy ? 'Exporting…' : 'Export PNG'}
        </button>
      </div>
      {error ? <p className="export-error">{error}</p> : null}
    </header>
  )
}
