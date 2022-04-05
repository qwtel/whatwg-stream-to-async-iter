export async function* streamToAsyncIterable<T>(stream: ReadableStream<T>): AsyncIterableIterator<T> {
  const reader = stream.getReader();
  try {
    let { done, value } = await reader.read();
    while (!done) {
      yield value as T;
      ({ done, value } = await reader.read());
    }
    reader.releaseLock();
  } catch (err) { 
    reader.cancel(err);
  }
}

function asyncIterableToStreamTS<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  const { readable, writable } = new TransformStream<T, T>();
  (async () => {
    const writer = writable.getWriter();
    try {
      for await (const x of iterable) 
        writer.write(x);
      writer.close();
    } catch (err) { 
      writer.abort(err);
    }
  })();
  return readable;
}

function asyncIterableToStreamRS<T>(iterable: AsyncIterable<T>): ReadableStream<T> {
  return new ReadableStream({
    async pull(controller) {
      try {
        for await (const x of iterable) 
          controller.enqueue(x);
        controller.close();
      } catch (err) { 
        controller.error(err) 
      }
    },
  });
}

const tryReadableStream = () => {
  try { return !!new ReadableStream({}) } catch { return false }
};

// Cloudflare Workers do not support the `ReadableStream` constructor:
export const asyncIterableToStream = tryReadableStream()
  ? asyncIterableToStreamRS
  : asyncIterableToStreamTS;

export {
  streamToAsyncIterable as streamToAsyncIter,
  asyncIterableToStream as asyncIterToStream,
}
