import { useState } from 'react'
import { MessageSquare, ClipboardList, ChevronRight, ChevronLeft } from 'lucide-react'
import { PreviewPanel } from './PreviewPanel'
import { RunLogPanel } from './RunLogPanel'

type TabId = 'preview' | 'log'

export function RightPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<TabId>('preview')

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex h-full w-10 shrink-0 flex-col items-center justify-center border-l border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="展开右侧面板"
      >
        <MessageSquare className="h-5 w-5" />
        <ChevronLeft className="mt-1 h-4 w-4" />
      </button>
    )
  }

  return (
    <aside
      className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-slate-50"
      style={{ width: '380px' }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex gap-1 rounded-lg bg-slate-200/50 p-1">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              tab === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            预览
          </button>
          <button
            type="button"
            onClick={() => setTab('log')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              tab === 'log' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            日志
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          aria-label="收起面板"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'preview' && <PreviewPanel embedded />}
        {tab === 'log' && <RunLogPanel />}
      </div>
    </aside>
  )
}
