// Last-resort guard for the chat stream (D24): if a run reaches RUN_FINISHED without any answer text,
// add a short assistant message first, so a visitor never gets a blank reply. Every event passes
// through unchanged; the stream is AG-UI server-sent events ("data: {json}\n\n").
export const BLANK_ANSWER_TEXT = 'I looked this up but couldn’t finish writing the answer. Try asking about one department or one figure at a time.'

const TEXT_EVENTS = new Set(['TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_CHUNK'])

export function guardBlankAnswer(body: ReadableStream<Uint8Array>, text = BLANK_ANSWER_TEXT): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder(), encoder = new TextEncoder()
  let buffer = '', sawText = false
  const handle = (frame: string, out: TransformStreamDefaultController<Uint8Array>) => {
    const data = frame.startsWith('data: ') ? frame.slice(6) : ''
    let event: { type?: string; delta?: string } = {}
    try { event = data ? JSON.parse(data) : {} } catch { /* not JSON: pass through as is */ }
    if (TEXT_EVENTS.has(event.type ?? '') && event.delta?.trim()) sawText = true
    if (event.type === 'RUN_FINISHED' && !sawText) {
      const messageId = crypto.randomUUID()
      for (const e of [{ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' }, { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text }, { type: 'TEXT_MESSAGE_END', messageId }])
        out.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      sawText = true
    }
    out.enqueue(encoder.encode(`${frame}\n\n`))
  }
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, out) {
      buffer += decoder.decode(chunk, { stream: true })
      let end
      while ((end = buffer.indexOf('\n\n')) >= 0) { handle(buffer.slice(0, end), out); buffer = buffer.slice(end + 2) }
    },
    flush(out) { if (buffer) out.enqueue(encoder.encode(buffer)) },
  }))
}
