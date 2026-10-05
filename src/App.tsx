import { EditorProvider } from './store'
import { Canvas } from './components/Canvas'
import { Properties } from './components/Properties'
import { TopBar } from './components/TopBar'

export default function App() {
  return (
    <EditorProvider>
      <div className="app">
        <TopBar />
        <div className="workspace">
          <Canvas />
          <Properties />
        </div>
      </div>
    </EditorProvider>
  )
}
