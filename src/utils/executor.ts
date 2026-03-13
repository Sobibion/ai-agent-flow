import type { Node, Edge } from 'reactflow'
import { toast } from 'sonner'
import { streamChatCompletions, DEFAULT_BASE_URL } from '../services/llmService'
import type { NodeStatus, RunLogEntry, RunLogNodeDetail } from '../types/workflow'
import type { ConditionOperator } from '../types/workflow'

export interface RunEngineOptions {
  runId: string
  startTime: number
  /** 全局变量，用于 {{变量}} 回退：上游结果缺失时从此读取 */
  globalVariables?: Record<string, string>
  /** 用于中断执行（停止工作流时 abort） */
  signal?: AbortSignal
  /** 运行时的起点入参覆盖；若提供，StartNode 输出优先使用此对象，否则回退到 node.data.params */
  startParamsOverrides?: Record<string, string>
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  return e instanceof Error && e.name === 'AbortError'
}

function getEnvApiKey(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
  return (env.VITE_OPENAI_API_KEY as string) || ''
}

function getEnvBaseUrl(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
  return (env.VITE_OPENAI_BASE_URL as string) || ''
}

/** 代理后端根地址，用于 HTTP 节点走 /api/proxy 绕过 CORS */
function getProxyBase(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {}
  const base = (env.VITE_API_BASE as string) || ''
  return base.replace(/\/$/, '')
}

/** API Key 优先级：节点表单 -> 全局变量 openaiApiKey -> 环境变量 VITE_OPENAI_API_KEY */
function resolveLLMApiKey(
  nodeApiKey: string | undefined,
  globalVariables?: Record<string, string>
): string {
  const fromNode = nodeApiKey != null ? String(nodeApiKey).trim() : ''
  if (fromNode) return fromNode
  const fromGlobals = globalVariables && globalVariables.openaiApiKey
    ? String(globalVariables.openaiApiKey).trim()
    : ''
  if (fromGlobals) return fromGlobals
  return getEnvApiKey()
}

/** Base URL 优先级：节点表单 -> 环境变量 VITE_OPENAI_BASE_URL -> 默认 https://api.openai.com */
function resolveLLMBaseUrl(nodeBaseURL: string | undefined): string | undefined {
  const fromNode = nodeBaseURL != null ? String(nodeBaseURL).trim() : ''
  if (fromNode) return fromNode
  const fromEnv = getEnvBaseUrl()
  if (fromEnv) return fromEnv
  return undefined
}

/** 邻接表：节点 id -> 后继节点 id 列表 */
export type AdjacencyList = Map<string, string[]>

/** 入度表：节点 id -> 入度 */
export type InDegreeMap = Map<string, number>

/** 执行引擎所需的 Store 方法 */
export interface StoreActions {
  updateNodeStatus: (id: string, status: NodeStatus, result?: unknown) => void
  updateEdgeAnimation: (edgeId: string, animated: boolean) => void
  setStreamingPayload: (payload: string | null) => void
}

export class WorkflowExecutionError extends Error {
  nodeId?: string
  constructor(message: string, nodeId?: string) {
    super(message)
    this.name = 'WorkflowExecutionError'
    this.nodeId = nodeId
  }
}

/** 单节点运行时缺少 Mock 变量时抛出，便于 UI 弹出对话框收集 */
export class MissingVariablesError extends Error {
  missing: string[]
  constructor(missing: string[]) {
    super(`缺少变量: ${missing.join(', ')}`)
    this.name = 'MissingVariablesError'
    this.missing = missing
  }
}

const VARIABLE_REGEX = /\{\{([^{}]+)\}\}/g

/** 从 template 中提取 {{var}} 并用 values 替换，缺省用默认值 */
function fillTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(VARIABLE_REGEX, (_, name: string) => {
    const key = name.trim()
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const v = values[key]
      return typeof v === 'string' ? v : String(v)
    }
    return `{{${key}}}`
  })
}

/** 检查是否仍有未替换的变量 */
function hasUnfilledVariables(text: string): boolean {
  return /\{\{[^{}]+\}\}/.test(text)
}

/** 从模板字符串中提取 {{var}} 变量名列表（去重） */
function getTemplateVariableNames(template: string): string[] {
  const names = new Set<string>()
  let m: RegExpExecArray | null = null
  const re = new RegExp(VARIABLE_REGEX.source, 'g')
  while ((m = re.exec(template)) !== null) {
    const key = m[1].trim()
    if (key) names.add(key)
  }
  return Array.from(names)
}

/** 给定多个模板与 values，返回仍缺失的变量名 */
function getMissingVariableNames(
  templates: string[],
  values: Record<string, unknown>
): string[] {
  const missing = new Set<string>()
  for (const t of templates) {
    for (const name of getTemplateVariableNames(t)) {
      if (!Object.prototype.hasOwnProperty.call(values, name) || values[name] === '' || values[name] == null) {
        missing.add(name)
      }
    }
  }
  return Array.from(missing)
}

/** 合并全局变量与上游结果，供 fillTemplate 使用：先铺底 globalVariables，再被 upstream 覆盖，保证上游没有的 key 一定从全局变量读取 */
function mergeWithGlobalVariables(
  upstream: Record<string, unknown>,
  globalVariables?: Record<string, string>
): Record<string, unknown> {
  const globals = globalVariables ? (globalVariables as Record<string, unknown>) : {}
  return { ...globals, ...upstream }
}

/** 将嵌套对象压平为点号路径键，用于支持 {{nodeId.output.text}} 等命名空间变量 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === '[object Object]'
    ) {
      Object.assign(out, flattenObject(value as Record<string, unknown>, path))
    } else {
      out[path] = value
    }
  }
  return out
}

/**
 * 构建 fillTemplate 可用的完整 values：合并上游 + 全局变量 + 各节点命名空间（nodeId.path）。
 * 支持模板中的 {{nodeId.field}} 或 {{nodeId.output.text}} 精准取自对应节点的 runResult。
 */
function buildValuesForTemplate(
  upstream: Record<string, unknown>,
  results: Map<string, unknown>,
  globalVariables?: Record<string, string>
): Record<string, unknown> {
  const merged = mergeWithGlobalVariables(upstream, globalVariables)
  for (const [nodeId, result] of results) {
    if (result != null && typeof result === 'object' && !Array.isArray(result)) {
      const flat = flattenObject(result as Record<string, unknown>)
      for (const [path, val] of Object.entries(flat)) {
        merged[`${nodeId}.${path}`] = val
      }
    }
  }
  return merged
}

function findStartNode(nodes: Node[]): Node | null {
  const n = nodes.find((node) => node.type === 'startNode')
  return n ? n : null
}

function findEndNodes(nodes: Node[]): Node[] {
  return nodes.filter((node) => node.type === 'endNode')
}

/** 从 startId 出发 BFS 得到可达节点 id 集合 */
function getReachableIds(startId: string, edges: Edge[]): Set<string> {
  const outEdges: AdjacencyList = new Map()
  for (const e of edges) {
    const list = outEdges.get(e.source) || []
    list.push(e.target)
    outEdges.set(e.source, list)
  }
  const reachable = new Set<string>()
  const queue = [startId]
  reachable.add(startId)
  while (queue.length > 0) {
    const cur = queue.shift() as string
    const nexts = outEdges.get(cur) || []
    for (const n of nexts) {
      if (!reachable.has(n)) {
        reachable.add(n)
        queue.push(n)
      }
    }
  }
  return reachable
}

/**
 * Kahn 拓扑排序（仅在 reachable 子图上），并检测环。
 * 若存在环则返回 { order: [], hasCycle: true }。
 */
function topologicalSort(
  reachableIds: Set<string>,
  edges: Edge[]
): { order: string[]; hasCycle: boolean } {
  const inDegree: InDegreeMap = new Map()
  const outEdges: AdjacencyList = new Map()

  for (const id of reachableIds) {
    inDegree.set(id, 0)
  }
  for (const e of edges) {
    if (!reachableIds.has(e.source) || !reachableIds.has(e.target)) continue
    const list = outEdges.get(e.source) || []
    list.push(e.target)
    outEdges.set(e.source, list)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  }

  const queue: string[] = []
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id)
  })
  const order: string[] = []
  while (queue.length > 0) {
    const cur = queue.shift() as string
    order.push(cur)
    const nexts = outEdges.get(cur) || []
    for (const n of nexts) {
      const d = (inDegree.get(n) || 0) - 1
      inDegree.set(n, d)
      if (d === 0) queue.push(n)
    }
  }

  const hasCycle = order.length < reachableIds.size
  return { order: hasCycle ? [] : order, hasCycle }
}

/** 获取指向 nodeId 的边 */
function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.target === nodeId)
}

/** 从 nodeId 指出的边（仅 reachable 内），用于释放后继 */
function getOutgoingEdges(
  nodeId: string,
  edges: Edge[],
  reachableIds: Set<string>
): { target: string; sourceHandle?: string }[] {
  return edges
    .filter((e) => e.source === nodeId && reachableIds.has(e.target))
    .map((e) => ({ target: e.target, sourceHandle: e.sourceHandle != null ? e.sourceHandle : undefined }))
}

/** 获取 nodeId 的所有前驱节点 id（已按执行顺序执行完毕，其 runResult 在 results 中） */
function getPredecessorResults(nodeId: string, edges: Edge[], results: Map<string, unknown>): Record<string, unknown> {
  const incoming = getIncomingEdges(nodeId, edges)
  const merged: Record<string, unknown> = {}
  for (const e of incoming) {
    const predResult = results.get(e.source)
    if (predResult != null && typeof predResult === 'object' && !Array.isArray(predResult)) {
      Object.assign(merged, predResult as Record<string, unknown>)
    }
  }
  return merged
}

/** 条件节点配置 */
type ConditionConfig = {
  variable: string
  operator: ConditionOperator
  value: string
}

function evaluateCondition(upstream: Record<string, unknown>, config: ConditionConfig): boolean {
  const raw = upstream[config.variable]
  const str = typeof raw === 'string' ? raw : (raw != null ? String(raw) : '')
  const target = config.value
  switch (config.operator) {
    case '==':
      return str === target
    case '!=':
      return str !== target
    case 'contains':
      return str.indexOf(target) !== -1
    default:
      return false
  }
}

/**
 * 判断节点是否在当前分支上：若某条入边来自条件节点，则该边的 sourceHandle 必须与条件结果一致；
 * 若有任一前驱在 skippedNodes 中，则不在活跃分支。
 */
function isNodeOnActiveBranch(
  nodeId: string,
  edges: Edge[],
  nodeMap: Map<string, Node>,
  results: Map<string, unknown>,
  skippedNodes: Set<string>
): boolean {
  const incoming = getIncomingEdges(nodeId, edges)
  for (const e of incoming) {
    if (skippedNodes.has(e.source)) return false
    const sourceNode = nodeMap.get(e.source)
    if (sourceNode && (sourceNode.type as string) === 'conditionNode') {
      const condResult = results.get(e.source)
      if (condResult == null || typeof condResult !== 'object' || !('branch' in condResult)) return false
      const branch = (condResult as { branch: boolean }).branch
      const handleMatch = (branch === true && e.sourceHandle === 'true') || (branch === false && e.sourceHandle === 'false')
      if (!handleMatch) return false
    }
  }
  return true
}

/** 延迟指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * 执行单个节点（只读 results，不写；出错时在重试耗尽后更新节点状态并 throw）。
 * 不负责 running/success 状态与边动画，由调用方统一处理整批。
 * LLM/HTTP 节点支持按 data.retryCount、data.retryInterval 自动重试。
 */
async function runOneNode(
  nodeId: string,
  node: Node,
  edges: Edge[],
  _nodeMap: Map<string, Node>,
  results: Map<string, unknown>,
  storeActions: StoreActions,
  globalVariables?: Record<string, string>,
  signal?: AbortSignal,
  /** 单节点运行时传入，覆盖从 results 计算的上游结果 */
  overrideUpstream?: Record<string, unknown>,
  /** 仅当本节点为 StartNode 时生效：优先使用此入参，否则回退到 node.data.params */
  startParamsOverrides?: Record<string, string>
): Promise<unknown> {
  const { updateNodeStatus, setStreamingPayload } = storeActions
  const type = node.type as string
  const getUpstream = (): Record<string, unknown> =>
    overrideUpstream != null ? overrideUpstream : getPredecessorResults(nodeId, edges, results)
  const getValuesForTemplate = (): Record<string, unknown> =>
    buildValuesForTemplate(getUpstream(), results, globalVariables)
  const dataWithRetry = node.data as { retryCount?: number; retryInterval?: number }
  const maxRetries = Math.max(0, typeof dataWithRetry.retryCount === 'number' ? dataWithRetry.retryCount : 0)
  const retryIntervalMs = typeof dataWithRetry.retryInterval === 'number' && dataWithRetry.retryInterval >= 0
    ? dataWithRetry.retryInterval
    : 1000
  const isRetryable = type === 'llmNode' || type === 'httpNode'

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let runResult: unknown

      if (type === 'startNode') {
        const fromOverrides = startParamsOverrides != null && typeof startParamsOverrides === 'object'
        const params = node.data && (node.data as { params?: Record<string, unknown> }).params
        const fallback = params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, string> : {}
        runResult = fromOverrides ? startParamsOverrides : fallback
      } else if (type === 'promptNode') {
        const template = (node.data && (node.data as { template?: string }).template) ? (node.data as { template: string }).template : ''
        const filled = fillTemplate(template, getValuesForTemplate())
        if (hasUnfilledVariables(filled)) {
          throw new WorkflowExecutionError(
            `Prompt 节点存在未提供值的变量，请检查上游节点输出、全局环境变量或模板中的 {{变量名}}。`,
            nodeId
          )
        }
        runResult = { prompt: filled }
      } else if (type === 'llmNode') {
        const upstream = getUpstream()
        const prompt = (upstream.prompt as string) || (upstream.input as string) || ''
        const data = node.data as { modelName?: string; temperature?: number; apiKey?: string; baseURL?: string; responseFormat?: 'text' | 'json_object' }
        const modelName = (data && data.modelName) ? data.modelName : 'deepseek-chat'
        const temperature = typeof (data && data.temperature) === 'number' ? data.temperature : 0.7
        const responseFormat = (data && data.responseFormat) === 'json_object' ? 'json_object' : 'text'
        const apiKey = resolveLLMApiKey(data?.apiKey, globalVariables)
        const baseURL = resolveLLMBaseUrl(data?.baseURL) || DEFAULT_BASE_URL
        try {
          let fullResponse = ''
          setStreamingPayload('')
          for await (const accumulated of streamChatCompletions({
            apiKey,
            baseURL,
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            responseFormat,
            signal,
          })) {
            fullResponse = accumulated
            setStreamingPayload(accumulated)
          }
          runResult = { response: fullResponse }
          setStreamingPayload(null)
        } catch (err) {
          if (isAbortError(err)) {
            updateNodeStatus(nodeId, 'error')
            throw err
          }
          const isFailedFetch = err instanceof TypeError && err.message === 'Failed to fetch'
          if (isFailedFetch) {
            const friendlyMessage = '网络请求失败，请检查 Base URL 是否正确，或该大模型接口不支持浏览器跨域直连'
            toast.error(friendlyMessage)
            throw new WorkflowExecutionError(friendlyMessage, nodeId)
          }
          const message = err instanceof Error ? err.message : 'LLM 请求失败'
          throw new WorkflowExecutionError(message, nodeId)
        }
      } else if (type === 'conditionNode') {
        const upstream = getUpstream()
        const data = node.data as { variable?: string; operator?: ConditionOperator; value?: string }
        const variable = (data && data.variable) ? data.variable : 'input'
        const operator = (data && data.operator) ? data.operator : 'contains'
        const value = (data && data.value) != null ? String(data.value) : ''
        const branch = evaluateCondition(upstream, { variable, operator, value })
        runResult = { branch }
      } else if (type === 'httpNode') {
        const data = node.data as { method?: string; url?: string; headers?: string; body?: string }
        const method = (data && data.method) === 'POST' ? 'POST' : 'GET'
        const urlRaw = (data && data.url) != null ? String(data.url) : ''
        const headersRaw = (data && data.headers) != null ? String(data.headers) : '{}'
        const bodyRaw = (data && data.body) != null ? String(data.body) : ''
        const filledUrl = fillTemplate(urlRaw, getValuesForTemplate())
        if (hasUnfilledVariables(filledUrl)) {
          throw new WorkflowExecutionError(
            'HTTP 节点 URL 存在未提供值的变量，请检查上游输出、全局环境变量或 {{变量名}}。',
            nodeId
          )
        }
        const filledBody = method === 'POST' ? fillTemplate(bodyRaw, getValuesForTemplate()) : ''
        if (method === 'POST' && hasUnfilledVariables(filledBody)) {
          throw new WorkflowExecutionError(
            'HTTP 节点 Body 存在未提供值的变量，请检查上游输出、全局环境变量或 {{变量名}}。',
            nodeId
          )
        }
        let headersObj: Record<string, string> = {}
        try {
          const trimmed = headersRaw.trim()
          if (trimmed) {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              headersObj = Object.fromEntries(
                Object.entries(parsed).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
              )
            }
          }
        } catch {
          headersObj = {}
        }
        const proxyUrl = `${getProxyBase()}/api/proxy`
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            url: filledUrl,
            headers: headersObj,
            body: method === 'POST' && filledBody ? filledBody : undefined,
          }),
          signal,
        })
        const proxyJson = (await proxyRes.json()) as {
          status?: number
          statusText?: string
          data?: unknown
          error?: string
        }
        if (!proxyRes.ok || proxyJson.error) {
          const msg = proxyJson.error || `代理请求失败: ${proxyRes.status} ${proxyRes.statusText}`
          throw new WorkflowExecutionError(msg, nodeId)
        }
        const status = proxyJson.status || 0
        const responseData = proxyJson.data
        if (status >= 400) {
          throw new WorkflowExecutionError(
            `HTTP 请求失败: ${status} ${proxyJson.statusText || ''}`,
            nodeId
          )
        }
        runResult = { response: responseData, status }
      } else if (type === 'codeNode') {
        const upstream = getUpstream()
        const data = node.data as { code?: string }
        const codeStr = (data && data.code) != null ? String(data.code) : ''
        try {
          const fn = new Function(
            'args',
            codeStr + '; return typeof main === "function" ? main(args) : {};'
          )
          const raw = fn(upstream)
          runResult =
            raw != null && typeof raw === 'object' && !Array.isArray(raw)
              ? raw
              : { result: raw }
        } catch (err) {
          const message = err instanceof Error ? err.message : '代码节点执行异常'
          throw new WorkflowExecutionError(message, nodeId)
        }
      } else if (type === 'endNode') {
        const upstream = getUpstream()
        runResult = upstream
      } else {
        runResult = undefined
      }

      return runResult
    } catch (e) {
      if (isAbortError(e)) {
        updateNodeStatus(nodeId, 'error')
        throw e
      }
      if (isRetryable && attempt < maxRetries) {
        toast.warning(`节点 ${nodeId} 正在进行第 ${attempt + 1} 次重试`)
        await delay(retryIntervalMs)
      } else {
        updateNodeStatus(nodeId, 'error')
        if (e instanceof WorkflowExecutionError) {
          toast.error(e.message)
        }
        throw e
      }
    }
  }

  return undefined as unknown
}

/**
 * 真实 DAG 执行引擎：校验 -> 拓扑序 -> 按批并发执行并流转数据。
 * 每批为当前入度为 0 的节点，Promise.all 并发；完成后释放后继，保留条件分支剪枝。
 * 若传入 options（runId, startTime），成功结束时返回 RunLogEntry 用于运行历史日志。
 */
export async function runWorkflowEngine(
  nodes: Node[],
  edges: Edge[],
  storeActions: StoreActions,
  options?: RunEngineOptions
): Promise<RunLogEntry | void> {
  const { updateNodeStatus, updateEdgeAnimation } = storeActions
  /** 用于运行日志快照：记录每个节点的最终 status */
  const nodeStatusMap = new Map<string, NodeStatus>()

  const startNode = findStartNode(nodes)
  if (!startNode) {
    throw new WorkflowExecutionError('未找到起点节点（Start Node），请添加后再运行。')
  }

  const endNodes = findEndNodes(nodes)
  if (endNodes.length === 0) {
    throw new WorkflowExecutionError('未找到终点节点（End Node），请添加后再运行。')
  }

  const reachable = getReachableIds(startNode.id, edges)
  const { order, hasCycle } = topologicalSort(reachable, edges)

  if (hasCycle) {
    throw new WorkflowExecutionError('工作流存在环（Cycle），无法执行。请检查连线。')
  }

  if (order.length === 0) {
    throw new WorkflowExecutionError('无法得到有效的执行顺序，请检查画布连线。')
  }

  const nodeMap = new Map<string, Node>()
  nodes.forEach((n) => nodeMap.set(n.id, n))
  const results = new Map<string, unknown>()

  // 入度表（用于并行批次的“就绪”判断），仅 reachable 子图
  const pendingCount = new Map<string, number>()
  reachable.forEach((id) => pendingCount.set(id, 0))
  edges.forEach((e) => {
    if (reachable.has(e.source) && reachable.has(e.target)) {
      pendingCount.set(e.target, (pendingCount.get(e.target) || 0) + 1)
    }
  })

  // 出边表：节点 id -> { target, sourceHandle }[]，用于释放后继
  const outEdgesMap = new Map<string, { target: string; sourceHandle?: string }[]>()
  reachable.forEach((id) => {
    outEdgesMap.set(id, getOutgoingEdges(id, edges, reachable))
  })

  const skippedNodes = new Set<string>()

  function releaseSuccessors(
    nodeId: string,
    _result: unknown,
    isCondition: boolean,
    branch?: boolean
  ): void {
    const outEdges = outEdgesMap.get(nodeId) || []
    for (const { target, sourceHandle } of outEdges) {
      if (isCondition && typeof branch === 'boolean') {
        const match = (branch === true && sourceHandle === 'true') || (branch === false && sourceHandle === 'false')
        if (match) {
          pendingCount.set(target, Math.max(0, (pendingCount.get(target) || 0) - 1))
        } else {
          if (!skippedNodes.has(target)) {
            skippedNodes.add(target)
            nodeStatusMap.set(target, 'skipped')
            updateNodeStatus(target, 'skipped')
            const nextOut = outEdgesMap.get(target) || []
            for (const { target: t } of nextOut) {
              pendingCount.set(t, Math.max(0, (pendingCount.get(t) || 0) - 1))
            }
          }
        }
      } else {
        pendingCount.set(target, Math.max(0, (pendingCount.get(target) || 0) - 1))
      }
    }
  }

  let firstRejection: unknown = null
  const signal = options?.signal
  let executionAborted = false

  while (true) {
    if (signal?.aborted) break
    let ready = Array.from(reachable).filter(
      (id) => (pendingCount.get(id) || 0) === 0 && !results.has(id) && !skippedNodes.has(id)
    )

    // 级联剪枝：就绪但不在活跃分支的节点标记为 skipped 并释放其后继
    let changed = true
    while (changed) {
      changed = false
      const nextReady: string[] = []
      for (const id of ready) {
        if (!isNodeOnActiveBranch(id, edges, nodeMap, results, skippedNodes)) {
          skippedNodes.add(id)
          nodeStatusMap.set(id, 'skipped')
          updateNodeStatus(id, 'skipped')
          const outEdges = outEdgesMap.get(id) || []
          for (const { target } of outEdges) {
            pendingCount.set(target, Math.max(0, (pendingCount.get(target) || 0) - 1))
          }
          changed = true
        } else {
          nextReady.push(id)
        }
      }
      ready = nextReady
    }

    if (ready.length === 0) break

    const batch = ready
    const batchNodes = batch.map((id) => nodeMap.get(id)!).filter(Boolean)
    if (batchNodes.length !== batch.length) continue

    // 本批统一置为 running 并开启动画，避免竞态
    for (const nodeId of batch) {
      const incoming = getIncomingEdges(nodeId, edges)
      for (const e of incoming) updateEdgeAnimation(e.id, true)
      nodeStatusMap.set(nodeId, 'running')
      updateNodeStatus(nodeId, 'running')
    }

    const promises = batch.map((id) =>
      runOneNode(
        id,
        nodeMap.get(id)!,
        edges,
        nodeMap,
        results,
        storeActions,
        options?.globalVariables,
        signal,
        undefined,
        id === startNode.id ? options?.startParamsOverrides : undefined
      )
    )
    const outcomes = await Promise.allSettled(promises)

    // 本批统一关闭边动画
    for (const nodeId of batch) {
      const incoming = getIncomingEdges(nodeId, edges)
      for (const e of incoming) updateEdgeAnimation(e.id, false)
    }

    for (let i = 0; i < batch.length; i++) {
      const nodeId = batch[i]
      const outcome = outcomes[i]
      const node = nodeMap.get(nodeId)!
      const isCondition = (node.type as string) === 'conditionNode'

      if (outcome.status === 'fulfilled') {
        const value = outcome.value
        results.set(nodeId, value)
        nodeStatusMap.set(nodeId, 'success')
        updateNodeStatus(nodeId, 'success', value)
        const branch = isCondition && value != null && typeof value === 'object' && 'branch' in value
          ? (value as { branch: boolean }).branch
          : undefined
        releaseSuccessors(nodeId, value, isCondition, branch)
      } else {
        nodeStatusMap.set(nodeId, 'error')
        if (firstRejection == null) firstRejection = outcome.reason
        if (isAbortError(outcome.reason)) executionAborted = true
        releaseSuccessors(nodeId, undefined, false)
      }
    }

    if (executionAborted) break
    if (firstRejection != null) {
      throw firstRejection instanceof Error ? firstRejection : new WorkflowExecutionError(String(firstRejection))
    }
  }

  if (executionAborted || signal?.aborted) {
    const { setStreamingPayload: clearStreaming } = storeActions
    clearStreaming(null)
    toast.info('工作流已被手动终止')
    return
  }

  toast.success('工作流执行完毕')

  if (options) {
    const endTime = Date.now()
    const nodeDetails: RunLogNodeDetail[] = order.map((nodeId) => {
      const node = nodeMap.get(nodeId)
      const status = nodeStatusMap.get(nodeId) || 'idle'
      const input = getPredecessorResults(nodeId, edges, results)
      const output = results.get(nodeId)
      return {
        nodeId,
        nodeType: node?.type as string | undefined,
        status,
        input: Object.keys(input).length > 0 ? input : undefined,
        output,
      }
    })
    return {
      runId: options.runId,
      startTime: options.startTime,
      endTime,
      status: 'success',
      nodeDetails,
    }
  }
}

export interface SingleNodeRunOptions {
  /** 全局变量，用于 {{变量}} 回退 */
  globalVariables?: Record<string, string>
  /** 用户手动填写的 Mock 变量，用于补全未解析的 {{变量}} */
  mockVariables?: Record<string, string>
  signal?: AbortSignal
}

const SINGLE_RUNNABLE_TYPES = ['llmNode', 'httpNode', 'promptNode', 'conditionNode', 'codeNode'] as const

/**
 * 单节点局部运行：忽略拓扑，仅执行目标节点；依赖的 {{变量}} 由上游客栈或 mockVariables 提供。
 * 若存在未解析变量且未传 mockVariables，抛出 MissingVariablesError(missing) 供 UI 弹窗收集。
 * 成功后更新节点 runResult，不写入 runLogs；调用方可用 toast 提示并打开 DebugDrawer。
 */
export async function runSingleNode(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  storeActions: StoreActions,
  options?: SingleNodeRunOptions
): Promise<unknown> {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) {
    throw new WorkflowExecutionError('未找到节点', nodeId)
  }
  const type = node.type as string
  if (!SINGLE_RUNNABLE_TYPES.includes(type as (typeof SINGLE_RUNNABLE_TYPES)[number])) {
    throw new WorkflowExecutionError('该节点类型不支持单步运行', nodeId)
  }

  const incoming = getIncomingEdges(nodeId, edges)
  const upstreamFromStore: Record<string, unknown> = {}
  for (const e of incoming) {
    const pred = nodes.find((n) => n.id === e.source)
    const runResult = pred?.data && typeof pred.data === 'object' && 'runResult' in pred.data
      ? (pred.data as { runResult?: unknown }).runResult
      : undefined
    if (runResult != null && typeof runResult === 'object' && !Array.isArray(runResult)) {
      Object.assign(upstreamFromStore, runResult as Record<string, unknown>)
    }
  }
  let finalValues = mergeWithGlobalVariables(upstreamFromStore, options?.globalVariables)
  if (options?.mockVariables && Object.keys(options.mockVariables).length > 0) {
    finalValues = { ...finalValues, ...options.mockVariables }
  }

  const templates: string[] = []
  if (type === 'promptNode') {
    const template = (node.data && (node.data as { template?: string }).template)
      ? (node.data as { template: string }).template
      : ''
    templates.push(template)
  } else if (type === 'llmNode') {
    const prompt = (finalValues.prompt as string) || (finalValues.input as string) || ''
    templates.push(prompt)
  } else if (type === 'httpNode') {
    const data = node.data as { method?: string; url?: string; body?: string }
    const method = (data && data.method) === 'POST' ? 'POST' : 'GET'
    if ((data && data.url) != null) templates.push(String(data.url))
    if (method === 'POST' && (data && data.body) != null) templates.push(String(data.body))
  }

  let missing: string[] = []
  if (type === 'conditionNode') {
    const data = node.data as { variable?: string }
    const variable = (data && data.variable) ? data.variable : 'input'
    if (!Object.prototype.hasOwnProperty.call(finalValues, variable) || finalValues[variable] === '' || finalValues[variable] == null) {
      missing = [variable]
    }
  } else {
    missing = getMissingVariableNames(templates, finalValues)
  }

  if (missing.length > 0) {
    throw new MissingVariablesError(missing)
  }

  const { updateNodeStatus, setStreamingPayload } = storeActions
  updateNodeStatus(nodeId, 'running')
  const nodeMap = new Map<string, Node>()
  nodes.forEach((n) => nodeMap.set(n.id, n))
  const results = new Map<string, unknown>()

  try {
    const result = await runOneNode(
      nodeId,
      node,
      edges,
      nodeMap,
      results,
      storeActions,
      options?.globalVariables,
      options?.signal,
      finalValues
    )
    updateNodeStatus(nodeId, 'success', result)
    setStreamingPayload(null)
    return result
  } catch (e) {
    updateNodeStatus(nodeId, 'error')
    setStreamingPayload(null)
    throw e
  }
}
