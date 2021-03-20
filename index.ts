export async function* streamToAsyncIterable<T>(stream: ReadableStream<T>): AsyncIterableIterator<T> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally { reader.releaseLock() }
}

export function asyncIterableToStreamTS<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  const { readable, writable } = new TransformStream<T, T>();
  (async () => {
    const writer = writable.getWriter();
    try {
      for await (const x of iterable) {
        writer.write(x);
      }
    } finally { writer.close() }
  })();
  return readable;
}

export function asyncIterableToStreamRS<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  return new ReadableStream({
    async pull(controller) {
      try {
        for await (const x of iterable) {
          controller.enqueue(x);
        }
      } finally { controller.close() }
    },
  });
}

const tryReadableStream = () => {
  try { new ReadableStream({}) } catch { return false }
};

// Cloudflare Workers do not support the `ReadableStream` constructor:
export const asyncIterableToStream = tryReadableStream()
  ? asyncIterableToStreamRS
  : asyncIterableToStreamTS;
