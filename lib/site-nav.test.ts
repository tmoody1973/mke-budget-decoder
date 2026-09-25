import { describe, expect, it } from 'vitest'

import { currentSection } from './site-nav'

describe('currentSection', () => {
  it('is null before the first heading reaches the line', () => {
    expect(currentSection([['A', 300], ['B', 900]], 120)).toBeNull()
  })
  it('names the lowest heading already past the line, whatever the list order', () => {
    // list order B, A; page order A (higher up) then B
    expect(currentSection([['B', 40], ['A', -800]], 120)).toBe('B')
    expect(currentSection([['B', 500], ['A', -800]], 120)).toBe('A')
  })
  it('skips headings missing from the page', () => {
    expect(currentSection([['A', null], ['B', 10]], 120)).toBe('B')
  })
})
