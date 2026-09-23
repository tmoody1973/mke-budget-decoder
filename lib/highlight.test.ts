import { describe, expect, it } from 'vitest'

import { markTerms } from './highlight'

describe('markTerms (PDF text layer highlighting)', () => {
  it('wraps a cited figure, with or without a dollar sign', () => {
    expect(markTerms('$343,937,125', ['343,937,125'])).toBe('$<mark>343,937,125</mark>')
    expect(markTerms('Total 343,937,125 x', ['343,937,125'])).toBe('Total <mark>343,937,125</mark> x')
  })
  it('never marks part of a longer number', () => {
    expect(markTerms('1,343,937,1250', ['343,937,125'])).toBe('1,343,937,1250')
    expect(markTerms('7.291', ['7.29'])).toBe('7.291')
  })
  it('escapes the PDF text so it can never inject markup', () => {
    expect(markTerms('<img src=x onerror=alert(1)> 5,000', ['5,000'])).toBe('&lt;img src=x onerror=alert(1)&gt; <mark>5,000</mark>')
  })
  it('handles several terms and no terms', () => {
    expect(markTerms('310,111,835 343,937,125', ['343,937,125', '310,111,835'])).toBe('<mark>310,111,835</mark> <mark>343,937,125</mark>')
    expect(markTerms('a & b', [])).toBe('a &amp; b')
  })
})
