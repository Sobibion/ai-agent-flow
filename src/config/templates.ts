import type { Node, Edge } from 'reactflow'
import type { LucideIcon } from 'lucide-react'
import { FileText, Newspaper, MessageCircle, Database, Languages, MessageSquareWarning } from 'lucide-react'
import type { ConditionOperator } from '../types/workflow'

/**
 * 工作流模板：预编排的 nodes + edges，用于「经典模板」一键应用。
 */
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: LucideIcon
  nodes: Node[]
  edges: Edge[]
}

// ========== 模板一：小红书爆款文案流 ==========
// Start (输入商品名) -> Prompt (小红书爆款公式) -> LLM (生成文本) -> End
const template1Nodes: Node[] = [
  {
    id: 't1-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: {},
  },
  {
    id: 't1-prompt',
    type: 'promptNode',
    position: { x: 120, y: 220 },
    data: {
      template: '请为商品「{{input}}」撰写小红书爆款文案。\n要求：\n1. 吸引眼球的标题（可带 Emoji）\n2. 开头 3 句内制造情感共鸣\n3. 正文突出卖点与使用场景\n4. 结尾引导互动（点赞/收藏/评论）',
      variables: ['input'],
    },
  },
  {
    id: 't1-llm',
    type: 'llmNode',
    position: { x: 120, y: 420 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.8,
    },
  },
  {
    id: 't1-end',
    type: 'endNode',
    position: { x: 120, y: 600 },
    data: {},
  },
]
const template1Edges: Edge[] = [
  { id: 't1-e1', source: 't1-start', target: 't1-prompt' },
  { id: 't1-e2', source: 't1-prompt', target: 't1-llm' },
  { id: 't1-e3', source: 't1-llm', target: 't1-end' },
]

// ========== 模板二：每日新闻总结提取 ==========
// Start -> HTTP (GET 每日新闻) -> Prompt (总结 3 条要点) -> LLM -> End
const template2Nodes: Node[] = [
  {
    id: 't2-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: {},
  },
  {
    id: 't2-http',
    type: 'httpNode',
    position: { x: 120, y: 220 },
    data: {
      method: 'GET',
      url: 'https://api.hnpwa.com/v0/news/1.json',
      headers: '{}',
      body: '',
    },
  },
  {
    id: 't2-prompt',
    type: 'promptNode',
    position: { x: 120, y: 400 },
    data: {
      template: '根据以下新闻列表内容，总结成 3 条要点（每条一句话），便于快速浏览：\n\n{{response}}',
      variables: ['response'],
    },
  },
  {
    id: 't2-llm',
    type: 'llmNode',
    position: { x: 120, y: 560 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.5,
    },
  },
  {
    id: 't2-end',
    type: 'endNode',
    position: { x: 120, y: 720 },
    data: {},
  },
]
const template2Edges: Edge[] = [
  { id: 't2-e1', source: 't2-start', target: 't2-http' },
  { id: 't2-e2', source: 't2-http', target: 't2-prompt' },
  { id: 't2-e3', source: 't2-prompt', target: 't2-llm' },
  { id: 't2-e4', source: 't2-llm', target: 't2-end' },
]

// ========== 模板三：智能客服意图路由 ==========
// Start (用户咨询) -> Prompt (提取意图) -> LLM -> Condition (售后/售前)
//   -> [true] End (转人工) / [false] LLM (知识库回复) -> End
const template3Nodes: Node[] = [
  {
    id: 't3-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: {},
  },
  {
    id: 't3-prompt',
    type: 'promptNode',
    position: { x: 120, y: 220 },
    data: {
      template: '用户咨询内容：\n{{input}}\n\n请仅输出一个词表示意图：若为售后问题（退换货、投诉、故障等）输出「售后」；若为售前咨询（产品介绍、价格、购买方式等）输出「售前」。',
      variables: ['input'],
    },
  },
  {
    id: 't3-llm',
    type: 'llmNode',
    position: { x: 120, y: 380 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.2,
    },
  },
  {
    id: 't3-condition',
    type: 'conditionNode',
    position: { x: 120, y: 540 },
    data: {
      variable: 'response',
      operator: 'contains' as ConditionOperator,
      value: '售后',
    },
  },
  {
    id: 't3-end-true',
    type: 'endNode',
    position: { x: 80, y: 700 },
    data: {},
  },
  {
    id: 't3-llm-kb',
    type: 'llmNode',
    position: { x: 320, y: 700 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.6,
    },
  },
  {
    id: 't3-end-false',
    type: 'endNode',
    position: { x: 320, y: 860 },
    data: {},
  },
]
const template3Edges: Edge[] = [
  { id: 't3-e1', source: 't3-start', target: 't3-prompt' },
  { id: 't3-e2', source: 't3-prompt', target: 't3-llm' },
  { id: 't3-e3', source: 't3-llm', target: 't3-condition' },
  { id: 't3-e4-true', source: 't3-condition', target: 't3-end-true', sourceHandle: 'true' },
  { id: 't3-e4-false', source: 't3-condition', target: 't3-llm-kb', sourceHandle: 'false' },
  { id: 't3-e5', source: 't3-llm-kb', target: 't3-end-false' },
]

// ========== 模板四：非结构化文本转 JSON（数据清洗）==========
// Start (输入杂乱文本) -> Prompt (提取姓名、电话、核心意图，严格输出 JSON) -> LLM (温度 0.1) -> End
const template4Nodes: Node[] = [
  {
    id: 't4-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: { params: {} },
  },
  {
    id: 't4-prompt',
    type: 'promptNode',
    position: { x: 120, y: 220 },
    data: {
      template: '从以下非结构化文本中提取核心字段，严格以 JSON 格式输出，且仅输出一个合法 JSON 对象，不要其他说明。\n要求字段：name（姓名）、phone（电话）、intent（核心意图）。若某字段无法从文本中识别，该字段值为空字符串。\n\n文本：\n{{input}}',
      variables: ['input'],
    },
  },
  {
    id: 't4-llm',
    type: 'llmNode',
    position: { x: 120, y: 420 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.1,
    },
  },
  {
    id: 't4-end',
    type: 'endNode',
    position: { x: 120, y: 600 },
    data: {},
  },
]
const template4Edges: Edge[] = [
  { id: 't4-e1', source: 't4-start', target: 't4-prompt' },
  { id: 't4-e2', source: 't4-prompt', target: 't4-llm' },
  { id: 't4-e3', source: 't4-llm', target: 't4-end' },
]

// ========== 模板五：沉浸式外语翻译与精细润色 ==========
// Start (外文原文) -> Prompt (直译要求) -> LLM_1 (直译) -> Prompt (母语化润色+排版) -> LLM_2 -> End
const template5Nodes: Node[] = [
  {
    id: 't5-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: { params: {} },
  },
  {
    id: 't5-prompt1',
    type: 'promptNode',
    position: { x: 120, y: 220 },
    data: {
      template: '请将以下内容精准直译为中文，仅输出译文正文，不要解释或补充：\n\n{{input}}',
      variables: ['input'],
    },
  },
  {
    id: 't5-llm1',
    type: 'llmNode',
    position: { x: 120, y: 380 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.3,
    },
  },
  {
    id: 't5-prompt2',
    type: 'promptNode',
    position: { x: 120, y: 540 },
    data: {
      template: '请将以下直译内容进行母语级润色与排版优化。要求：\n1. 符合目标语言表达习惯，自然流畅\n2. 优化段落与标点，便于阅读\n3. 仅输出润色后的正文，不要解释\n\n直译内容：\n{{response}}',
      variables: ['response'],
    },
  },
  {
    id: 't5-llm2',
    type: 'llmNode',
    position: { x: 120, y: 700 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.5,
    },
  },
  {
    id: 't5-end',
    type: 'endNode',
    position: { x: 120, y: 860 },
    data: {},
  },
]
const template5Edges: Edge[] = [
  { id: 't5-e1', source: 't5-start', target: 't5-prompt1' },
  { id: 't5-e2', source: 't5-prompt1', target: 't5-llm1' },
  { id: 't5-e3', source: 't5-llm1', target: 't5-prompt2' },
  { id: 't5-e4', source: 't5-prompt2', target: 't5-llm2' },
  { id: 't5-e5', source: 't5-llm2', target: 't5-end' },
]

// ========== 模板六：客户客诉情感分析与自动打标 ==========
// Start (客户反馈) -> Prompt (仅输出正面/负面) -> LLM -> Condition (包含"负面")
//   -> [True] Prompt (安抚话术) -> LLM_负面 -> End_负面；[False] End_好评
const template6Nodes: Node[] = [
  {
    id: 't6-start',
    type: 'startNode',
    position: { x: 120, y: 80 },
    data: { params: {} },
  },
  {
    id: 't6-prompt1',
    type: 'promptNode',
    position: { x: 120, y: 220 },
    data: {
      template: '请根据以下客户反馈内容，仅输出一个词表示情感倾向：若为负面、投诉、不满则输出「负面」；若为正面、表扬、满意则输出「正面」。不要输出其他内容。\n\n客户反馈：\n{{input}}',
      variables: ['input'],
    },
  },
  {
    id: 't6-llm',
    type: 'llmNode',
    position: { x: 120, y: 380 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.2,
    },
  },
  {
    id: 't6-condition',
    type: 'conditionNode',
    position: { x: 120, y: 540 },
    data: {
      variable: 'response',
      operator: 'contains' as ConditionOperator,
      value: '负面',
    },
  },
  {
    id: 't6-prompt2',
    type: 'promptNode',
    position: { x: 80, y: 700 },
    data: {
      template: '客户反馈已被判定为负面投诉。请生成一段客服安抚话术与应对策略，需包含：1. 致歉与共情 2. 解决方案或后续跟进承诺 3. 语气诚恳、专业。仅输出话术内容，不要解释。',
      variables: [],
    },
  },
  {
    id: 't6-llm-neg',
    type: 'llmNode',
    position: { x: 80, y: 860 },
    data: {
      modelName: 'deepseek-chat',
      temperature: 0.5,
    },
  },
  {
    id: 't6-end-neg',
    type: 'endNode',
    position: { x: 80, y: 1020 },
    data: {},
  },
  {
    id: 't6-end-pos',
    type: 'endNode',
    position: { x: 320, y: 700 },
    data: {},
  },
]
const template6Edges: Edge[] = [
  { id: 't6-e1', source: 't6-start', target: 't6-prompt1' },
  { id: 't6-e2', source: 't6-prompt1', target: 't6-llm' },
  { id: 't6-e3', source: 't6-llm', target: 't6-condition' },
  { id: 't6-e4-true', source: 't6-condition', target: 't6-prompt2', sourceHandle: 'true' },
  { id: 't6-e4-false', source: 't6-condition', target: 't6-end-pos', sourceHandle: 'false' },
  { id: 't6-e5', source: 't6-prompt2', target: 't6-llm-neg' },
  { id: 't6-e6', source: 't6-llm-neg', target: 't6-end-neg' },
]

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'xiaohongshu-copywriting',
    name: '小红书爆款文案流',
    description: '输入商品名，通过设定爆款公式（标题+Emoji+情感共鸣）由大模型生成小红书风格文案。',
    icon: FileText,
    nodes: template1Nodes,
    edges: template1Edges,
  },
  {
    id: 'daily-news-summary',
    name: '每日新闻总结提取',
    description: '通过 HTTP 获取每日新闻（如 Hacker News），再经 Prompt 要求总结成 3 条要点，由 LLM 输出。',
    icon: Newspaper,
    nodes: template2Nodes,
    edges: template2Edges,
  },
  {
    id: 'customer-intent-routing',
    name: '智能客服意图路由',
    description: '根据用户咨询文本提取意图（售前/售后），条件分支：售后转人工 End，售前由另一 LLM 基于知识库自动回复后 End。',
    icon: MessageCircle,
    nodes: template3Nodes,
    edges: template3Edges,
  },
  {
    id: 'unstructured-to-json',
    name: '非结构化文本转 JSON（数据清洗）',
    description: '自动从杂乱的文本、简历或网页正文中提取核心字段，并输出为标准化的 JSON 格式，适合无缝对接数据库。',
    icon: Database,
    nodes: template4Nodes,
    edges: template4Edges,
  },
  {
    id: 'translation-and-polish',
    name: '沉浸式外语翻译与精细润色',
    description: '双重 LLM 节点架构。先进行精准的直译，再根据目标语言习惯进行母语级别的润色排版。',
    icon: Languages,
    nodes: template5Nodes,
    edges: template5Edges,
  },
  {
    id: 'complaint-sentiment-triage',
    name: '客户客诉情感分析与自动打标',
    description: '自动分析客户反馈文本的情感倾向。若为负面投诉则标记高危并输出应对策略；若为正面反馈则生成感谢话术。',
    icon: MessageSquareWarning,
    nodes: template6Nodes,
    edges: template6Edges,
  },
]
