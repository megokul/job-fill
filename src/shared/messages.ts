import type { FillKey } from './types'

export type FilledField = {
  /** Human-readable page field label. */
  label: string
  /** Profile label or custom-answer question. */
  target: string
  key?: FillKey
  source: 'mapping' | 'heuristic' | 'custom'
}

export type FillResult = {
  filled: FilledField[]
  skippedNonEmpty: number
  unmatched: { label: string }[]
  frameUrl: string
}

export type ToastSummary = {
  filled: number
  left: number
}

/** Content ↔ background messages. Only UNDO_TAB remains after the executeScript API. */
export type Message = { type: 'UNDO_TAB' }

export type MessageType = Message['type']
