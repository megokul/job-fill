import { describe, expect, it } from 'vitest'
import { passesVisualChecks, type RectLike, type StyleLike } from './visibility'

function rect(partial: Partial<RectLike>): RectLike {
  return {
    top: 10,
    left: 10,
    right: 110,
    bottom: 30,
    width: 100,
    height: 20,
    ...partial,
  }
}

function style(partial: Partial<StyleLike> = {}): StyleLike {
  return {
    opacity: '1',
    clip: 'auto',
    clipPath: 'none',
    ...partial,
  }
}

describe('passesVisualChecks', () => {
  it('rejects tiny boxes', () => {
    const el = {} as Element
    expect(
      passesVisualChecks(el, {
        getRect: () => rect({ width: 2, height: 20 }),
        getStyle: () => style(),
        checkVisibility: () => true,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(false)
  })

  it('rejects boxes entirely off the document', () => {
    const el = {} as Element
    expect(
      passesVisualChecks(el, {
        getRect: () =>
          rect({ left: -200, right: -100, top: 10, bottom: 30, width: 100 }),
        getStyle: () => style(),
        checkVisibility: () => true,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(false)
  })

  it('rejects low opacity and clip-path inset(50%)', () => {
    const el = {
      nodeType: 1,
      getAttribute: () => null,
      parentElement: null,
      inert: false,
    } as unknown as Element
    expect(
      passesVisualChecks(el, {
        getRect: () => rect({}),
        getStyle: () => style({ opacity: '0.05' }),
        checkVisibility: () => true,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(false)
    expect(
      passesVisualChecks(el, {
        getRect: () => rect({}),
        getStyle: () => style({ clipPath: 'inset(50%)' }),
        checkVisibility: () => true,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(false)
  })

  it('rejects when checkVisibility returns false', () => {
    const el = {
      nodeType: 1,
      getAttribute: () => null,
      parentElement: null,
      inert: false,
    } as unknown as Element
    expect(
      passesVisualChecks(el, {
        getRect: () => rect({}),
        getStyle: () => style(),
        checkVisibility: () => false,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(false)
  })

  it('accepts a normal visible control', () => {
    const el = {
      nodeType: 1,
      getAttribute: () => null,
      parentElement: null,
      inert: false,
    } as unknown as Element
    expect(
      passesVisualChecks(el, {
        getRect: () => rect({}),
        getStyle: () => style(),
        checkVisibility: () => true,
        documentScrollSize: () => ({ width: 1000, height: 1000 }),
      }),
    ).toBe(true)
  })
})
