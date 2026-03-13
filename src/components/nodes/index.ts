import type { NodeTypes } from 'reactflow'
import { StartNode } from './StartNode'
import { EndNode } from './EndNode'
import { PromptNode } from './PromptNode'
import { LLMNode } from './LLMNode'
import { ConditionNode } from './ConditionNode'
import { HttpNode } from './HttpNode'
import { CodeNode } from './CodeNode'
import { GroupNode } from './GroupNode'

export const nodeTypes: NodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  promptNode: PromptNode,
  llmNode: LLMNode,
  conditionNode: ConditionNode,
  httpNode: HttpNode,
  codeNode: CodeNode,
  groupNode: GroupNode,
}

export { StartNode, EndNode, PromptNode, LLMNode, ConditionNode, HttpNode, CodeNode, GroupNode }
