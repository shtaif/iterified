## [1.2.5](https://github.com/shtaif/iterified/compare/v1.2.4...v1.2.5) (2024-06-22)


### Bug Fixes

* fix ESM build to contain `import` statements with full file extensions ([#49](https://github.com/shtaif/iterified/issues/49)) ([2aad91d](https://github.com/shtaif/iterified/commit/2aad91daa155a8ff50ea3cd08e73caed1d4c5e3e))


### Refactor

* internal logic fix in the multicast channel code (no public behavior impact) - ensure to mark a channel's iterator as closed for further pull attempts as soon as it realizes its parent channel itself had already ended/errored out ([#47](https://github.com/shtaif/iterified/issues/47)) ([d11a74b](https://github.com/shtaif/iterified/commit/d11a74b738aeccbbfdfb41c42071507d60be4e67))


### Tests

* split the single current test file into two - one having all the tests relevant only for the `iterified` function and the other all the tests relevant only for `iterifiedUnwrapped` ([#48](https://github.com/shtaif/iterified/issues/48)) ([815d357](https://github.com/shtaif/iterified/commit/815d357090ddea566c5194acd3aa627311b8ac39))

## [1.2.4](https://github.com/shtaif/iterified/compare/v1.2.3...v1.2.4) (2023-09-29)


### Refactor

* internal code refactoring to simplify and untangle a bit the processes that happen across mainly `createMulticastChannel.ts` and `iterified.ts` ([#43](https://github.com/shtaif/iterified/issues/43)) ([cc8f333](https://github.com/shtaif/iterified/commit/cc8f333601c73928a4e5e254fef38522294785d8))


### Tests

* edit test titles' wording ([#42](https://github.com/shtaif/iterified/issues/42)) ([d636e3a](https://github.com/shtaif/iterified/commit/d636e3a66798872d0c2acd06fe784c326df4c89e))


### Documentation

* edit and add some more JSDocs ([#46](https://github.com/shtaif/iterified/issues/46)) ([a7141ec](https://github.com/shtaif/iterified/commit/a7141ec5b9afe4343273d8d3c075744b2c9f6d91))
* small assorted edits across `README.md` ([#45](https://github.com/shtaif/iterified/issues/45)) ([ec15cde](https://github.com/shtaif/iterified/commit/ec15cdebf5aeece7c1eb471b0c0c22e26f0020f1))

## [1.2.3](https://github.com/shtaif/iterified/compare/v1.2.2...v1.2.3) (2023-09-18)


### Bug Fixes

* synchronous exceptions thrown from executor function causing consecutive pulls past the initial rejected one to hang indefinitely without resolving ([#41](https://github.com/shtaif/iterified/issues/41)) ([e36faf4](https://github.com/shtaif/iterified/commit/e36faf49d73bb23bf897c737bfc4c66433c9adf9))

## [1.2.2](https://github.com/shtaif/iterified/compare/v1.2.1...v1.2.2) (2023-09-17)

## [1.2.1](https://github.com/shtaif/iterified/compare/v1.2.0...v1.2.1) (2023-09-17)

# [1.2.0](https://github.com/shtaif/iterified/compare/v1.1.1...v1.2.0) (2023-09-04)


### Features

* introduce a named type to represent the teardown function, export as part of public API ([#33](https://github.com/shtaif/iterified/issues/33)) ([6ca035b](https://github.com/shtaif/iterified/commit/6ca035b966acf356ff700343436eb95cbbde6ac2))

## [1.1.1](https://github.com/shtaif/iterified/compare/v1.1.0...v1.1.1) (2023-09-03)

# [1.1.0](https://github.com/shtaif/iterified/compare/v1.0.9...v1.1.0) (2023-08-31)


### Features

* rename public type `Iterified` to `IterifiedIterable`, keep old one as deprecated for backwards-compat ([#27](https://github.com/shtaif/iterified/issues/27)) ([eaf6549](https://github.com/shtaif/iterified/commit/eaf654988f3e0d832147a6960451c97e16efacd9))

## [1.0.9](https://github.com/shtaif/iterified/compare/v1.0.8...v1.0.9) (2023-08-29)


### Bug Fixes

* upgrading deps to fix nanoid dep vulnerability reported on https://github.com/shtaif/iterified/security/dependabot/1 ([#24](https://github.com/shtaif/iterified/issues/24)) ([22de6e6](https://github.com/shtaif/iterified/commit/22de6e6e25f2c305299ebd3c64355d1381fef6d9))

## [1.0.8](https://github.com/shtaif/iterified/compare/v1.0.7...v1.0.8) (2023-08-27)


### Bug Fixes

* remove type declarations and arguments of iterator done values which slipped out before they were intended to ([#22](https://github.com/shtaif/iterified/issues/22)) ([68fdc8c](https://github.com/shtaif/iterified/commit/68fdc8c2cb72c3b87e14986b277194092c863b8e))

## [1.0.7](https://github.com/shtaif/iterified/compare/v1.0.6...v1.0.7) (2023-08-27)

## [1.0.6](https://github.com/shtaif/iterified/compare/v1.0.5...v1.0.6) (2023-08-27)

## [1.0.5](https://github.com/shtaif/iterified/compare/v1.0.4...v1.0.5) (2023-08-19)

## [1.0.4](https://github.com/shtaif/iterified/compare/v1.0.3...v1.0.4) (2023-08-19)


### Bug Fixes

* the TypeScript build's `module` config option ([#11](https://github.com/shtaif/iterified/issues/11)) ([8ff0831](https://github.com/shtaif/iterified/commit/8ff0831616946d220b681990ba6c51ae42dbb7e2))

## [1.0.3](https://github.com/shtaif/iterified/compare/v1.0.2...v1.0.3) (2023-08-18)


### Bug Fixes

* fix release process attempt 3 ([#10](https://github.com/shtaif/iterified/issues/10)) ([6c57aca](https://github.com/shtaif/iterified/commit/6c57acabd63e5f0f06c7526e2d3dba1e90115bdc))

## [1.0.2](https://github.com/shtaif/iterified/compare/v1.0.1...v1.0.2) (2023-08-18)


### Bug Fixes

* package build script failing ([#9](https://github.com/shtaif/iterified/issues/9)) ([bf8ffee](https://github.com/shtaif/iterified/commit/bf8ffeebd4dcdc5ce1ed170c85283ca7a7d7ba66))

## [1.0.1](https://github.com/shtaif/iterified/compare/v1.0.0...v1.0.1) (2023-08-18)


### Bug Fixes

* missing build during release process ([#8](https://github.com/shtaif/iterified/issues/8)) ([330869a](https://github.com/shtaif/iterified/commit/330869a21a1e42dd586b96783606153dfacd844c))

# 1.0.0 (2023-08-18)


### Features

* initial release ([#7](https://github.com/shtaif/iterified/issues/7)) ([66485eb](https://github.com/shtaif/iterified/commit/66485eb05e24c5f8262da1342febdcba635c8664))
