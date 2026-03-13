import { Toaster } from 'sonner'
import { DebugDrawer } from './components/DebugDrawer'
import { MockVariablesDialog } from './components/MockVariablesDialog'
import { RightPanel } from './components/RightPanel'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { WorkflowCanvas } from './components/WorkflowCanvas'

function App() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Toaster richColors position="top-center" />
      <DebugDrawer />
      <MockVariablesDialog />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <WorkflowCanvas />
        </main>
        <RightPanel />
      </div>
    </div>
  )
}

export default App
