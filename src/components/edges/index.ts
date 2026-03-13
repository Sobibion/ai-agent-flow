import type { EdgeTypes } from 'reactflow'
import { AnimatedEdge } from './AnimatedEdge'

export const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
  animated: AnimatedEdge,
}

export { AnimatedEdge }
