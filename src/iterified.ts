import { createMulticastChannel } from './utils/createMulticastChannel';
import { type MaybePromise } from './utils/types/MaybePromise';

export {
  iterified,
  type ExecutorFn,
  type TeardownFn,
  type IterifiedIterable,
  type Iterified,
  type IterifiedIterator,
};

function iterified<TNext>(executorFn: ExecutorFn<TNext>): IterifiedIterable<TNext> {
  let channel = createMulticastChannel<TNext>();
  let activeIteratorCount = 0;
  let executorPossiblyReturnedTeardown: ReturnType<ExecutorFn<TNext>>;
  let teardownInProgressPromise: Promise<void> | undefined;

  function executorPushCb(nextValue: TNext): void {
    if (!teardownInProgressPromise) {
      channel.put(nextValue);
    }
  }

  function executorDoneCb(): void {
    if (!teardownInProgressPromise) {
      channel.close();
    }
  }

  function executorErrorCb(error?: unknown): void {
    if (!teardownInProgressPromise) {
      channel.error(error);
    }
  }

  return {
    [Symbol.asyncIterator]() {
      const channelIterator = channel[Symbol.asyncIterator]();

      const gen = (async function* () {
        try {
          if (++activeIteratorCount === 1) {
            const initialNextPromise = channelIterator.next();

            try {
              executorPossiblyReturnedTeardown = executorFn(
                executorPushCb,
                executorDoneCb,
                executorErrorCb
              );
            } catch (err) {
              // TODO: For next major - remove this whole `catch` block with its operations in order to make *synchronous* exceptions thrown from executor to propagate up to ALL actively consuming iterators instead of only to the first one to consume it like it currently works
              channel.close();
              await channelIterator.return();
              throw err;
            }

            (async () => {
              try {
                await executorPossiblyReturnedTeardown;
              } catch (err) {
                channel.error(err);
              }
            })();

            const initialNext = await initialNextPromise;
            if (initialNext.done) {
              return;
            }
            yield initialNext.value;
          }

          yield* channelIterator;
        } finally {
          activeIteratorCount--;

          if (
            !teardownInProgressPromise &&
            (channel.isClosed || activeIteratorCount === 0)
          ) {
            teardownInProgressPromise = (async () => {
              try {
                const possibleTeardownFn = await executorPossiblyReturnedTeardown; // TODO: Do I need to try to speed this up by adding some conditioning in here?...
                await possibleTeardownFn?.();
              } finally {
                channel = createMulticastChannel();
                teardownInProgressPromise = undefined;
              }
            })();
          }

          if (teardownInProgressPromise) {
            await teardownInProgressPromise;
          }
        }
      })();

      return Object.assign(gen, {
        return: (() => {
          const originalGenReturn = gen.return;

          return async function () {
            await channelIterator.return();
            await originalGenReturn.call(gen);
            return { done: true as const, value: undefined };
          };
        })(),
      });
    },
  };
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
  next: (nextValue: TNext) => void,
  done: () => void,
  error: (error: unknown) => void
) => MaybePromise<void | TeardownFn>;

/**
 * A teardown function which can be optionally returned from the _Executor function_ ({@link ExecutorFn})
 * provided by the user.
 *
 * This is the appropriate place to close and dispose of any resources opened during the
 * _executor_'s lifetime and used to generate values from. This function may be asynchronous
 * (return a promise).
 *
 * If provided, the _teardown function_ would always be triggered automatically when either
 * of these takes place:
 *
 * - The `iterified` iterable is ended from __inside__ (meaning _initiated by the producer_);
 * by calling the `done()` or `error(e)` callbacks from within the _executor function_
 *
 * - The `iterified` iterable is ended from __outside__ (meaning _initiated by the consumer_);
 * by closing the last remaining active iterator
 * (or [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loop)
 *
 * @see {@link ExecutorFn}
 *
 * @see https://github.com/shtaif/iterified#specifying-teardown-logic for more reference
 */
type TeardownFn = () => MaybePromise<void>;
