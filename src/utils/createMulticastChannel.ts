import createDeferred, { Deferred } from './createDeferred';
import makeCallableOnceAtATime from './intoCallableOnceAtATime';
import { type MaybePromise } from './types/MaybePromise';

export { createMulticastChannel, type MulticastChannel, type MulticastChannelIterator };

function createMulticastChannel<T>(): MulticastChannel<T> {
  const pendingNextPutDeferreds: Map<object, Deferred<void>> = new Map();
  let isChannelClosed = false;
  let listTail: QueuedItemNode<T> = {
    item: undefined as any,
    next: undefined,
  };

  return {
    put(value: T): void {
      if (isChannelClosed) {
        return;
      }
      listTail.next = { item: value, next: undefined };
      listTail = listTail.next;
      pendingNextPutDeferreds.forEach(deferred => deferred.resolve());
    },

    close(): void {
      isChannelClosed = true;
      pendingNextPutDeferreds.forEach(deferred => deferred.resolve());
    },

    error(errValue: unknown): void {
      isChannelClosed = true;
      pendingNextPutDeferreds.forEach(deferred => deferred.reject(errValue));
    },

    get isClosed() {
      return isChannelClosed;
    },

    [Symbol.asyncIterator](): MulticastChannelIterator<T> {
      let isIteratorClosed = false;
      let listHead = listTail;

      const thisIterator = {
        [Symbol.asyncIterator]() {
          return this;
        },

        return() {
          isIteratorClosed = true;
          pendingNextPutDeferreds.get(thisIterator)?.resolve();
          return { done: true as const, value: undefined };
        },

        next: makeCallableOnceAtATime(async () => {
          if (isIteratorClosed) {
            return { done: true as const, value: undefined };
          }

          if (listHead !== listTail) {
            listHead = listHead.next!;
            return { done: false as const, value: listHead.item };
          }

          if (isChannelClosed) {
            return { done: true as const, value: undefined };
          }

          try {
            const deferred = createDeferred();
            pendingNextPutDeferreds.set(thisIterator, deferred);
            await deferred.promise;
          } finally {
            pendingNextPutDeferreds.delete(thisIterator);
          }

          if (listHead !== listTail) {
            listHead = listHead.next!;
            return { done: false as const, value: listHead.item };
          }

          return { done: true as const, value: undefined };
        }),
      };

      return thisIterator;
    },
  };
}

type MulticastChannel<T> = {
  put(value: T): void;
  close(): void;
  error(errValue: unknown): void;
  isClosed: boolean;
  [Symbol.asyncIterator](): MulticastChannelIterator<T>;
};

type MulticastChannelIterator<T> = {
  return: () => IteratorReturnResult<undefined>;
  next: () => MaybePromise<IteratorResult<T, undefined>>;
  [Symbol.asyncIterator](): MulticastChannelIterator<T>;
};

type QueuedItemNode<T> = {
  item: T;
  next: QueuedItemNode<T> | undefined;
};
