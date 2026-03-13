import { useState, useCallback } from 'react'
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react'
import type { NodeType } from '../types/workflow'
import { NODE_PALETTE_TEMPLATES } from '../config/nodePalette'

const DRAG_TYPE = 'application/reactflow'

function handleDragStart(e: React.DragEvent, nodeType: NodeType) {
  e.dataTransfer.setData(DRAG_TYPE, nodeType)
  e.dataTransfer.effectAllowed = 'move'
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), [])

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out"
      style={{ width: isCollapsed ? 60 : 250 }}
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-2 py-2">
          {!isCollapsed && (
            <h2 className="flex items-center gap-2 truncate pl-2 text-sm font-semibold text-slate-700">
              <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">节点组件库</span>
            </h2>
          )}
          <button
            type="button"
            onClick={toggle}
            title={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {!isCollapsed && (
            <p className="mb-3 truncate px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              拖拽到画布添加节点
            </p>
          )}
          <ul className={isCollapsed ? 'space-y-2' : 'space-y-2'}>
            {NODE_PALETTE_TEMPLATES.map(({ type, label, icon: Icon, color }) => (
              <li
                key={type}
                draggable
                onDragStart={(e) => handleDragStart(e, type)}
                title={label}
                className={
                  isCollapsed
                    ? 'flex cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-white p-2 active:cursor-grabbing hover:border-indigo-500 hover:bg-indigo-50/50 hover:shadow-sm transition-all'
                    : 'flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 active:cursor-grabbing hover:border-indigo-500 hover:bg-indigo-50/50 hover:shadow-sm transition-all'
                }
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {!isCollapsed && <span className="truncate text-sm font-medium text-slate-700">{label}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}

export { DRAG_TYPE }
