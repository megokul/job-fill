import type { CustomAnswer, FieldMapping } from './types'

/**
 * Merge current answers with newly created ones by id, then keep only answers
 * still referenced by the saved mapping fields (plus any other current answers
 * that were not part of this save's pending set).
 *
 * Pending answers whose field was removed before save are dropped.
 */
export function mergeCustomAnswersForMapping(opts: {
  current: CustomAnswer[]
  pending: CustomAnswer[]
  fields: FieldMapping[]
}): CustomAnswer[] {
  const { current, pending, fields } = opts
  const referenced = new Set(
    fields
      .map((f) => f.customAnswerId)
      .filter((id): id is string => Boolean(id)),
  )
  const pendingIds = new Set(pending.map((a) => a.id))

  const byId = new Map<string, CustomAnswer>()
  for (const a of current) byId.set(a.id, a)
  for (const a of pending) {
    if (!referenced.has(a.id)) continue
    byId.set(a.id, a)
  }

  // Drop pending answers that are no longer referenced; keep unrelated current ones.
  return Array.from(byId.values()).filter((a) => {
    if (pendingIds.has(a.id) && !referenced.has(a.id)) return false
    return true
  })
}
