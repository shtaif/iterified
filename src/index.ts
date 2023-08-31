import {
  iterified,
  type Iterified,
  type IterifiedIterable,
  type IterifiedIterator,
} from './iterified';
import { iterifiedUnwrapped, type IterifiedUnwrapped } from './iterifiedUnwrapped';
import { type ExecutorFn } from './utils/types/ExecutorFn';

export {
  iterified,
  iterifiedUnwrapped,
  type ExecutorFn,
  type Iterified,
  type IterifiedIterable,
  type IterifiedUnwrapped,
  type IterifiedIterator,
};

// TODO: Should implement such that when an instance is ended (or all has all its active iterators closed), it can always be reinitialized by just consuming it again, similarly with RxJS observables?
// TODO: Research setting up UMD builds (see Igal's packages)
