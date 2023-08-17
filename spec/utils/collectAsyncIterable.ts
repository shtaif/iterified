export default collectAsyncIterable;

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const value of iterable) {
    collected.push(value);
  }
  return collected;
}
