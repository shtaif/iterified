import { Deferred } from './createDeferred';
import { type MaybePromise } from './types/MaybePromise';

export { createMulticastChannel, type MulticastChannel, type MulticastChannelIterator };

function createMulticastChannel<T>(): MulticastChannel<T> {
  let channelState = ChannelInternalState.ACTIVE;
  let channelErrorValue: unknown;
  let sharedNextEventDeferred = new Deferred<void>();
  let listTail: LinkedListNode<T> = {
    item: undefined as any,
    next: undefined,
  };

  return {
    get isClosed() {
      return channelState !== ChannelInternalState.ACTIVE;
    },

    put(value: T): void {
      if (channelState !== ChannelInternalState.ACTIVE) {
        return;
      }
      listTail.next = { item: value, next: undefined };
      listTail = listTail.next;
      sharedNextEventDeferred.resolve();
      sharedNextEventDeferred = new Deferred();
    },

    close(): void {
      channelState = ChannelInternalState.CLOSED;
      sharedNextEventDeferred.resolve();
      sharedNextEventDeferred = new Deferred();
    },

    error(errValue: unknown): void {
      channelState = ChannelInternalState.ERROR;
      channelErrorValue = errValue;
      sharedNextEventDeferred.resolve();
      sharedNextEventDeferred = new Deferred();
    },

    [Symbol.asyncIterator](): MulticastChannelIterator<T> {
      const ownNextEventDeferred = new Deferred<void>();
      let listHead = listTail;
      let isIteratorClosed = false;

      return {
        [Symbol.asyncIterator]() {
          return this;
        },

        return() {
          isIteratorClosed = true;
          ownNextEventDeferred.resolve();
          return { done: true, value: undefined };
        },

        async next() {
          if (isIteratorClosed) {
            return { done: true, value: undefined };
          }

          if (listHead.next) {
            listHead = listHead.next;
            return { done: false, value: listHead.item };
          }

          if (channelState === ChannelInternalState.CLOSED) {
            return { done: true, value: undefined };
          }

          if (channelState === ChannelInternalState.ERROR) {
            throw channelErrorValue;
          }

          await Promise.race([
            ownNextEventDeferred.promise,
            sharedNextEventDeferred.promise,
          ]);

          return this.next();
        },
      };
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

type LinkedListNode<T> = {
  item: T;
  next: LinkedListNode<T> | undefined;
};

enum ChannelInternalState {
  ACTIVE,
  CLOSED,
  ERROR,
}
