import {
  iterified,
  type IterifiedIterable,
  type IterifiedIterator,
  type ExecutorFn,
  type TeardownFn,
  type Iterified,
} from './iterified.js';
import { iterifiedUnwrapped, type IterifiedUnwrapped } from './iterifiedUnwrapped.js';

export {
  iterified,
  iterifiedUnwrapped,
  type IterifiedIterable,
  type IterifiedUnwrapped,
  type IterifiedIterator,
  type ExecutorFn,
  type TeardownFn,
  type Iterified,
};

// TODO: Should implement such that when an instance is ended (or all has all its active iterators closed), it can always be reinitialized by just consuming it again, similarly with RxJS observables?
// TODO: Research setting up UMD builds (see Igal's packages)
