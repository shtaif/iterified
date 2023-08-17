export { type IterableIteratorWithReturnType };

type IterableIteratorWithReturnType<TNext = unknown, TReturn = void | undefined> = {
  [Symbol.asyncIterator](): IterableIteratorWithReturnType<TNext, TReturn>;
  next: () => Promise<IteratorResult<TNext, TReturn | undefined>>;
  return: () => Promise<IteratorReturnResult<void | undefined>>;
};
