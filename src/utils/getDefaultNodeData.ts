import type { NodeType } from '../types/workflow'
import type { PromptNodeData, LLMNodeData, ConditionNodeData, HttpNodeData, StartNodeData, CodeNodeData, GroupNodeData } from '../types/workflow'

const CODE_NODE_DEFAULT_TEMPLATE = `function main(args) {
  // args 包含了所有的输入变量
  return { result: args.input };
}`

/** 各节点类型的默认 data，用于新增节点或连线中点插入 */
export function getDefaultNodeData(
  type: NodeType
): Record<string, unknown> | PromptNodeData | LLMNodeData | ConditionNodeData | HttpNodeData | StartNodeData | CodeNodeData | GroupNodeData {
  switch (type) {
    case 'startNode':
      return { params: {} }
    case 'promptNode':
      return { template: '', variables: [] }
    case 'llmNode': {
      const env = typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env as Record<string, string | undefined>)
        : {}
      const defaultBaseUrl = (env.VITE_OPENAI_BASE_URL as string) || ''
      return {
        modelName: 'deepseek-chat',
        temperature: 0.7,
        ...(defaultBaseUrl ? { baseURL: defaultBaseUrl } : {}),
      }
    }
    case 'conditionNode':
      return { variable: 'input', operator: 'contains', value: '' }
    case 'httpNode':
      return { method: 'GET', url: '', headers: '{}', body: '' }
    case 'codeNode':
      return { code: CODE_NODE_DEFAULT_TEMPLATE }
    case 'endNode':
      return {}
    case 'groupNode':
      return { label: '' }
    default:
      return {}
  }
}
