import { type MaybePromise } from './utils/types/MaybePromise';
import { MulticastChannel, createMulticastChannel } from './utils/createMulticastChannel';

export {
  iterified,
  type ExecutorFn,
  type TeardownFn,
  type IterifiedIterable,
  type Iterified,
  type IterifiedIterator,
};

function iterified<TNext>(executorFn: ExecutorFn<TNext>): IterifiedIterable<TNext> {
  let channel: MulticastChannel<TNext> | undefined;
  let suspendFurtherPushes = false;
  let activeIteratorCount = 0;
  let possiblyReturnedCleanupFnPromise: ReturnType<ExecutorFn<TNext>>;

  return {
    [Symbol.asyncIterator]() {
      if (!channel) {
        channel = createMulticastChannel<TNext>();
        suspendFurtherPushes = false;
      }

      const channelIterator = channel[Symbol.asyncIterator]();

      const gen = (async function* () {
        if (++activeIteratorCount === 1) {
          possiblyReturnedCleanupFnPromise = executorFn(pushCb, doneCb, errorCb);
          if (possiblyReturnedCleanupFnPromise instanceof Promise) {
            possiblyReturnedCleanupFnPromise.catch(err => closeIterable(true, err));
          }
        }
        try {
          for await (const value of channelIterator) {
            yield value;
          }
        } finally {
          if (--activeIteratorCount === 0) {
            await closeIterable();
          }
        }
      })();

      const originalGenReturn = gen.return as unknown as () => Promise<
        IteratorReturnResult<undefined | void>
      >;

      return Object.assign(gen, {
        async return() {
          await channelIterator.return();
          return await originalGenReturn.call(gen);
        },
      });
    },
  };

  function pushCb(nextValue: TNext): void {
    channel?.put(nextValue);
  }

  function doneCb(/*returnValue: TDone*/): void {
    closeIterable();
  }

  function errorCb(error?: unknown): void {
    closeIterable(true, error);
  }

  async function closeIterable(
    withError: boolean = false,
    errorValue: unknown = undefined
  ) {
    if (suspendFurtherPushes) {
      return;
    }
    suspendFurtherPushes = true;
    try {
      try {
        await undefined; // TODO: Explain this...
        const possibleCleanupFn = await possiblyReturnedCleanupFnPromise; // TODO: Do I need to try to speed this up by adding some conditioning in here?...
        if (possibleCleanupFn) {
          await possibleCleanupFn();
        }
      } catch (err) {
        channel?.error(err);
        throw err;
      }
      if (withError) {
        channel?.error(errorValue);
      } else {
        channel?.close();
      }
    } finally {
      channel = undefined;
    }
  }
}

type IterifiedIterable<TNextValue, TDoneValue = undefined | void> = {
  [Symbol.asyncIterator](): IterifiedIterator<TNextValue, TDoneValue>;
};

/**
 * @deprecated This type is deprecated - use {@link IterifiedIterable} instead.
 * @see {@link IterifiedIterable}
 */
type Iterified<TNextValue, TDoneValue = undefined | void> = IterifiedIterable<
  TNextValue,
  TDoneValue
>;

type IterifiedIterator<TNextValue, TDoneValue = undefined | void> = {
  next(): Promise<IteratorResult<TNextValue, TDoneValue>>;
  return(): Promise<IteratorReturnResult<TDoneValue>>;
};

type ExecutorFn<TNext> = (
  nextCb: (nextValue: TNext) => void,
  doneCb: () => void,
  errorCb: (error: unknown) => void
) => MaybePromise<void | TeardownFn>;

/**
 * ...
 * @see {@link ExecutorFn}
 */
type TeardownFn = () => MaybePromise<void>;
