import { describe, expect, it } from 'vitest'
import { mergeCustomAnswersForMapping } from './mergeCustomAnswers'
import type { CustomAnswer, FieldMapping } from './types'

const a1: CustomAnswer = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  question: 'Why us?',
  answer: 'Old',
  updatedAt: 1,
}
const a2: CustomAnswer = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  question: 'Why us?',
  answer: 'New',
  updatedAt: 2,
}
const a3: CustomAnswer = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  question: 'Other',
  answer: 'Keep',
  updatedAt: 1,
}
const pendingOnly: CustomAnswer = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  question: 'Removed field',
  answer: 'Gone',
  updatedAt: 3,
}

function field(customAnswerId: string): FieldMapping {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    match: {},
    customAnswerId,
  }
}

describe('mergeCustomAnswersForMapping', () => {
  it('re-reads current answers and overlays pending by id', () => {
    const merged = mergeCustomAnswersForMapping({
      current: [
        { ...a1, answer: 'Edited in Options' },
        a3,
      ],
      pending: [a2],
      fields: [field(a2.id)],
    })
    expect(merged.find((a) => a.id === a1.id)?.answer).toBe('Edited in Options')
    expect(merged.find((a) => a.id === a2.id)?.answer).toBe('New')
    expect(merged.find((a) => a.id === a3.id)?.answer).toBe('Keep')
  })

  it('drops pending answers whose field was removed before save', () => {
    const merged = mergeCustomAnswersForMapping({
      current: [a1],
      pending: [pendingOnly],
      fields: [field(a1.id)],
    })
    expect(merged.map((a) => a.id)).toEqual([a1.id])
  })
})
