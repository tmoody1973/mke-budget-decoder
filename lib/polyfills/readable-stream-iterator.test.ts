import { describe, expect, it } from 'vitest'

describe('ReadableStream async iterator polyfill', () => {
  it('lets for-await read a stream when the browser lacks it (Safari)', async () => {
    const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>
    const native = proto[Symbol.asyncIterator]
    delete proto[Symbol.asyncIterator] // behave like Safari
    try {
      await import('./readable-stream-iterator')
      const stream = new ReadableStream({ start(c) { c.enqueue('a'); c.enqueue('b'); c.close() } })
      const seen: unknown[] = []
      for await (const chunk of stream as unknown as AsyncIterable<unknown>) seen.push(chunk)
      expect(seen).toEqual(['a', 'b'])
    } finally {
      proto[Symbol.asyncIterator] = native
    }
  })
})
