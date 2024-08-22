import { describe, expect, it, vi, vitest } from 'vitest';
import { PromiseStream } from './promise-stream.js';

describe('PromiseStream', () => {
    it('should be able to complete', async () => {
        const stream = new PromiseStream<string>((next, complete) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => complete(), 400);
        })

        const callbackFn = vi.fn();

        stream.then(() => callbackFn('foo1'));

        stream
            .then(() => 'foo2')
            .then((x) => callbackFn(x));

        expect(callbackFn).not.toHaveBeenCalled();

        await stream
            .then(() => 'foo3')
            .then((x) => `${x}_foo4`)
            .then((x) => callbackFn(x));

        await stream
            .then(() => Promise.resolve('foo5'))
            .then((x) => `${x}_foo6`)
            .then((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(4);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo1');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'foo2');
        expect(callbackFn).toHaveBeenNthCalledWith(3, 'foo3_foo4');
        expect(callbackFn).toHaveBeenNthCalledWith(4, 'foo5_foo6');
    });

    it('should be able to fail', async () => {
        const stream = new PromiseStream<string>((next, _, error) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => error(), 400);
        })

        const callbackFn = vi.fn();

        stream.catch(() => callbackFn('foo1'));
        stream.then(() => {
        }, () => callbackFn('foo1'));

        stream
            .catch(() => 'foo2')
            .then((x) => callbackFn(x));

        expect(callbackFn).not.toHaveBeenCalled();

        await stream
            .catch(() => 'foo3')
            .then((x) => `${x}_foo4`)
            .then((x) => callbackFn(x));

        await stream
            .catch(() => Promise.resolve('foo5'))
            .then((x) => `${x}_foo6`)
            .then((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(5);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo1');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'foo1');
        expect(callbackFn).toHaveBeenNthCalledWith(3, 'foo2');
        expect(callbackFn).toHaveBeenNthCalledWith(4, 'foo3_foo4');
        expect(callbackFn).toHaveBeenNthCalledWith(5, 'foo5_foo6');

        // replay
        await stream
            .then(() => 'a')
            .catch(() => callbackFn())
            .then(() => 'b')

        expect(callbackFn).toHaveBeenCalledTimes(6);
    });

    it('should be able to iterate', async () => {
        const stream = new PromiseStream<string>((next, complete) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => complete(), 400);
        })

        const callbackFn = vi.fn();

        await stream.iterate((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(3);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(3, 'baz');

        callbackFn.mockReset();

        // replay last
        await stream.iterate((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(1);
        expect(callbackFn).toHaveBeenCalledWith('baz');
    });

    it('should maintain buffer', async () => {
        const stream = new PromiseStream<string>((next, complete) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => complete(), 400);
        }, { bufferSize: 2 })

        const callbackFn = vi.fn();

        await stream.iterate((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(3);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(3, 'baz');

        callbackFn.mockReset();

        // replay last
        await stream.iterate((x) => callbackFn(x));

        expect(callbackFn).toHaveBeenCalledTimes(2);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'baz');
    });

    it('should support asynchronous iterators', async () => {
        const stream = new PromiseStream<string>((next, complete) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => complete(), 400);
        })

        const callbackFn = vi.fn();

        for await (const x of stream.asyncIterator()) {
            callbackFn(x)
        }

        expect(callbackFn).toHaveBeenCalledTimes(3);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(3, 'baz');
    });

    it('should support asynchronous iterators without values', async () => {
        const stream = new PromiseStream<string>((_, complete) => {
            setTimeout(() => complete(), 100);
        })

        const callbackFn = vi.fn();

        for await (const x of stream.asyncIterator()) {
            callbackFn(x)
        }

        expect(callbackFn).not.toHaveBeenCalled();
    });

    it('should support asynchronous iterators with an error', async () => {
        const stream = new PromiseStream<string>((next, _, error) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => error(new Error('x')), 250);
        })

        const callbackFn = vi.fn();

        try {
            for await (const x of stream.asyncIterator()) {
                callbackFn(x)
            }
        } catch (e) {
            callbackFn(e)
        }

        expect(callbackFn).toHaveBeenCalledTimes(3);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'foo');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(3, new Error('x'));
    });

    it('should support asynchronous iterators with buffered values', async () => {
        const stream = new PromiseStream<string>((next, complete) => {
            setTimeout(() => next('foo'), 100);
            setTimeout(() => next('bar'), 200);
            setTimeout(() => next('baz'), 300);
            setTimeout(() => complete(), 400);
        }, { bufferSize: 2 })

        const callbackFn = vi.fn();

        await stream.completed()

        for await (const x of stream.asyncIterator()) {
            callbackFn(x)
        }

        expect(callbackFn).toHaveBeenCalledTimes(2);
        expect(callbackFn).toHaveBeenNthCalledWith(1, 'bar');
        expect(callbackFn).toHaveBeenNthCalledWith(2, 'baz');
    });
});