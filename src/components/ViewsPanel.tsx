import { useRef, useState } from 'react'
import { useDoc } from '../store'
import { deleteNamedView, downloadDoc, listViews, readDocFile, saveNamedView, viewFileName, type SavedView } from '../views'
import { Field } from './controls'

export function ViewsPanel() {
  const { doc, loadDocument } = useDoc()
  const [views, setViews] = useState<SavedView[]>(() => listViews())
  const [name, setName] = useState('Untitled view')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => setViews(listViews())

  const openDoc = (next: typeof doc) => {
    if (doc.nodes.length > 0 && !window.confirm('Replace the current diagram with this view?')) return
    loadDocument(next)
  }

  return (
    <>
      <p className="hint">
        Save a named copy in this browser, download the graph as JSON, or open a file you exported earlier.
      </p>
      <Field label="View name">
        <input
          data-testid="view-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <div className="row-actions">
        <button
          type="button"
          data-testid="save-view"
          onClick={() => {
            const message = saveNamedView(name, doc)
            setError(message)
            if (!message) refresh()
          }}
        >
          Save view
        </button>
        <button type="button" onClick={() => downloadDoc(doc, viewFileName(name))}>
          Download JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Open JSON
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
                setError(null)
                openDoc(next)
              })
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : 'Could not open that file')
              })
          }}
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {views.length > 0 ? (
        <div className="view-list">
          {views.map((view) => (
            <div key={view.id} className="view-row">
              <strong title={view.name}>{view.name}</strong>
              <button type="button" onClick={() => openDoc(view.doc)}>
                Load
              </button>
              <button type="button" onClick={() => downloadDoc(view.doc, viewFileName(view.name))}>
                JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  const message = deleteNamedView(view.id)
                  setError(message)
                  if (!message) refresh()
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">No saved views yet.</p>
      )}
    </>
  )
}
