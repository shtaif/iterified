import {
  iterified,
  type TeardownFn,
  type IterifiedIterable,
  type IterifiedIterator,
  type ExecutorFn,
  type Iterified,
} from './iterified';
import { iterifiedUnwrapped, type IterifiedUnwrapped } from './iterifiedUnwrapped';

export {
  iterified,
  iterifiedUnwrapped,
  type TeardownFn,
  type IterifiedIterable,
  type IterifiedUnwrapped,
  type IterifiedIterator,
  type ExecutorFn,
  type Iterified,
};

// TODO: Should implement such that when an instance is ended (or all has all its active iterators closed), it can always be reinitialized by just consuming it again, similarly with RxJS observables?
// TODO: Research setting up UMD builds (see Igal's packages)
