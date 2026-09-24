import { describe, expect, it } from 'vitest'

import { BLANK_ANSWER_TEXT, guardBlankAnswer } from './blank-guard'

const sse = (events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
// Split into odd-sized chunks, as the network does, so frames straddle chunk boundaries.
const streamOf = (s: string) => new ReadableStream<Uint8Array>({
  start(c) { const b = new TextEncoder().encode(s); for (let i = 0; i < b.length; i += 7) c.enqueue(b.slice(i, i + 7)); c.close() },
})
const read = async (s: ReadableStream<Uint8Array>) => new Response(s).text()
const types = (s: string) => s.split('\n\n').filter(Boolean).map((f) => JSON.parse(f.slice(6)).type as string)

describe('guardBlankAnswer', () => {
  it('adds a message before RUN_FINISHED when no text was sent', async () => {
    const out = await read(guardBlankAnswer(streamOf(sse([{ type: 'RUN_STARTED' }, { type: 'TOOL_CALL_START' }, { type: 'RUN_FINISHED' }]))))
    expect(types(out)).toEqual(['RUN_STARTED', 'TOOL_CALL_START', 'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END', 'RUN_FINISHED'])
    expect(out).toContain(JSON.stringify(BLANK_ANSWER_TEXT).slice(1, 20))
  })
  it('passes a normal answer through unchanged', async () => {
    const original = sse([{ type: 'RUN_STARTED' }, { type: 'TEXT_MESSAGE_START' }, { type: 'TEXT_MESSAGE_CONTENT', delta: 'The Fire…' }, { type: 'TEXT_MESSAGE_END' }, { type: 'RUN_FINISHED' }])
    expect(await read(guardBlankAnswer(streamOf(original)))).toBe(original)
  })
  it('treats whitespace-only text as blank', async () => {
    const out = await read(guardBlankAnswer(streamOf(sse([{ type: 'TEXT_MESSAGE_CONTENT', delta: '  ' }, { type: 'RUN_FINISHED' }]))))
    expect(types(out)).toContain('TEXT_MESSAGE_START')
  })
})
