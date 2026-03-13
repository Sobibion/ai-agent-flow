/**
 * 模拟 SSE 流式输出：将整段文本按打字机效果逐批吐出。
 * 每 30ms 吐出 1~3 个字符，使用 AsyncGenerator 便于 for await 消费。
 */
export interface StreamOptions {
  /** 每批之间的间隔（毫秒），默认 30 */
  delayMs?: number
  /** 每批最少字符数，默认 1 */
  minChunk?: number
  /** 每批最多字符数，默认 3 */
  maxChunk?: number
}

const defaultOptions: Required<StreamOptions> = {
  delayMs: 30,
  minChunk: 1,
  maxChunk: 3,
}

function randomChunkSize(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 将完整文本按选项流式吐出。
 * 每次 yield 当前已累积的完整字符串（从开头到当前为止），便于直接用于 UI 展示。
 */
export async function* streamText(
  fullText: string,
  options: StreamOptions = {}
): AsyncGenerator<string> {
  const { delayMs, minChunk, maxChunk } = { ...defaultOptions, ...options }
  let index = 0
  const len = fullText.length

  while (index < len) {
    const chunkSize = Math.min(randomChunkSize(minChunk, maxChunk), len - index)
    index += chunkSize
    const current = fullText.slice(0, index)
    yield current
    if (index < len) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * 内置一段包含 Markdown 表格与代码块的长文本，用于预览面板演示。
 */
export const SAMPLE_MARKDOWN = `## 流式输出示例

这是一段**模拟 AI 流式响应**的示例文本，包含多种 Markdown 元素。

### 代码块

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### 表格

| 列 A | 列 B | 列 C |
|------|------|------|
| 1    | 2    | 3    |
| 4    | 5    | 6    |

### 列表

- 第一项
- 第二项
- 第三项

以上内容会以**打字机效果**逐字呈现。
`
