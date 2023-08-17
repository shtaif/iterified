import 'mocha';
import expect from 'expect';
import * as sinon from 'sinon';
import { iterified, iterifiedUnwrapped, type ExecutorFn } from '../src';
import nextTick from './utils/nextTick';
import getPromiseState from './utils/getPromiseState';
import collectAsyncIterable from './utils/collectAsyncIterable';
import sortPromisesByResolutionOrder from './utils/sortPromisesByResolutionOrder';

// TODO: Test for behavior of when the cleanup function itself throws/rejects

it('generating a single value and consuming via multiple iterators', async () => {
  const iterable = iterified(next => next('value'));

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1Item = await it1.next();
  const it2Item = await it2.next();

  expect([it1Item, it2Item]).toStrictEqual([
    { done: false, value: 'value' },
    { done: false, value: 'value' },
  ]);
});

it('multiple values generated get queued in order for each iterator individually until consumed', async () => {
  const iter = iterified(next => {
    next('value_1');
    next('value_2');
    next('value_3');
  });

  const it1 = iter[Symbol.asyncIterator]();
  const it2 = iter[Symbol.asyncIterator]();

  const it1Items = [await it1.next(), await it1.next(), await it1.next()];
  const it2Items = [await it2.next(), await it2.next(), await it2.next()];

  expect([it1Items, it2Items]).toStrictEqual([
    [
      { done: false, value: 'value_1' },
      { done: false, value: 'value_2' },
      { done: false, value: 'value_3' },
    ],
    [
      { done: false, value: 'value_1' },
      { done: false, value: 'value_2' },
      { done: false, value: 'value_3' },
    ],
  ]);
});

it('iterable that generates one value and ends consumed via multiple iterators', async () => {
  const iterable = iterified((next, done) => {
    next('value');
    done();
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1Items = [await it1.next(), await it1.next()];
  const it2Items = [await it2.next(), await it2.next()];

  expect([it1Items, it2Items]).toStrictEqual([
    [
      { done: false, value: 'value' },
      { done: true, value: undefined },
    ],
    [
      { done: false, value: 'value' },
      { done: true, value: undefined },
    ],
  ]);
});

it('iterable that ends immediately without generating values consumed via multiple iterators', async () => {
  const iter = iterified((_, done) => done());

  const it1 = iter[Symbol.asyncIterator]();
  const it2 = iter[Symbol.asyncIterator]();

  const it1Item = await it1.next();
  const it2Item = await it2.next();

  expect([it1Item, it2Item]).toStrictEqual([
    { done: true, value: undefined },
    { done: true, value: undefined },
  ]);
});

it('iterators from the same iterable obtained at different points in time will pick up only values generated from the time they were obtained and onwards respectively', async () => {
  const { iterable, next, done } = iterifiedUnwrapped<number>();

  const it1 = iterable[Symbol.asyncIterator]();
  next(1), next(2);
  const it2 = iterable[Symbol.asyncIterator]();
  next(3), next(4);
  const it3 = iterable[Symbol.asyncIterator]();
  next(5), next(6);
  const it4 = iterable[Symbol.asyncIterator]();
  done();

  const [it1ValuesCaught, it2ValuesCaught, it3ValuesCaught, it4ValuesCaught] = [
    await collectAsyncIterable({ [Symbol.asyncIterator]: () => it1 }),
    await collectAsyncIterable({ [Symbol.asyncIterator]: () => it2 }),
    await collectAsyncIterable({ [Symbol.asyncIterator]: () => it3 }),
    await collectAsyncIterable({ [Symbol.asyncIterator]: () => it4 }),
  ];

  expect([
    it1ValuesCaught,
    it2ValuesCaught,
    it3ValuesCaught,
    it4ValuesCaught,
  ]).toStrictEqual([[1, 2, 3, 4, 5, 6], [3, 4, 5, 6], [5, 6], []]);
});

it('when pulling one or move values out of iterators before they any were yet generated, the returned pending promises will resolve one by one in the order they were pulled as each consequent value becomes available', async () => {
  const { iterable, next } = iterifiedUnwrapped<string>();

  const iterator = iterable[Symbol.asyncIterator]();

  const valPromises = [iterator.next(), iterator.next()];

  const promiseStatesBeforePush1 = await Promise.all(valPromises.map(getPromiseState));
  next('value_1');
  const promiseStatesBeforePush2 = await Promise.all(valPromises.map(getPromiseState));
  next('value_2');

  const emitted = await Promise.all(valPromises);

  expect([promiseStatesBeforePush1, promiseStatesBeforePush2]).toStrictEqual([
    ['PENDING', 'PENDING'],
    ['RESOLVED', 'PENDING'],
  ]);
  expect(emitted).toStrictEqual([
    { done: false, value: 'value_1' },
    { done: false, value: 'value_2' },
  ]);
});

it('*synchronous* exception thrown from executor function propagates up only to the first iterator consuming it', async () => {
  const iterable = iterified(() => {
    throw new Error('oops...');
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1IterationPromise = it1.next();
  const it2IterationPromise = it2.next();

  expect(await getPromiseState(it1IterationPromise)).toBe('REJECTED');
  expect(await getPromiseState(it2IterationPromise)).toBe('PENDING');
  await expect(it1IterationPromise).rejects.toMatchObject({
    message: 'oops...',
  });
});

it('*asynchronous* exception thrown from executor function propagates up to multiple simultaneous consuming iterators', async () => {
  const iterable = iterified(async () => {
    await nextTick();
    throw new Error('oops...');
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1ItemPromise = it1.next();
  const it2ItemPromise = it2.next();

  await expect(it1ItemPromise).rejects.toMatchObject({ message: 'oops...' });
  await expect(it2ItemPromise).rejects.toMatchObject({ message: 'oops...' });
});

it('error generated *synchronously* from within executor function propagates up to multiple simultaneous consuming iterators', async () => {
  const iterable = iterified((_, __, error) => {
    error(new Error('oops...'));
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1ItemPromise = it1.next();
  const it2ItemPromise = it2.next();

  await expect(it1ItemPromise).rejects.toMatchObject({ message: 'oops...' });
  await expect(it2ItemPromise).rejects.toMatchObject({ message: 'oops...' });
});

it('error generated *asynchronously* from within executor function propagates up to multiple simultaneous consuming iterators', async () => {
  const iterable = iterified(async (_, __, error) => {
    error(new Error('oops...'));
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const it1ItemPromise = it1.next();
  const it2ItemPromise = it2.next();

  await expect(it1ItemPromise).rejects.toMatchObject({ message: 'oops...' });
  await expect(it2ItemPromise).rejects.toMatchObject({ message: 'oops...' });
});

it('consequent pulls from iterable that was ended will always return a "done" result', async () => {
  const iter = iterified((_, done) => {
    done();
  })[Symbol.asyncIterator]();

  iter.next();
  const item1 = await iter.next();
  const item2 = await iter.next();

  expect([item1, item2]).toStrictEqual([
    { done: true, value: undefined },
    { done: true, value: undefined },
  ]);
});

it('consequent pulls from iterable that had errored will always return a "done" result', async () => {
  const it = iterified((_, __, error) => {
    error(new Error('oops...'));
  })[Symbol.asyncIterator]();

  it.next();
  const item1 = await it.next();
  const item2 = await it.next();

  expect([item1, item2]).toStrictEqual([
    { done: true, value: undefined },
    { done: true, value: undefined },
  ]);
});

it('the given executor function is only ever called once when the first item is pulled from any iterator of the iterable', async () => {
  const spiedExecutorFn = sinon.spy<ExecutorFn<string>>((next, done) => {
    next('value');
    next('value');
    next('value');
    done();
  });

  const it = iterified(spiedExecutorFn)[Symbol.asyncIterator]();

  const callCountBeforePull = spiedExecutorFn.callCount;

  await it.next();
  const callCountAfterPull = spiedExecutorFn.callCount;

  await it.next(), await it.next();
  const callCountAfterFurtherPulls = spiedExecutorFn.callCount;

  expect([
    callCountBeforePull,
    callCountAfterPull,
    callCountAfterFurtherPulls,
  ]).toStrictEqual([0, 1, 1]);
});

it('whenever an iterator is closed, it immediately resolves every pending promise pulled beforehand specifically from it to a "done" result', async () => {
  const iterable = iterified(() => {});
  const iterator1 = iterable[Symbol.asyncIterator]();
  const iterator2 = iterable[Symbol.asyncIterator]();

  const [iterator1Promise1, iterator1Promise2, iterator2Promise1, iterator2Promise2] = [
    iterator1.next(),
    iterator1.next(),
    iterator2.next(),
    iterator2.next(),
  ];

  await iterator1.return();

  const promiseStatusesAfterIterator1Close = await Promise.all([
    getPromiseState(iterator1Promise1),
    getPromiseState(iterator1Promise2),
    getPromiseState(iterator2Promise1),
    getPromiseState(iterator2Promise2),
  ]);

  await iterator2.return();

  const promiseStatusesAfterIterator2Close = await Promise.all([
    getPromiseState(iterator1Promise1),
    getPromiseState(iterator1Promise2),
    getPromiseState(iterator2Promise1),
    getPromiseState(iterator2Promise2),
  ]);

  expect([
    promiseStatusesAfterIterator1Close,
    promiseStatusesAfterIterator2Close,
  ]).toStrictEqual([
    ['RESOLVED', 'RESOLVED', 'PENDING', 'PENDING'],
    ['RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED'],
  ]);
  expect(
    await Promise.all([
      iterator1Promise1,
      iterator1Promise2,
      iterator2Promise1,
      iterator2Promise2,
    ])
  ).toStrictEqual([
    { done: true, value: undefined },
    { done: true, value: undefined },
    { done: true, value: undefined },
    { done: true, value: undefined },
  ]);
});

it('when the last active iterator gets closed, cleanup function is called', async () => {
  const spiedCleanupFn = sinon.spy();

  const iterable = iterified(() => spiedCleanupFn);

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  it1.next(), it2.next(); // "Activate" both iterators by just pulling something out of each

  const callCountBeforeCloseIt1 = spiedCleanupFn.callCount;
  await it1.return();
  const callCountBeforeCloseIt2 = spiedCleanupFn.callCount;
  await it2.return();
  const callCountAfterBothClosed = spiedCleanupFn.callCount;

  expect([
    callCountBeforeCloseIt1,
    callCountBeforeCloseIt2,
    callCountAfterBothClosed,
  ]).toStrictEqual([0, 0, 1]);
});

it('when the iterable gets ended through the executor function, cleanup function is called', async () => {
  const spiedCleanupFn = sinon.spy();

  const it = iterified<void>(async (next, done) => {
    next();
    await nextTick();
    done();
    await nextTick();
    return spiedCleanupFn;
  })[Symbol.asyncIterator]();

  await it.next();
  const callCountBefore = spiedCleanupFn.callCount;
  await it.next();
  const callCountAfter = spiedCleanupFn.callCount;

  expect([callCountBefore, callCountAfter]).toStrictEqual([0, 1]);
});

it('when the iterable gets ended through the executor function, the "ending" promise got from its iterator will only resolve after cleanup function has asyncly finished running', async () => {
  let spiedCleanupFnFinishedPromiseResolve;

  const spiedCleanupFnFinishedPromise = new Promise(
    resolve => (spiedCleanupFnFinishedPromiseResolve = resolve)
  );

  const iterable = iterified<void>(async (next, done) => {
    next();
    done();
    return async () => {
      await nextTick();
      spiedCleanupFnFinishedPromiseResolve();
    };
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const [, , finalYieldPromise1, finalYieldPromise2] = [
    it1.next(),
    it2.next(),
    it1.next(),
    it2.next(),
  ];

  const [promiseResolvedFirst] = await sortPromisesByResolutionOrder([
    spiedCleanupFnFinishedPromise,
    finalYieldPromise1,
    finalYieldPromise2,
  ]);

  expect(promiseResolvedFirst).toStrictEqual(spiedCleanupFnFinishedPromise);
});

it('when the iterable gets errored through the executor function, the "erroring" promise got from its iterator will reject only after cleanup function has asyncly finished running', async () => {
  let spiedCleanupFnFinishedPromiseResolve;

  const spiedCleanupFnFinishedPromise = new Promise(
    resolve => (spiedCleanupFnFinishedPromiseResolve = resolve)
  );

  const iterable = iterified<void>((next, _, error) => {
    next();
    error();
    return async () => {
      await nextTick();
      spiedCleanupFnFinishedPromiseResolve();
    };
  });

  const it1 = iterable[Symbol.asyncIterator]();
  const it2 = iterable[Symbol.asyncIterator]();

  const [, , errorPromise1, errorPromise2] = [
    it1.next().catch(),
    it2.next().catch(),
    it1.next().catch(() => {}),
    it2.next().catch(() => {}),
  ];

  const [promiseResolvedFirst] = await sortPromisesByResolutionOrder([
    spiedCleanupFnFinishedPromise,
    errorPromise1,
    errorPromise2,
  ]);

  expect(promiseResolvedFirst).toBe(spiedCleanupFnFinishedPromise);
});

it('an iterified iterable can be reconsumed again after previously ended/got closed, reinvoking cleanup and executor functions respectively every time', async () => {
  const spiedExecutorFn = sinon.spy<ExecutorFn<number>>((next, done) => {
    next(1);
    next(2);
    done();
    return spiedCleanupFn;
  });

  const spiedCleanupFn = sinon.spy(() => {});

  const iterable = iterified(spiedExecutorFn);

  const it1 = iterable[Symbol.asyncIterator]();
  await it1.next();
  await it1.return();
  const executorCallCountAtEnd1 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd1 = spiedCleanupFn.callCount;

  const it2 = iterable[Symbol.asyncIterator]();
  await it2.next();
  await it2.return();
  const executorCallCountAtEnd2 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd2 = spiedCleanupFn.callCount;

  const it3 = iterable[Symbol.asyncIterator]();
  await it3.next();
  await it3.return();
  const executorCallCountAtEnd3 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd3 = spiedCleanupFn.callCount;

  expect([
    executorCallCountAtEnd1,
    executorCallCountAtEnd2,
    executorCallCountAtEnd3,
  ]).toStrictEqual([1, 2, 3]);
  expect([
    cleanupCallCountAtEnd1,
    cleanupCallCountAtEnd2,
    cleanupCallCountAtEnd3,
  ]).toStrictEqual([1, 2, 3]);
});

it('an iterified iterable can be reconsumed again after previously errored, reinvoking cleanup and executor functions respectively every time', async () => {
  const spiedExecutorFn = sinon.spy<ExecutorFn<number>>((_, __, error) => {
    error(new Error('Oh no!'));
    return spiedCleanupFn;
  });

  const spiedCleanupFn = sinon.spy(() => {});

  const iterable = iterified(spiedExecutorFn);

  const it1 = iterable[Symbol.asyncIterator]();
  try {
    await it1.next();
  } catch {}
  const executorCallCountAtEnd1 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd1 = spiedCleanupFn.callCount;

  const it2 = iterable[Symbol.asyncIterator]();
  try {
    await it2.next();
  } catch {}
  const executorCallCountAtEnd2 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd2 = spiedCleanupFn.callCount;

  const it3 = iterable[Symbol.asyncIterator]();
  try {
    await it3.next();
  } catch {}
  const executorCallCountAtEnd3 = spiedExecutorFn.callCount;
  const cleanupCallCountAtEnd3 = spiedCleanupFn.callCount;

  expect([
    executorCallCountAtEnd1,
    executorCallCountAtEnd2,
    executorCallCountAtEnd3,
  ]).toStrictEqual([1, 2, 3]);
  expect([
    cleanupCallCountAtEnd1,
    cleanupCallCountAtEnd2,
    cleanupCallCountAtEnd3,
  ]).toStrictEqual([1, 2, 3]);
});
