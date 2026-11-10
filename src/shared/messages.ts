import type { FormMapping, Profile, Settings, Store } from './types'

export type FillResult = {
  filled: number
  fromMapping: number
  fromHeuristic: number
  skipped: number
}

export type Message =
  | { type: 'GET_STORE' }
  | { type: 'SAVE_PROFILE'; profile: Profile }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'SAVE_FORM_MAPPING'; mapping: FormMapping }
  | { type: 'DELETE_FORM_MAPPING'; id: string }
  | { type: 'DELETE_FIELD_MAPPING'; formId: string; fieldId: string }
  | { type: 'GET_MAPPINGS_FOR_URL'; url: string }
  | { type: 'FILL_PAGE' }
  | { type: 'START_MAP_MODE' }
  | { type: 'STOP_MAP_MODE' }
  | { type: 'PING' }

export type MessageResponseMap = {
  GET_STORE: Store
  SAVE_PROFILE: Store
  SAVE_SETTINGS: Store
  SAVE_FORM_MAPPING: Store
  DELETE_FORM_MAPPING: Store
  DELETE_FIELD_MAPPING: Store
  GET_MAPPINGS_FOR_URL: FormMapping[]
  FILL_PAGE: FillResult
  START_MAP_MODE: { ok: true }
  STOP_MAP_MODE: { ok: true }
  PING: { ok: true }
}

export type MessageType = Message['type']
