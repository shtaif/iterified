# Iterified

`iterified` converts any callback-style sequence of zero or more values into an async iterable equivalent. With this, you can take advantage of all the language features and semantics of async iterables, such as playing well with `async`-`await` and `for`-`await`-`of` looping, streamlined error handling with `try-catch` and encapsulatation of resource clean up - for any kind of an asynchronous value stream.

By being able to express any thing as an async iterable, it can further be supercharged using the growing number of available iterable utilities, such as [iter-tools](https://github.com/iter-tools/iter-tools), [IxJS](https://github.com/ReactiveX/IxJS) and many more.

This concept of interface resembles and is inspired by the [native `Promise` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) syntax, as well as [RxJS's plain `Observable` constructor](https://rxjs.dev/guide/observable).

### Quick overview

```ts
import { iterified } from 'iterified';

const iter = iterified((next, done, error) => {
  // calling `next(...)` makes the iterable yield a value
  // calling `done()` makes the iterable end
  // calling `error(...)` makes the iterable error out
  someContinuousCallbackOperation((err, value, noMoreValues) => {
    if (err) {
      error(err);
    } else {
      next(value);
      if (noMoreValues) done();
    }
  });
});

// Consume like any typical async iterable:
(async () => {
  try {
    for await (const value of iter) {
      console.log(value);
    }
  } catch (err) {
    console.error(err);
  }
})();
```

## Features:

- Light weight, zero run-time dependencies
- Fully written in TypeScript, comprehensive high-quality typings built in
- Provides [both _ESM_ and _CommonJS_](#installation) builds
- Compatible with both browser and Node.js environments

## Installation

```sh
# With Yarn:
yarn add iterified

# With npm:
npm i iterified

# With pnpm:
pnpm i iterified
```

Can then be imported as follows:

```ts
// in `import` style (for ESM or most TypeScript-based project):
import { iterified } from 'iterified';

// or in `require` style (for a CommonJS based project):
const { iterified } = require('iterified');
```

# Walkthrough

`iterified`, in a nutshell, transforms plain callback-style asynchronous JS programming into more powerful modern async iteration style JS programming.

### Executor function

The _executor function_ is a user provided-function passed to the main [`iterified`](#function-iterifiedexecutorfn) function and is meant to express in a basic, most-typically - callback style, the sequence of values wished to be yielded at the other iterable end. It is injected with 3 function arguments that serve as "internal controls" for the overlying iterable - `next`, `done` and `error`.

This kind of encapsulation pattern is parallel to the familiar [native `Promise` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) syntax with its `resolve` and `reject` arguments, only that `iterfied` applies it to the realm of *multi-item sequences*, while promises to the realm of *a single resolved item*:

```ts
// What this looks like in promises:

const promise = new Promise<string>((resolve, reject) => {
  // Do something and then call `resolve` or `reject`...
});

console.log('Resolved into:', await promise);


// Compared to what this looks like for async iterables with iterified:

const iterable = iterified<string>((next, done, error) => {
  // Call `next` zero or more times to yield values.
  // May call `done` if/when there are no more values to yield.
  // May call `error` providing some error if something unexpected happened
});

for await (const value of iterable) {
  console.log('Received a value:', value);
}
```

Some `iterified`s having very simple executor functions for illustration:

```ts
import { iterified } from 'iterified';

(async () => {
  const iter = iterified<string>((next, done) => {
    next('a');
    next('b');
    next('c');
    done();
  });

  for await (const value of iter) {
    console.log(value); // Logs "a", "b", "c" and then closes...
  }
})();

(async () => {
  const iter = iterified<string>((next, _, error) => {
    next('a');
    error(new Error('oh no...'));
  });

  for await (const value of iter) {
    console.log(value); // Logs "a" and then throws an error...
  }
})();
```

### Lazy initialization

The provided _executor function_ is lazily-handled; executing it is delayed up to the moment of pulling an initial value from some obtained iterator. This follows the native generator functions' familiar behavior (calling them only returns a generator instance and doesn't run any actual generator code until they're actually consumed).

```ts
import { iterified } from 'iterified';

const iterable = iterified<string>((next, done) => {
  console.log('executor initialized');

  setTimeout(() => {
    next('value');
    done();
  }, 1000);
});

(async () => {
  const iterator = iterable[Symbol.asyncIterator]();

  // Nothing logged here yet...

  const item = await iterator.next(); // "executor initialized" is logged only now

  console.log(item.value); // Logs the yielded "value"
})();
```

The _executor function_ itself may optionally return another function to serve as a "tear down" logic, in which case is ensured to be invoked automatically as the last consuming iterator becomes closed. The tear down function is the appropriate place to close and dispose of any resources opened by the executor for generating values from.

The returned async iterable works as a "multicast" iterable, meaning that when obtaining multiple iterators of it (such as executing multiple [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loops) - each individual consumer would get the same sequence of yielded values and thus can work in an independent, decoupled and concurrent fashion - an aspect that roughly resembles event emitters' typical behavior (like the web API's [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget)).

Concurrent consumers of the _Iterified_ async iterable access emitted values via a single shared linked list, allowing each to process values in its own individual pace, regardless if it's faster or slower than the rate they're yielded by the _executor function_.

# API

### function `iterified(executorFn)`

Creates an _Iterified_ async iterable yielding each value as it gets emitted from the user-provided _executor function_.

The user-provided _executor function_ expresses the values to be emitted and encapsulates any logic and managable resources that may be used to generate values from.

The user-provided _executor function_ is invoked with the following arguments:
- `next(value: T)` - makes the iterable yield the specified value
- <span id="">`done()` - makes the iterable end</span>
- `error(err: any)` - makes the iterable error out with the specified error value (and ends it)

In addition, it may **optionally** return a teardown function for disposing of any state and opened resources that have been used during execution.

The _executor function_ will be _"lazily"_ executed only upon pulling the first value from any iterator (or `for await...of` loop) of it. Any additional iterators obtained from that point on would all feed off the same shared execution of the _executor function_ - every value it yields will be distributed (multicast) down to each active iterator, picking up from the time it was obtained. Whenever the last remaining consuming iterator is closed, or alternatively when calling the `done()` callback from within the _executor function_ - it would optionally trigger the teardown function if was given, and close off the _Iterified_ iterable. This cycle is repeated again as soon as the _Iterified_ iterable gets reconsumed.

```ts
import { iterified } from 'iterified';

iterified<string>((next, done, error) => {
  next('value');
  done();
});
```

### function `iterifiedUnwrapped()`

Like a "stripped down" version of the main [`iterified`](#function-iterifiedexecutorfn) above.

# Demonstrative examples

Encapsulating a `redis` [Pub/Sub](https://github.com/redis/node-redis/blob/master/docs/pub-sub.md) subscription as an async iterable:

```ts
import { iterified } from 'iterified';
import { createClient } from 'redis';

const channelsToSubscribe = ['my-channel-1', 'my-channel-2'];

const redisClient = createClient(/* ... */);

const redisChannelMessages = iterified(async (next, done, error) => {
  const msgHandler = (channel, message) =>
    next({
      channel,
      message,
    });

  try {
    await redisClient.subscribe(...channelsToSubscribe);
  } catch (err) {
    error(err);
  }

  redisClient.on('message', msgHandler);

  return async () => {
    await redisClient.unsubscribe(...channelsToSubscribe);
    msgHandler.off(msgHandler);
  };
});

(async () => {
  for await (const { channel, message } of redisChannelMessages) {
    console.log(`Received ${message} from ${channel}`);
  }
})();
```

## License

[MIT License](https://github.com/shtaif/iterified/blob/master/LICENSE.txt)
