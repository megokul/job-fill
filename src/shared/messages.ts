import type { FillKey } from './types'

export type FilledField = {
  label: string
  key: FillKey
  source: 'mapping' | 'heuristic' | 'custom'
}

export type FillResult = {
  filled: FilledField[]
  skippedNonEmpty: number
  unmatched: { label: string }[]
  frameUrl: string
}

export type Message =
  | { type: 'FILL_PAGE' }
  | { type: 'UNDO_FILL' }
  | { type: 'START_MAP_MODE' }
  | { type: 'STOP_MAP_MODE' }
  | { type: 'PING' }

export type MessageType = Message['type']
