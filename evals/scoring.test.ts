import { describe, expect, it } from 'vitest'

import { bucket, loadCases, unsupportedFigures } from './scoring'

const c = { id: 't', q: 'What is the Fire Department budget?' }
const data = JSON.stringify({ proposed2027: '172888103.00', adopted2026: '165408632.00', change: '7479471.00', pct: '3.00', fee: '280.00', cents: 145800 })

describe('unsupportedFigures', () => {
  it('accepts figures that round from the lookup data', () => {
    expect(unsupportedFigures(c, 'Proposed: $172.9 million, up $7.5 million (3%). Fee: $280. Total $1,458.00.', data)).toEqual([])
  })
  it('flags a figure the data does not contain', () => {
    expect(unsupportedFigures(c, 'It would cost $200 million, a 12.5% jump.', data)).toEqual(['$200 million', '12.5%'])
  })
  it('ignores the per-$1,000 unit and figures from the question', () => {
    expect(unsupportedFigures({ ...c, q: 'My home is worth $250,000' }, 'At $7.29 per $1,000 of assessed value on $250,000…', '7.29')).toEqual([])
  })
})

describe('bucket', () => {
  it('ranks an unsourced figure first, then pass, then declined', () => {
    expect(bucket(true, ['$1'], false)).toBe('unsourced figure')
    expect(bucket(true, [], false)).toBe('correct')
    expect(bucket(false, [], true)).toBe("couldn't answer")
    expect(bucket(false, [], false)).toBe('incomplete')
  })
})

describe('unsupportedFigures, follow-ups', () => {
  it('accepts figures from earlier turns’ lookups and ignores trailing punctuation', () => {
    expect(unsupportedFigures(c, 'Library: $1,490,755, and Fire: $7,479,471.', '{}', '{"a":"1490755.00","b":"7479471.00"}')).toEqual([])
  })
})

describe('unsupportedFigures, false alarms from the 2026-09-24 run', () => {
  it('reads M and B abbreviations', () => {
    expect(unsupportedFigures(c, 'Requested $345.8M; proposed $343.9M; withdrawal $32.3M.', '{"a":345800000,"b":343937125,"c":32300000}')).toEqual([])
  })
  it('skips the rate unit however it is phrased, in English or Spanish', () => {
    expect(unsupportedFigures(c, 'each $1,000 of value pays less; por cada $1,000 de valor tasado', '{}')).toEqual([])
  })
  it('still flags arithmetic done in the answer', () => {
    expect(unsupportedFigures(c, 'It would rise by $8.20, from $271.80 to $280.00.', '{"a":"271.80","b":"280.00"}')).toEqual(['$8.20'])
  })
})

describe('unsupportedFigures, review fixes', () => {
  it('catches amounts written without a dollar sign', () => {
    expect(unsupportedFigures(c, 'That is 200 million dollars.', '{}')).toEqual(['200 million'])
  })
  it('ignores digits in data labels and years read as cents', () => {
    expect(unsupportedFigures(c, 'It costs $20.26.', '{"year2026":999,"fiscalYear":2026}')).toEqual(['$20.26'])
  })
  it('does not find $2 inside $2,000 in the question', () => {
    expect(unsupportedFigures({ ...c, q: 'I pay $2,000' }, 'That rises by $2.', '{}')).toEqual(['$2'])
  })
})

describe('unsupportedFigures, prose in the data', () => {
  it('reads "$218.2 million" in a fact as 218,200,000', () => {
    const facts = JSON.stringify([{ statement: 'an estimated revenue of $218.2 million. Approximately $58.8 million of the sales tax' }])
    expect(unsupportedFigures(c, 'About $218.2 million, with $58.8 million to the general fund.', facts)).toEqual([])
  })
})

describe('golden.yaml', () => {
  // YAML splits [a, or b] at the comma, turning one either/or requirement into two required items.
  it('has no requirement split at a comma', () => {
    const split = (s: string) => /^(or|nor)\b/i.test(s) || (s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length
    const fragments = loadCases().flatMap((c) => [...(c.must_include ?? []), ...(c.must_not ?? [])].map(String).filter(split).map((s) => `${c.id}: ${s}`))
    expect(fragments).toEqual([])
  })
})

describe('unsupportedFigures, bound words', () => {
  it('reads "over $32 million" as a floor, and still flags a wrong one', () => {
    expect(unsupportedFigures(c, 'Water Works is over $32 million.', '{"a":32675272}')).toEqual([])
    expect(unsupportedFigures(c, 'Water Works is over $33 million.', '{"a":32675272}')).toEqual(['$33 million'])
  })
})

describe('unsupportedFigures, rounding ties', () => {
  it('accepts a half-way value rounded down, and still flags a wrong one', () => {
    expect(unsupportedFigures(c, 'Proposed: $7.16 million.', '{"a":7165000}')).toEqual([])
    expect(unsupportedFigures(c, 'Proposed: $7.15 million.', '{"a":7165000}')).toEqual(['$7.15 million'])
  })
})
