export type ForAwaitable<T> = Iterable<T> | AsyncIterable<T>;
export { ForAwaitable as ForOfAwaitable }

export type ForAwaitableIterator<T> = AsyncIterator<T> | Iterator<T>

const isIterable = <T>(x: unknown): x is Iterable<T> =>
  x != null && typeof x === 'object' && Symbol.iterator in x

const isAsyncIterable = <T>(x: unknown): x is AsyncIterable<T> =>
  x != null && typeof x === 'object' && Symbol.asyncIterator in x

const forAwaitableIterator = <T>(x: unknown): ForAwaitableIterator<T> =>
  isAsyncIterable<T>(x)
    ? x[Symbol.asyncIterator]()
    : isIterable<T>(x) 
      ? x[Symbol.iterator]()
      : (() => { throw Error('Not for-awaitable. Neither Symbol.asyncIterator nor Symbol.iterator found.') })()

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

// Older version of Cloudflare Workers do not support the `ReadableStream` constructor, 
// so we use a TransformStream instead:
function asyncIterableToStreamTS<T>(iterable: ForAwaitable<T>): ReadableStream<T> {
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

function asyncIterableToStreamRS<T>(iterable: ForAwaitable<T>): ReadableStream<T> {
  let iterator: ForAwaitableIterator<T>;
  return new ReadableStream({
    start() {
      iterator = forAwaitableIterator(iterable);
    },
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (!done) controller.enqueue(value); else controller.close();
    },
    async cancel(reason) {
      try { await iterator.throw?.(reason) } catch { }
    },
  });
}

const tryReadableStream = () => {
  try { return !!new ReadableStream({}) } catch { return false }
};

export const asyncIterableToStream: <T>(iterable: ForAwaitable<T>) => ReadableStream<T> = tryReadableStream()
  ? asyncIterableToStreamRS
  : asyncIterableToStreamTS;

export {
  streamToAsyncIterable as streamToAsyncIter,
  asyncIterableToStream as asyncIterToStream,
}
