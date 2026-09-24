// Safari can't iterate a ReadableStream with `for await`, and pdf.js reads each page's text layer
// that way (getTextContent), so opening a source page threw "undefined is not a function" on
// iPhones and Macs (PostHog, 2026-09-24). This adds the standard async iterator when it's missing.
// pdf.js's legacy build polyfills other new features but not this one. Its worker also has one such
// loop, inside a try/catch that falls back to its own decoder, so the worker needs no patch.
type IterableStream = ReadableStream & { [Symbol.asyncIterator]?: () => AsyncIterator<unknown> }

if (typeof ReadableStream !== 'undefined' && !(ReadableStream.prototype as IterableStream)[Symbol.asyncIterator]) {
  (ReadableStream.prototype as IterableStream)[Symbol.asyncIterator] = async function* (this: ReadableStream) {
    const reader = this.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
}

export {}
