import { Play, Square, FileText, Bot, GitBranch, Globe, Code, BoxSelect } from 'lucide-react'
import type { NodeType } from '../types/workflow'

/** 节点组件库 / 右键添加菜单 共用的节点模板（图标 + 名称 + 类型） */
export const NODE_PALETTE_TEMPLATES: { type: NodeType; label: string; icon: typeof Play; color: string }[] = [
  { type: 'startNode', label: '起点', icon: Play, color: 'bg-emerald-500/90' },
  { type: 'endNode', label: '终点', icon: Square, color: 'bg-rose-500/90' },
  { type: 'promptNode', label: '提示词', icon: FileText, color: 'bg-amber-500/90' },
  { type: 'llmNode', label: '大模型', icon: Bot, color: 'bg-violet-500/90' },
  { type: 'conditionNode', label: '条件判断', icon: GitBranch, color: 'bg-blue-500/90' },
  { type: 'httpNode', label: 'HTTP 请求', icon: Globe, color: 'bg-blue-900' },
  { type: 'codeNode', label: '代码节点', icon: Code, color: 'bg-purple-500/90' },
  { type: 'groupNode', label: '框选/注释', icon: BoxSelect, color: 'bg-slate-500/90' },
]
