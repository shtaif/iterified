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
- Provides [both _ESM_ and _CommonJS_](#code-importing-instructions) builds
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

<span id="code-importing-instructions">Can then be imported as follows:</span>

```ts
// in `import` style (for ESM or most TypeScript-based project):
import { iterified } from 'iterified';

// or in `require` style (for a CommonJS based project):
const { iterified } = require('iterified');
```

# Walkthrough

`iterified`, in a nutshell, transforms plain callback-style asynchronous JS programming into more powerful modern async iteration style JS programming.

### Executor function

The user-provided _executor function_ is passed to the main [`iterified`](#function-iterifiedexecutorfn) function and is meant to express in a basic, most-typically - callback style, the sequence of values wished to be yielded at the other iterable end. It is injected with 3 function arguments that serve as the "internal controls" for the overlying iterable - `next`, `done` and `error`.

This kind of encapsulation pattern is parallel to the familiar [native `Promise` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) syntax with its `resolve` and `reject` arguments, only that `iterfied` applies it to the realm of *multi-item sequences*, while promises apply it to the realm of *a single resolved item*:

```ts
// What this looks like in promises:

const promise = new Promise<string>((resolve, reject) => {
  // Do something and then call `resolve` or `reject`...
  // (cannot further call them again afterwards)
});

console.log('Resolved into:', await promise);


// Compared to what this looks like for async iterables with Iterified:

const iterable = iterified<string>((next, done, error) => {
  // Call `next` zero or more times to yield values.
  // May call `done` if/when there are no more values to yield.
  // May call `error` providing some error if something unexpected happens
  // (cannot make further calls to `next` after calling `done` or `error`)
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

### Lazily initialized

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

### Specifying teardown logic

You can optionally specify any teardown/resource cleanup logic conveniently as part of the `iterified` iterable by just returning a function at the end of the _executor_. This is the appropriate place to close and dispose of any resources opened during the _executor_'s lifetime and used to generate values from. This function may be asynchronous (return a promise).

The _teardown function_, if provided, would always be triggered automatically when either of these takes place:

- The `iterified` iterable is ended from __inside__ (meaning _initiated by the producer_); by calling the `done()` or `error(e)` callbacks from within the _executor function_

- The `iterified` iterable is ended from __outside__ (meaning _initiated by the consumer_); by closing the last remaining active iterator (or [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loop)

Here's an example showing how either the consumer or the producer could initiate closure of the iterable as well as how a teardown function to handle this is provided:

```ts
import { iterified } from 'iterified';

(async () => {
  const wsMessages = iterified<string>((next, done) => {
    const ws = new WebSocket('ws://localhost:8080');
    ws.addEventListener('message', ev => {
      next(ev.data);
      if (shouldStopYieldingFurtherMessages()) {
        done();
      }
    });
    return () => ws.close(); // <-- To ensure the web socket will properly get closed on any event that our iterable would be disposed...
  });

  for await (const msg of wsMessages) {
    console.log(msg);
    if (hadEnoughMessages()) {
      break;
    }
  }

  // Once we've broken out of the loop reaching here the web socket connection got closed off automatically.
})();
```

### Multicast iteration

The returned async iterable works as a "multicast" iterable, meaning that when obtaining multiple iterators of it (such as multiple [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loops) - each individual consumer would get the exact sequence of values as the other and thus can work independently and concurrently in a decoupled fashion - roughly resembling event emitters' typical behavior (like the web API's [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget)).

Additional consuming iterators may safely be instantiated at any time point even after the _executor function_ was kicked off - every such one would simply pick up values yielded from that time onwards.

```ts
import { iterified } from 'iterified';

const iterable = iterified<number>(next => {
  let count = 0;
  const intId = setInterval(() => next(count++), 1000);
  return () => clearInterval(intId);
});

(async () => {
  for await (const value of iterable) {
    console.log(value);
  }
})();

(async () => {
  for await (const value of iterable) {
    console.log(value);
  }
})();

// Both loops above are going to *each* print 1, 2, 3... and so on - at the same time
```

### Buffering

Since an `iterified` instance is driven by the __push-based__ nature of callbacks (inside the _executor function_), while talking to the surface as a __pull-based__ async iterable - there could be situations where it produces values faster than a certain consumer's consumption (or _pull_) rate. This might happen when the consumer has to `await` some extra async operations for each value it iterates through. However, for this `iterified` intuitively backs up every unconsumed value until consumed - hence there's no concern for loss of values had any iterator happened to lag behind.

This feature does not incur multiplied memory usage in the case of __multiple__ lagging iterators - since the backed up values are organized as one shared linked list referenced by all iterators of a particular `iterified`, traversed in each's own pace.

Per your own requirements you can choose to not rely on this backup buffer, and instead preform every iteration's processing concurrently (e.g by __not__ `await`ing anything), so that the loop isn't delayed on every iteration. This is similar to how event emitters are consumed.

# API

### function `iterified(executorFn)`

Creates an `iterified` async iterable yielding each value as it gets emitted from the user-provided _executor function_.

The user-provided _executor function_ expresses the values to be emitted and encapsulates any logic and resource management that should be involved in generating them.

The user-provided _executor function_ is invoked with the following arguments:
- `next(value: T)` - makes the iterable yield the specified value
- `done()` - makes the iterable end
- `error(err: any)` - makes the iterable error out with the specified error value (and ends it)

In addition, it may **optionally** return a teardown function for disposing of any state and opened resources that have been used during execution.

The _executor function_ will be _"lazily"_ executed only upon pulling the first value from any iterator (or [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loop) of the `iterified` iterable. Any additional iterators obtained from that point on would all feed off the same shared execution of the _executor function_ - every value it yields will be distributed ("multicast") down to each active iterator, picking up from the time it was obtained. When the iterable is ended either by the producer (_executor function_ calls `done()` or `error(e)`) or the consumer (the last active iterator is closed) - it may trigger the optionally-given teardown function and close off the `iterified` iterable. This cycle would **repeat again** as soon as the `iterified` iterable gets reconsumed.

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
