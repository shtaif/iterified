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

/**
 * Creates an `iterified` async iterable, yielding each value as it gets emitted from the user-provided `executorFn`.
 *
 * The given _executor function_ will be _"lazily"_ executed only upon pulling the first value from any iterator (or [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loop) of the `iterified` iterable. Any additional iterators obtained from that point on would all feed off of the same shared execution of the _executor function_ - every value it yields will be distributed ("multicast") down to each active iterator, picking up from the time it was obtained. When the iterable is ended either by the producer (_executor function_ calls `done()` or `error(e)`) or the consumer (last active iterator is closed) - it would trigger an optionally-given teardown function before finally closing off the `iterified` iterable. This life cycle __repeats__ from the begining every time the `iterified` iterable gets reconsumed again.
 *
 * @param executorFn - a user-provided _executor function_ (see {@link ExecutorFn}) that controls the values to emit through the `iterified` iterable, closing it or erroring out, and provides logic for teardown.
 *
 * @returns an `iterified` async iterable
 *
 * @see {@link ExecutorFn}, {@link IterifiedIterable}
 *
 * @example
  ```ts
  import { iterified } from 'iterified';

  // Iterable that emits "my_value" and ends immediately:
  const iterable = iterified<string>((next, done, error) => {
    next('my_value');
    done();
  });
  ```
 *
 * @example
  ```ts
  import { iterified } from 'iterified';

  function webSocketIterable(url: string) {
    return iterified<string>((next, done, error) => {
      const ws = new WebSocket(url);

      ws.addEventListener('close', ev => done());
      ws.addEventListener('error', ev => error(ev));
      ws.addEventListener('message', ev => next(ev.data));
      
      return () => ws.close(); // <-- Ensures the web socket will properly close on any event our iterable gets disposed
    });
  }
  
  (async () => {
    for await (const msg of webSocketIterable('ws://localhost:8080')) {
      console.log(msg);
    }
  })();
  ```
 */
function iterified<T>(executorFn: ExecutorFn<T>): IterifiedIterable<T> {
  let channel = createMulticastChannel<T>();
  let activeIteratorCount = 0;
  let executorPossiblyReturnedTeardown: ReturnType<ExecutorFn<T>>;
  let teardownInProgressPromise: Promise<void> | undefined;

  function executorPushCb(nextValue: T): void {
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

/**
 * A function that expresses the values to emit through an `iterified` iterable and encapsulates any logic and resource management that should be involved in generating them.
 *
 * The _executor function_ is invoked with the following arguments:
 *
 * - `next(value)` - makes the iterable yield `value` to all consuming iterators
 * - `done()` - makes the iterable end, closing all consuming iterators
 * - `error(e)` - makes the iterable error out with given `e` and end, propagating the error to every consuming iterator
 *
 * In addition, the _executor function_ may __optionally__ return a teardown function for disposing of any state and open resources that have been used during execution.
 *
 * @see {@link TeardownFn}
 */
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
