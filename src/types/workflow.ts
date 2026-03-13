import type { Node } from 'reactflow'

export type NodeType = 'startNode' | 'promptNode' | 'llmNode' | 'conditionNode' | 'httpNode' | 'codeNode' | 'endNode' | 'groupNode'

/** 节点运行时状态（新） */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

/** 条件判断运算符 */
export type ConditionOperator = '==' | '!=' | 'contains'

/** @deprecated 使用 NodeStatus */
export type RunState = 'idle' | 'running' | 'success'

/** 节点 data 中与执行相关的通用字段 */
export interface NodeRuntimeFields {
  status?: NodeStatus
  runResult?: unknown
  /** 最大重试次数，默认 0（不重试） */
  retryCount?: number
  /** 重试间隔（毫秒），默认 1000 */
  retryInterval?: number
}

export interface PromptNodeData extends NodeRuntimeFields {
  template: string
  variables: string[]
  runState?: RunState
}

/** LLM 响应格式：普通文本 或 强制 JSON 对象 */
export type LLMResponseFormat = 'text' | 'json_object'

export interface LLMNodeData extends NodeRuntimeFields {
  modelName: string
  temperature: number
  /** 可选，不填则使用环境变量 VITE_OPENAI_API_KEY */
  apiKey?: string
  /** 可选，OpenAI 兼容 Base URL，默认 https://api.openai.com */
  baseURL?: string
  /** 响应格式，默认 text；为 json_object 时请求会带 response_format 并隐式追加 JSON 指令 */
  responseFormat?: LLMResponseFormat
  runState?: RunState
}

export interface StartNodeData extends NodeRuntimeFields {
  runState?: RunState
  /** 系统初始入参，键值对对象，由起点节点 Key-Value 表单写入 */
  params?: Record<string, string>
}

export interface EndNodeData extends NodeRuntimeFields {
  runState?: RunState
}

export interface ConditionNodeData extends NodeRuntimeFields {
  /** 待判断变量名，如 input、prompt */
  variable: string
  /** 运算符 */
  operator: ConditionOperator
  /** 对比值（字符串） */
  value: string
  runState?: RunState
}

export type HttpMethod = 'GET' | 'POST'

export interface HttpNodeData extends NodeRuntimeFields {
  method: HttpMethod
  url: string
  /** JSON 字符串，如 {"Content-Type": "application/json"} */
  headers: string
  /** 请求体 JSON 或文本，支持 {{变量}} */
  body: string
  runState?: RunState
}

export interface CodeNodeData extends NodeRuntimeFields {
  /** 用户编写的 main(args) 函数代码，args 为上游合并后的输入 */
  code: string
  runState?: RunState
}

/** 注释/分组框节点：仅作视觉分组，无 Handle，可拖拽调整大小 */
export interface GroupNodeData extends NodeRuntimeFields {
  /** 左上角可编辑的标题/注释文案 */
  label?: string
}

export type WorkflowNode = Node<
  | PromptNodeData
  | LLMNodeData
  | StartNodeData
  | EndNodeData
  | ConditionNodeData
  | HttpNodeData
  | CodeNodeData
  | GroupNodeData
  | Record<string, unknown>
>

/** 单次运行中某节点的快照（用于运行历史日志） */
export interface RunLogNodeDetail {
  nodeId: string
  nodeType?: string
  status: NodeStatus
  /** 前驱合并后的输入 */
  input?: unknown
  /** 该节点输出 runResult */
  output?: unknown
  /** 若 status 为 error 时的错误信息 */
  error?: string
}

/** 单次运行历史记录（不持久化） */
export interface RunLogEntry {
  runId: string
  startTime: number
  endTime: number
  status: 'success' | 'fail'
  /** 各节点执行快照 */
  nodeDetails: RunLogNodeDetail[]
  /** 失败时的错误信息或堆栈 */
  errorMessage?: string
}
