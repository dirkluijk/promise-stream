# PromiseStream 🌊

> A stream-like promise that emits multiple values over time

[![NPM version](http://img.shields.io/npm/v/@dirkluijk/promise-stream.svg?style=flat-square)](https://www.npmjs.com/package/ngx-breadcrumpy)
[![NPM downloads](http://img.shields.io/npm/dm/@dirkluijk/promise-stream.svg?style=flat-square)](https://www.npmjs.com/package/ngx-breadcrumpy)
[![Build status](https://github.com/dirkluijk/promise-stream/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/dirkluijk/ngx-breadcrumpy/actions/workflows/main.yml)

## Overview

### What? 🤔

A simple building block that behaves like a regular `Promise<T>`, but can emit multiple values over time. 

* Compatible with async/await (awaits completion)
* Provides built-in async iterator
* Contains configurable buffer size

### Limitations & when to use? 🤷‍♂️

Like regular promises, a `PromiseStream<T>` is not cancellable, is hot, shared, and will replay the last value.
Furthermore, no built-in operator support (like map or flatMap) is currently provided.

The limitations are intended. For extensive reactive apps I would recommend to use RxJS instead.

### Roadmap ideas 💡

* Provide built-in RxJS compatibility utils
* Support different backpressure mechanisms

## How to use 🌩

### Install

```
npm install @dirkluijk/promise-stream
```

### Creating a `PromiseStream`

This works the same as a regular `Promise`, but you have three callbacks: `next`, `complete` and `error`.

```typescript
import { PromiseStream } from '@dirkluijk/promise-stream';

const myStream = new PromiseStream<string>((next, complete, error) => {
    next('foo');
    next('bar');
    next('baz');
    complete();
})
```
* `next` always expects a value
* `complete` never expects a value
* `error` accepts an optional error value
* once completed or failed, no values are accepted anymore

### Consuming a `PromiseStream`

You can use callbacks:
```typescript
myStream
    .iterate(value => {
        // executed when value is emitted
    })
    .then(() => {
        // executed when completed
    })
    .catch((error) => {
        // executed when failed
    })
```

Since a `PromiseStream` invokes the `.then()` callback upon completion, it is compatible with async/await:

```typescript
try {
    await myStream.iterate(value => {
        // executed when value is emitted
    });
} catch (error) {
    // executed when failed
}

// executed when completed
```

Additionally, you can also use the async iterator:
```typescript
try {
    for await (const value of myStream.asyncIterator()) {
        // executed when value is emitted
    };
} catch (error) {
    // executed when failed
}

// executed when completed
```