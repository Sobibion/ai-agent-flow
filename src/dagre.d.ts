declare module 'dagre' {
  export namespace graphlib {
    class Graph {
      setDefaultEdgeLabel(fn: () => object): this
      setGraph(options: { rankdir?: string; ranksep?: number; nodesep?: number }): this
      setNode(name: string, label: { width: number; height: number }): this
      setEdge(sourceId: string, targetId: string): this
      node(id: string): { x: number; y: number; width?: number; height?: number }
    }
  }
  export function layout(g: graphlib.Graph): void
}
