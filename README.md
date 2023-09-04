# Iterified

<p>
  <a href="https://github.com/shtaif/iterified/actions/workflows/ci-tests.yaml">
    <img alt="" src="https://github.com/shtaif/iterified/actions/workflows/ci-tests.yaml/badge.svg" />
  </a>
  <a href="https://github.com/shtaif/iterified/actions/workflows/ci-build-check.yaml">
    <img alt="" src="https://github.com/shtaif/iterified/actions/workflows/ci-build-check.yaml/badge.svg" />
  </a>
  <img alt="semantic-release" src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg" alt="" />
<p>

> Convert any callback-based sequence of values into a full-fledged async iterable

`iterified` converts any callback-style sequence of zero or more values into an async iterable equivalent. With this, you can take advantage of all the language features and semantics of async iterables, such as playing well with `async`-`await` and `for`-`await`-`of` looping, streamlined error handling with `try-catch` and encapsulatation of resource clean up - for any kind of an asynchronous value stream.

By being able to express any thing as an async iterable, it can further be supercharged using the growing number of available iterable utilities, such as [iter-tools](https://github.com/iter-tools/iter-tools), [IxJS](https://github.com/ReactiveX/IxJS) and many more.

This concept of interface resembles and is inspired by the [native `Promise` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) syntax, as well as [RxJS's plain `Observable` constructor](https://rxjs.dev/guide/observable).

### Quick usage

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

## Features

✔️ Light weight, zero run-time dependencies<br />
✔️ Fully written in TypeScript, comprehensive high-quality typings built in<br />
✔️ Provides [both _ESM_ and _CommonJS_](#code-importing-instructions) builds<br />
✔️ Compatible with both browser and Node.js environments<br />
✔️ [Semver](https://semver.org) compliant<br />

# Table of Contents

- [Installation](#installation)
- [Walkthrough](#walkthrough)
  - [Executor function](#executor-function)
  - [Lazily initialized](#lazily-initialized)
  - [Specifying teardown logic](#specifying-teardown-logic)
  - [Multicast iteration](#multicast-iteration)
  - [Buffering](#buffering)
  - [Controlling an `iterified` outside of its construction](#controlling-an-iterified-outside-of-its-construction)
- [API](#api)
  - [function iterified(executorFn)](#function-iterifiedexecutorfn)
  - [function iterifiedUnwrapped()](#function-iterifiedunwrapped)
- [Real-world examples for inspiration](#real-world-examples-for-inspiration)
- [License](#license)

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

If provided, the _teardown function_ would always be triggered automatically when either of these takes place:

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

Since an `iterified` instance is driven by the __push-based__ nature of callbacks (inside the _executor function_), while talking to the surface as a __pull-based__ async iterable - there could be situations where it produces values faster than a certain consumer's consumption (or _pull_) rate. This might happen when the consumer has to `await` some extra async operations for each value it iterates through. For these cases `iterified` intuitively backs up every unconsumed value until consumed - hence there's no concern for loss of values had any iterator happened to lag behind.

In the case of __multiple__ "lagging" iterators, this feature does NOT incur multiplied memory cost - since internally the backed up values are all organized as one linked list that's shared across all iterators of a particular `iterified`, while each iterator is able to traverse over it in its own pace.

You may choose to avoid relying on filling up this backup buffer by not suspending the consuming loop on its iterations, effectively running its work concurrently (by e.g executing the work __without__ `await`ing it). In any case, since this package deals with converting __callback-driven__ operations, we cannot escape their inherent un-regulatable nature. Therefore, there have to be a choice between either trading _potentially-unrestrained buffering_ for _potentially-unrestrained concurrency_, or vice versa. Depending on the specific circumstance, each way might be optimal or less optimal. Event emitters for comparison, adhear only to the "concurrent" mode of operation when executing handlers.

### Controlling an `iterified` outside of its construction

The _executor function_ helps to contain all the logic for how to emit values, however there are legitimate cases where being able to "push" values into the `iterified` instance from a place outside its construction (read; _executor function_) is useful.

To address such use cases - there's another function exported named [`iterifiedUnwrapped`](#function-iterifiedunwrapped) and it acts like a more stripped-down version of the main [`iterified`](#function-iterifiedexecutorfn) function; there is no concept of _executor function_ nor its lazy initialization - instead, you get back an object with the `next`, `done` and `error` callbacks __exposed as methods__ directly on it, along with an `iterable` property. This way, producers of values for this iterable could be distributed over to contexts and scopes completely unrelated to the scope where it was constructed.

Some possible application for this is to facilitate general-purpose channels of events, as illustrated here:

```ts
import { iterifiedUnwrapped } from 'iterified';

class MyTaskQueueRunner {
  #tasks: Task[] = [];
  #taskFailures = iterifiedUnwrapped<Error>();

  async start() {
    while (this.#tasks.length > 0) {
      try {
        await runNextTask();
      } catch (err) {
        this.#taskFailures.next(err);
      }
    }
  }

  get taskFailures() {
    return this.#taskFailures.iterable;
  }

  // ...
}

(async () => {
  const queue = new MyTaskQueueRunner();

  // *Do stuff and assign tasks to queue...*

  queue.start();

  for await (const taskError of queue.taskFailures) {
    console.error('Task just failed with error:', taskError);
  }
})();
```

\** Refering to our analogies with promises again - you might be familiar with a classic pattern known in the ecosystem as "`deferred`" (soon to be standardized in ECMAScript as [`Promise.withResolvers`](https://github.com/tc39/proposal-promise-with-resolvers) at the time of writing). [`iterifiedUnwrapped`](#function-iterifiedunwrapped) has a pretty much the same rational, just applying that to async iterables instead of promises.

# API

### function `iterified(executorFn)`

Creates an `iterified` async iterable, yielding each value as it gets emitted from the user-provided _executor function_.

The user-provided _executor function_ expresses the values to be emitted and encapsulates any logic and resource management that should be involved in generating them.

The user-provided _executor function_ is invoked with the following arguments:

- `next(value)` - makes the iterable yield `value` to all consuming iterators
- `done()` - makes the iterable end, closing all consuming iterators
- `error(e)` - makes the iterable error out with `e` and end, propagating the error to every consuming iterator

In addition, the _executor function_ may **optionally** return a teardown function for disposing of any state and opened resources that have been used during execution.

The _executor function_ will be _"lazily"_ executed only upon pulling the first value from any iterator (or [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) loop) of the `iterified` iterable. Any additional iterators obtained from that point on would all feed off the same shared execution of the _executor function_ - every value it yields will be distributed ("multicast") down to each active iterator, picking up from the time it was obtained. When the iterable is ended either by the producer (_executor function_ calls `done()` or `error(e)`) or the consumer (last active iterator is closed) - it would trigger an optionally-given teardown function before closing off the `iterified` iterable. This cycle would **repeat** as soon as the `iterified` iterable gets reconsumed from this state again.

```ts
import { iterified } from 'iterified';

// Iterable that emits "my_value" and ends immediately:
iterified<string>((next, done, error) => {
  next('my_value');
  done();
});
```

### function `iterifiedUnwrapped()`

Returns an object with the means for producing and consuming values exposed as direct properties.

Acts like a "stripped down" version of the main [`iterified`](#function-iterifiedexecutorfn) above. Does not receive an [_executor function_](#executor-function). Can be seen essentially as a bare, general-purpose channel of events, however while still supporting [multicasting](#multicast-iteration) and [buffering](#buffering) just as the main [`iterified`](#function-iterifiedexecutorfn) function.

Appeals to scenarios in which the scope that needs to push new values isn't decendant to the scope of construction, as is forced if using the main [`iterified`](#function-iterifiedexecutorfn).

Returns an object with the following structure:

- `.next(value)` - makes the iterable yield `value` to all consuming iterators
- `.done()` - makes the iterable end, closing all consuming iterators
- `.error(e)` - makes the iterable error out with `e` and end, propagating the error to every consuming iterator
- `.iterable` - the async iterable object, fed from the methods above

As opposed to the main [`iterified`](#function-iterifiedexecutorfn), which can implicitly initialize and uninitialize multiple times in response to how it's consumed - the object returned by `iterifiedUnwrapped` is __single-use__; once instructed to end (`.done()`) or error out (`.error(e)`) - it stays closed. If needing to signal an end as such but yet be able to continue delivering values, `iterifiedUnwrapped()` has to be called again, recreating a new object.

```ts
import { iterifiedUnwrapped } from 'iterified';

const iterifiedObj = iterifiedUnwrapped<{ color: string; }>();

iterifiedObj.next({ color: 'teal' });
iterifiedObj.next({ color: 'ikea-beige' });

iterifiedObj.done();

// Later, at a place possibly very distanced from the above:

(async () => {
  for await (const { color } of iterifiedObj.iterable) {
    console.log({ color }); // Logs "teal", "ikea-beige" and then breaks
  }
})();
```

# Real-world examples for inspiration

Iterifying a `redis` [Pub/Sub](https://github.com/redis/node-redis/blob/master/docs/pub-sub.md) subscription as an async iterable:

```ts
import { iterified } from 'iterified';
import { createClient } from 'redis';

const redisClient = createClient(/* ... */);

function redisSubscribe(pattern: string): AsyncIterable<{
  channel: string;
  message: string
}> {
  return iterified(async next => {
    const listener = (message: string, channel: string): void => {
      next({ channel, message });
    };
    await redisSubscriber.pSubscribe(pattern, listener);
    return () => redisSubscriber.pUnsubscribe(pattern, listener);
  });
}

// Later used like so:

(async () => {
  for await (const {channel, message } of redisSubscribe('my-incoming-messages:*')) {
    console.log(channel, message)
  }
})();
```

## License

[MIT License](https://github.com/shtaif/iterified/blob/master/LICENSE.txt)
