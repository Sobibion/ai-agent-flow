# AI Agent 工作流 — 已实现功能清单

本文档整理当前项目已实现的全部功能，按阶段与模块划分。

---

## 一、技术栈

| 类别     | 技术 |
|----------|------|
| 框架     | React 19 + TypeScript + Vite 5 |
| 画布与节点 | React Flow |
| 状态管理 | Zustand（含 persist 本地持久化） |
| 样式     | Tailwind CSS |
| 图标     | Lucide React |
| Markdown | react-markdown + remark-gfm |
| 自动布局 | dagre |
| 提示/通知 | Sonner（toast） |

---

## 二、Phase 1：基础工程与画布

- **Vite + React + TS**：项目骨架与构建配置。
- **Tailwind CSS**：PostCSS + tailwind.config.js，全局样式与工具类。
- **Zustand Store**（`useWorkflowStore`）：
  - `nodes` / `edges` 画布数据。
  - `onNodesChange` / `onEdgesChange` / `onConnect` 与 React Flow 双向同步。
- **WorkflowCanvas**：
  - 集成 React Flow，支持拖拽画布、缩放。
  - 点状背景（BackgroundVariant.Dots）、小地图（MiniMap）、缩放控制（Controls）。
- **布局**：顶部 Toolbar、左侧 Sidebar、中间画布、右侧面板（预览 / 日志 Tab）。

---

## 三、Phase 2：自定义业务节点

- **八类节点**（白底、圆角 2xl、细阴影、莫兰迪色标题栏 + 图标，统一 Handle 样式 w-3 h-3、hover 靛蓝）：
  - **Start Node（起点）**：翠绿标题栏（bg-emerald-50），**Key-Value 表单「系统初始入参」**（变量名/值行动态列表 + 「添加入参」），数据写入 `data.params`；仅右侧 Source Handle。
  - **End Node（终点）**：玫瑰色标题栏（bg-rose-50），仅左侧 Target Handle，文案「输出结果」。
  - **Prompt Node（提示词）**：琥珀色标题栏（bg-amber-50），Textarea 支持变量如 `{{input}}`，左 Target / 右 Source Handle；**实时提取 `{{变量名}}` 并在 Textarea 下方以 Tag 展示**。
  - **LLM Node（大模型）**：靛蓝标题栏（bg-indigo-50），**模型可下拉选择或手动输入**（含 DeepSeek Chat、Qwen2.5-7B-Instruct、通义千问 Plus、GLM-4 等）、Temperature 滑块、API Key（可选）、Base URL（可选，placeholder 支持从 `.env.local` 的 `VITE_OPENAI_BASE_URL` 读取）、最大重试次数/重试间隔；**调用真实 OpenAI 兼容 API，流式输出**；API Key/Base URL 回退：节点表单 → 全局变量 `openaiApiKey` → `VITE_OPENAI_API_KEY` / `VITE_OPENAI_BASE_URL`。
  - **Condition Node（条件判断）**：蓝色标题栏（bg-blue-50），变量下拉、运算符、对比值输入；左侧 1 个 Target Handle，右侧 2 个 Source Handle（`true` / `false`）。
  - **HTTP Node（HTTP 请求）**：青色标题栏（bg-cyan-50），Method、URL、Headers、Body、重试配置；左 Target / 右 Source Handle。
  - **Code Node（代码节点）**：紫色系标题栏，支持自定义代码逻辑，左 Target / 右 Source Handle。
  - **Group Node（框选/注释）**：分组/注释用容器，可调整大小、可编辑标题，zIndex -1 置于节点下层；侧栏与右键菜单均可添加。
- **交互**：节点内表单变更时调用 `updateNodeData(id, data)`，与 Store 中 `node.data` 同步。
- **节点注册**：在 `nodeTypes` 中注册并在 WorkflowCanvas 传入 React Flow；拖拽时根据类型注入默认 data。
- **运行时状态**：节点 `data` 支持 `status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'`、`runResult?: unknown`，用于执行引擎与 UI 状态指示。
- **重试配置**：`NodeRuntimeFields` 含 `retryCount?`、`retryInterval?`；LLM / HTTP 节点在表单中可配置，执行时失败则按配置自动重试，重试期间 toast 提示「第 N 次重试」。

---

## 四、Phase 3：画布交互与拖拽

- **拖拽添加节点**：
  - 左侧 Sidebar 中节点模板可拖拽（`draggable` + `onDragStart`），通过 `dataTransfer` 传递类型。
  - 画布容器上 `onDragOver` + `onDrop`，使用 `reactFlowInstance.screenToFlowPosition` 转画布坐标，调用 `addNode` 插入节点（含默认 data）。
- **节点删除**：
  - **键盘**：画布不绑定 React Flow 内置删除键；在 **WorkflowCanvas** 内统一监听 keydown：若焦点在 input/textarea/`.nodrag` 上则 **直接 return**（保证复制粘贴、Backspace 由浏览器处理）；否则若按下 Backspace/Delete 且存在选中节点或边，则调用 `removeNode`/`removeEdge`。避免在输入框内误删节点。
  - **节点工具栏**：每个节点使用 **NodeToolbar**（`isVisible={selected}`），内含删除按钮，点击调用 `removeNode(id)`。
- **连线删除**：Store 提供 `removeEdge(id)`；**AnimatedEdge** 在连线中点渲染删除按钮（选中或悬浮时显示），点击触发 `removeEdge(id)`。
- **连线**：通过 Handle 连接；Condition 节点通过 `sourceHandle: 'true' | 'false'` 区分分支。
- **智能辅助线（HelperLines）与 Snap on Drop**：
  - **辅助线**：拖拽节点时与其它节点对齐会显示辅助线；严格挂载到画布 transform（SVG 内 `<g transform>` 与 viewport 一致），随缩放/平移正确显示。
  - **蓝线（排版）**：上边缘对齐（horizontalTop）、竖直中轴对齐（verticalCenter）、左边缘对齐（verticalLeft）。
  - **红线（Handle 连线）**：基于 store 的 `nodeInternals` 与 `handleBounds` 计算 Handle 绝对坐标；当拖拽节点与目标节点的 Handle 在同一水平线时，在两孔之间绘制**局部红色虚线**，消除拐点感知。
  - **Snap on Drop**：松手时若存在「完美吸附坐标」（snapPositionRef），通过 setNodes 将节点吸附到该位置，连线笔直无拐点；阈值 15px，snapGrid [15,15]。
- **DAG 防环（连线合法性校验）**：
  - **isValidConnection**：纯函数，自环拒绝；从目标节点出发 DFS 沿出边检查是否能到达源节点，若可达则连接后会成环，返回 false。
  - **UI 与逻辑解耦**：校验内无 toast；拒绝时仅设置 `connectionRejectedRef`；在 **onConnectEnd** 中统一根据 ref 弹出 `toast.error`（id: `cycle-connection-error`，duration: 3000），避免 hover 高频触发导致 toast 堆叠。
- **复制 / 粘贴**：
  - **快捷键**：WorkflowCanvas 内 window 监听 **Ctrl+C / Ctrl+V**；若 **焦点在 input/textarea 或 `.nodrag` 内**则 **直接 return**，由浏览器处理复制粘贴；否则执行画布复制/粘贴逻辑。
  - **复制**：将当前选中节点及其内部连线写入 Store 的 `clipboard`（不持久化）。
  - **粘贴**：`pasteFromClipboard()` 先 `pushHistory()`，新 UUID、坐标偏移 (30,30)、连线重映射；粘贴后选中新节点，`toast.success('粘贴成功')`。
- **输入框与画布隔离**：所有节点内 input/textarea/select 使用 **nodrag、nopan、nowheel** 类，并 **onKeyDown stopPropagation**，避免在输入框内按 Backspace/方向键触发节点删除或画布平移。

---

## 五、自定义连线与动画

- **AnimatedEdge**（`src/components/edges/AnimatedEdge.tsx`）：
  - 使用 `getSmoothStepPath` + `BaseEdge` 绘制平滑折线；当 `animated === true` 时**虚线流动**效果（绿色渐变 + `stroke-dashoffset` 动画）。
  - 通过 `edgeTypes` 注册，所有连线统一使用。
  - **删除按钮**：连线选中或悬浮时显示，点击删除。
- **Store**：`setEdgeAnimated`、`setEdgesAnimated`、`updateEdgeAnimation`，用于执行时动态开关连线动画。
- **执行联动**：运行工作流时，当前批次相关边设为 `animated: true`，该批结束后关闭。

---

## 六、Phase 4：AI 预览与流式输出

- **右侧面板（RightPanel）**：
  - 面板背景 **bg-slate-50**、左边框 **border-l border-slate-200**；**Tab 切换**采用分段控制器样式（选中 Tab 白底阴影），「预览」|「日志」；宽度 380px，可整体折叠。
  - **预览 Tab（PreviewPanel）**：
    - 标题「AI 预览」；**运行由顶部 Toolbar 统一**，预览区不再提供运行按钮。
    - **结果操作工具栏**：**一键复制**（Lucide Copy，复制当前流式/最终文本到剪贴板，toast.success；无内容时禁用）、**清空**（Trash2，清空 streamingPayload 与展示内容，恢复空状态）。
    - **加载状态**：当 `isExecuting` 或正在流式输出时，标题旁显示 12px **Loader2** 旋转图标（text-indigo-500），便于感知运行中。
    - **有内容时**在 **白色圆角内容卡片**（rounded-2xl、shadow-sm、p-5）内用 **react-markdown** 展示；**流式输出中**文末**靛蓝闪烁光标**；**无内容且未流式**时**空状态**（居中 Icon +「从顶部工具栏运行工作流，见证 AI 的魔法」）。
- **流式来源统一**：仅用 `streamingPayload` + **80ms 防抖**驱动展示；Mock 与真实 LLM 均通过 `setStreamingPayload` 走同一套逻辑。
- **Mock 流式服务**（`mockStreamingService.ts`）：`streamText(fullText, options?)` 为 AsyncGenerator，默认每 30ms 吐出 1～3 字；每次 `yield` 为从开头到当前的整段字符串。
- **真实 LLM 流式**（`llmService.ts`）：
  - `streamChatCompletions({ apiKey, baseURL?, model, messages, temperature })`：**fetch + SSE** 请求 `{baseURL}/v1/chat/completions`（默认 Base URL 可被 `.env.local` 的 `VITE_OPENAI_BASE_URL` 覆盖）。
  - 解析 SSE 累加内容并 yield；非 2xx 时解析错误体并 throw。若捕获 **TypeError: Failed to fetch**（含 CORS），executor 层 **toast.error** 友好提示：「网络请求失败，请检查 Base URL 是否正确，或该大模型接口不支持浏览器跨域直连」。
- **流式渲染**：`react-markdown` + `remark-gfm`；防闪烁：流式期间 ref 存最新内容，80ms 间隔刷到 state 再渲染。

---

## 七、DAG 执行引擎（真实数据流转与分支剪枝）

- **入口**：Toolbar「运行」调用 `runWorkflowEngine(nodes, edges, storeActions, options?)`（`src/utils/executor.ts`）。`options` 含 `runId`、`startTime`、`globalVariables`，用于运行日志与变量回退。
- **前置校验**：
  - 必须存在 Start 节点与至少一个 End 节点，否则抛出 `WorkflowExecutionError`。
  - 从 Start 出发在子图上做 **Kahn 拓扑排序**，若存在环则抛出错误；执行前 **resetExecutionStatus()** 清空所有节点/边状态与动画。
- **并行执行**：
  - 基于 Kahn：维护 **pendingCount**（入度），每轮取当前**入度为 0** 的节点集合，用 **Promise.all** 并发执行该批。
  - 每批开始前：本批节点统一 `updateNodeStatus(id, 'running')`、入边 `updateEdgeAnimation(id, true)`；本批结束后统一关闭边动画。
  - 某批完成后：根据结果 **释放后继**（pendingCount 减 1）；若为 **Condition 节点**，仅释放与 `branch` 匹配的那条出边上的后继，非匹配后继标记为 `skipped` 并级联释放其下游；**skipped** 节点通过 `isNodeOnActiveBranch(..., skippedNodes)` 过滤，不进入执行批。
  - 状态更新在批次维度统一进行，避免 Zustand 多次异步更新竞态。
- **条件节点与分支剪枝**：
  - **Condition Node**：从上游（及全局变量回退）读取 `variable` 值，按 `operator`（`==` / `!=` / `contains`）与 `value` 比较，得到 `branch: true | false`。
  - 剪枝：若某节点任一条入边来自条件节点且 `sourceHandle` 与 `branch` 不一致，则该节点及仅经 skipped 可达的节点被标记 `skipped`，不执行。
- **节点语义与数据流**：
  - **Start**：直接读取 **node.data.params**（无则 `{}`），作为 **runResult** 传给下游；入参由起点节点内 **Key-Value 表单**配置，无硬编码。
  - **Prompt**：用 **mergeWithGlobalVariables(upstream, globalVariables)**（先铺底 globalVariables，再被 upstream 覆盖）得到合并值，替换 `template` 中 `{{变量名}}`；若有未替换变量则报错并中断。
  - **LLM**：从上游取 prompt（或 `upstream.input`）；**API Key** 优先级：节点 `data.apiKey` → 全局变量 `openaiApiKey` → `VITE_OPENAI_API_KEY`；**Base URL**：节点 `data.baseURL` → `VITE_OPENAI_BASE_URL` → 默认。调用 **streamChatCompletions**，流式时 **setStreamingPayload(accumulated)**；输出 `{ response }`；失败时 toast + error 状态；支持 **retryCount / retryInterval** 自动重试。
  - **HTTP**：URL/Body 用 **mergeWithGlobalVariables(upstream, globalVariables)** 后 **fillTemplate**；GET/POST、Headers(Body) 支持 `{{变量}}`；请求失败或未替换变量时 error；支持 **retryCount / retryInterval** 自动重试。
  - **Condition**：见上。
  - **End**：汇总前驱 `runResult` 作为本节点结果。
- **全局变量回退**：执行时传入 `options.globalVariables`（Record<string, string>）。**fillTemplate** 所用值为 `{ ...globalVariables, ...upstream }`，即上游缺失的变量从全局变量中读取；都缺失则保留 `{{变量名}}` 并报错。
- **错误与提示**：捕获 `WorkflowExecutionError` 等，Sonner **toast.error**；成功时 **toast.success('工作流执行完毕')**。

---

## 八、运行历史日志与调试

- **运行历史日志（RunLogPanel）**：
  - Store：**runLogs**（`RunLogEntry[]`，不持久化）、**pushRunLog(entry)**；单条结构：`runId`、`startTime`、`endTime`、`status: 'success' | 'fail'`、**nodeDetails**（每节点 nodeId、nodeType、status、input、output、error）、**errorMessage**（失败时错误/堆栈）。
  - 每次点击「运行」生成 **runId**、**startTime**；执行成功时 executor 返回快照（含 nodeDetails），Toolbar 调用 **pushRunLog**；执行失败时 Toolbar 在 catch 中根据当前 nodes 组一条失败日志并 **pushRunLog**。
  - 右侧面板「日志」Tab：展示历史运行列表（runId 短码、时间、耗时、**成功/失败徽章**）；点击某条展开详情：错误信息块（红底）、**节点详情**列表（可展开看输入/输出 JSON）。配色：成功绿、失败红、跳过灰。
- **NodeStatusIndicator**：
  - 根据 `data.status` 显示：Idle、Running（Spinner + pulse）、Success、Error、Skipped；Success 时「查看结果」按钮。
- **DebugDrawer**：
  - 根据 Store 的 `selectedNodeForDebug` 从 `nodes` 取对应节点，右侧滑出面板展示该节点 **当前** `data.runResult`（JSON，黑底绿字）；遮罩或关闭按钮清空选中。

---

## 九、Phase 5：进阶体验

- **撤销 / 重做**：
  - Store：`past` / `future` 历史快照（最多 50 条），`pushHistory()`、`undo()`、`redo()`。
  - 全局快捷键：**Ctrl+Z** 撤销，**Ctrl+Shift+Z** 或 **Ctrl+Y** 重做；Toolbar 提供撤销/重做按钮。
- **一键清空画布**：`clearCanvas()`（先 pushHistory），Toolbar 按钮 + confirm + toast。
- **自动布局（一键整理）**：dagre 拓扑布局（TB），Toolbar 按钮，pushHistory 后 setNodes。
- **导出 / 导入配置**：下载 `workflow-config.json`；选择 JSON 恢复 nodes/edges；toast 提示。
- **环境变量（全局变量）**：
  - 支持从项目根 **.env.local** 读取 **VITE_OPENAI_API_KEY**、**VITE_OPENAI_BASE_URL**（Vite 自动加载，仅前端可见）；根目录提供 **.env.example** 说明。
  - Store：**globalVariables**（持久化）、**setGlobalVariables** / **setGlobalVariable** / **removeGlobalVariable**；Toolbar「环境变量」打开 **GlobalVariablesDialog**，Key-Value 表格增删改查；执行时 **mergeWithGlobalVariables(upstream, options.globalVariables)**，上游缺失的变量从全局变量读取。
- **经典模板与自定义模板**：
  - **内置模板**（`config/templates.ts`）：**WORKFLOW_TEMPLATES** 含 6 个模板（小红书爆款文案、每日新闻总结、智能客服意图路由、**非结构化文本转 JSON（数据清洗）**、**沉浸式外语翻译与精细润色**、**客户客诉情感分析与自动打标**）；一键应用后自动 dagre 布局。
  - **自定义模板**：Store 中 **customTemplates**（`StoredWorkflowTemplate[]`）、**addCustomTemplate**、**removeCustomTemplate**；**持久化**（partialize 含 customTemplates，序列化时不含 icon，使用处补默认 FolderHeart）。
  - Toolbar「**保存为模板**」打开 **SaveTemplateDialog**：模板名称（必填）、模板描述（可选），保存时取当前 nodes/edges 深拷贝并清洗运行态，生成 UUID、icon 为 FolderHeart，调用 **addCustomTemplate**，toast.success 后关闭。
  - **TemplateGalleryDialog**（模板库）：**Tabs「内置经典」|「我的模板」**；内置展示 6 个模板卡片；我的模板展示 customTemplates，空状态提示「暂无自定义模板，快去画布中保存一个吧！」；自定义卡片右上角 **Hover 显示删除按钮**，点击 **removeCustomTemplate(id)** + **toast.success('模板已删除')**，事件 **stopPropagation** 防止误触发应用模板。

---

## 十、本地持久化（Zustand persist）

- **persist 配置**（`useWorkflowStore`）：
  - `name: 'ai-agent-workflow-storage'`；**partialize**：`nodes`、`edges`、**globalVariables**、**customTemplates**（序列化时仅存 id/name/description/nodes/edges，不含 icon）。
  - 持久化前清洗 nodes：去掉 `status`、`runResult`、`runState`；清洗 edges：去掉 `animated`。
- **不持久化**：`streamingPayload`、`clipboard`、`runLogs`、`past`/`future`、`selectedNodeForDebug`、`_hasHydrated`。
- **Hydration**：`_hasHydrated`、`setHasHydrated`；WorkflowCanvas 仅在客户端 mounted 后渲染画布，避免首屏冲突。

---

## 十一、核心文件结构

```
src/
├── App.tsx                        # 根布局：Toaster + DebugDrawer + Toolbar + Sidebar + WorkflowCanvas + RightPanel
├── main.tsx
├── index.css
├── types/
│   └── workflow.ts                # NodeType(含 httpNode), NodeStatus, ConditionOperator,
│                                  # *NodeData, RunLogEntry, RunLogNodeDetail, WorkflowNode
├── store/
│   └── useWorkflowStore.ts        # nodes/edges、persist(含 globalVariables、customTemplates)、past/future、undo/redo、
│                                  # clipboard、copySelection、pasteFromClipboard、runLogs、pushRunLog、
│                                  # globalVariables、setGlobalVariables/setGlobalVariable/removeGlobalVariable、
│                                  # customTemplates、addCustomTemplate、removeCustomTemplate、
│                                  # updateNodeStatus、resetExecutionStatus、streamingPayload、selectedNodeForDebug
├── services/
│   ├── mockStreamingService.ts    # streamText、SAMPLE_MARKDOWN
│   ├── llmService.ts              # streamChatCompletions（fetch + SSE，OpenAI 兼容）
│   └── dagEngine.ts               # （若仍存在）getExecutionOrder、runWorkflow
├── utils/
│   ├── layout.ts                  # getLayoutedNodes (dagre)
│   └── executor.ts                # runWorkflowEngine、RunEngineOptions(runId,startTime,globalVariables)、
│                                  # 并行批次、nodeStatusMap、mergeWithGlobalVariables、重试循环、
│                                  # 成功时返回 RunLogEntry、WorkflowExecutionError
├── config/
│   └── templates.ts               # WorkflowTemplate 类型、WORKFLOW_TEMPLATES(6 个内置)、图标 Database/Languages/MessageSquareWarning 等
├── components/
│   ├── Toolbar.tsx                # 环境变量、模板库、保存为模板、撤销/重做、运行(传 globalVariables)、一键整理、清空、导出/导入、快捷键；主按钮靛蓝
│   ├── GlobalVariablesDialog.tsx  # 环境变量弹窗：Key-Value 表格、增删改、保存/取消
│   ├── SaveTemplateDialog.tsx     # 保存为模板弹窗：模板名称(必填)、描述(可选)、取消/保存
│   ├── TemplateGalleryDialog.tsx  # 模板库弹窗：Tabs 内置经典/我的模板、空状态、自定义卡片删除(stopPropagation)
│   ├── Sidebar.tsx                # 节点模板拖拽、分段控制器样式、卡片 hover 靛蓝
│   ├── WorkflowCanvas.tsx         # React Flow、焦点在输入框时跳过快捷键、Backspace/Delete 仅删选中、Ctrl+C/V、nodeTypes、edgeTypes、
│   │                              # HelperLines(蓝线排版+红线 Handle 局部线)、Snap on Drop、isValidConnection(DAG 防环)、onConnectEnd(toast)
│   ├── RightPanel.tsx             # 右侧面板：bg-slate-50、预览/日志 分段 Tab、折叠
│   ├── PreviewPanel.tsx           # 预览：内容卡片、流式光标、空状态「从顶部工具栏运行…」、streamingPayload + 80ms 防抖；
│   │                              # 复制/清空图标工具栏、isExecuting/流式时 Loader2 标题旁
│   ├── RunLogPanel.tsx            # 日志 Tab：runLogs 列表、选中条目的 nodeDetails 与 errorMessage
│   ├── DebugDrawer.tsx            # 右侧滑出：当前选中节点的 runResult
│   ├── edges/
│   │   ├── index.ts
│   │   └── AnimatedEdge.tsx
│   └── nodes/
│       ├── index.ts               # nodeTypes 注册（startNode, endNode, promptNode, llmNode, conditionNode, httpNode, codeNode, groupNode）
│       ├── GroupNode.tsx          # 框选/注释节点：可调整大小、可编辑标题、zIndex -1
│       ├── NodeStatusIndicator.tsx  # 状态药丸 Pill、Success/Skipped 等、查看结果按钮
│       ├── StartNode.tsx          # Key-Value 系统初始入参、params 同步 Store
│       ├── EndNode.tsx / PromptNode.tsx / LLMNode.tsx / ConditionNode.tsx / HttpNode.tsx / CodeNode.tsx
│       └── ...
```

---

## 十二、功能速查表

| 功能           | 说明 |
|----------------|------|
| 画布拖拽/缩放  | React Flow + BackgroundVariant.Dots + MiniMap + Controls |
| 八类节点       | 起点、终点、提示词、大模型、条件判断、HTTP、代码节点、框选/注释(Group) |
| 节点 UI        | 卡片 rounded-2xl、莫兰迪色标题栏、统一 Handle w-3 h-3、状态 Pill、表单 label 与 focus 环 |
| 节点表单 → Store | `updateNodeData` 同步；LLM/HTTP 支持 retryCount、retryInterval；起点 params 对象 |
| Prompt 变量 Tag | 实时提取 `{{变量名}}`，Textarea 下方 Tag 展示 |
| 节点运行状态   | status/runResult、NodeStatusIndicator(Pill)；Success 时「查看结果」→ DebugDrawer |
| 侧栏拖拽到画布 | 分段控制器样式、卡片 hover 靛蓝；DnD + screenToFlowPosition + addNode |
| 删除节点/连线 | 键盘 Backspace/Delete 仅当焦点不在输入框时删选中；NodeToolbar 删除；连线中点 ✖ |
| 智能辅助线     | 蓝线(上边/竖中/左边)+红线(Handle 局部)；Snap on Drop 松手吸附；snapGrid [15,15] |
| DAG 防环      | isValidConnection 纯函数 DFS 判环；onConnectEnd 统一 toast(id: cycle-connection-error) |
| 复制/粘贴     | 焦点在 input/textarea 时交还浏览器；否则 Ctrl+C/V 画布复制粘贴、pushHistory、toast |
| 输入与画布隔离 | input/textarea/select 使用 nodrag nopan nowheel + onKeyDown stopPropagation |
| 自定义连线     | AnimatedEdge，animated 时虚线流动；中点删除 |
| 条件节点与分支 | variable/operator/value；True/False 双出口；执行时 branch 剪枝、skipped 级联 |
| 右侧面板       | bg-slate-50、分段 Tab 预览/日志；预览：复制/清空工具栏、Loader2 加载态、空状态「从顶部工具栏运行…」 |
| LLM 真实 API  | streamChatCompletions；SSE；API Key/Base URL 回退(node→openaiApiKey→env)；CORS 友好 toast |
| 流式防闪烁    | streamingPayload + 80ms 间隔刷 state |
| 并行执行       | Kahn 就绪批 + Promise.all；释放后继；条件分支剪枝；多节点 Running + 边动画 |
| 自动重试       | LLM/HTTP retryCount、retryInterval；toast.warning；耗尽后 error + toast.error |
| 运行历史日志   | runLogs、pushRunLog；日志 Tab 列表+详情（nodeDetails、errorMessage） |
| 全局变量       | globalVariables 持久化；环境变量弹窗；fillTemplate 回退(mergeWithGlobalVariables) |
| 环境变量文件   | .env.local 支持 VITE_OPENAI_API_KEY、VITE_OPENAI_BASE_URL；.env.example 说明 |
| 起点入参       | Start 节点 data.params（Key-Value 表单）；执行时直接作为 runResult，无 JSON 手写 |
| 内置模板       | 6 个：小红书文案、新闻总结、客服意图路由、文本转 JSON、翻译润色、客诉情感打标 |
| 自定义模板     | customTemplates 持久化；保存为模板弹窗；模板库 Tab「我的模板」、空状态、卡片删除 |
| 调试抽屉       | DebugDrawer 展示当前选中节点 runResult |
| 撤销/重做     | past/future、Ctrl+Z / Ctrl+Shift+Z，Toolbar 按钮 |
| 一键清空/整理 | clearCanvas(confirm)、dagre 布局 |
| 导出/导入配置 | workflow-config.json；toast 提示 |
| 本地持久化    | persist：nodes、edges、globalVariables、customTemplates（清洗运行态）；刷新恢复 |
| 提示与通知    | Sonner toast.success/error/warning |

以上为当前已实现的全部功能整理。
