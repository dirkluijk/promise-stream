type PromiseStreamState =
    PromiseStreamPending |
    PromiseStreamFailed |
    PromiseStreamCompleted;

type PromiseStreamPending = { type: 'active' };
type PromiseStreamFailed = { type: 'failed', error: any };
type PromiseStreamCompleted = { type: 'completed' };

type NextCallback<T, TResult = unknown> = (value: T) => TResult | PromiseLike<TResult>;
type ErrorCallback<T, TResult = unknown> = (reason?: unknown) => TResult | PromiseLike<TResult>;
type CompleteCallback = () => void;

export class PromiseStream<T> implements PromiseLike<void> {
    private state: PromiseStreamState = { type: 'active' };
    private buffer: T[] = [];

    private readonly nextCallbacks: NextCallback<T>[] = [];
    private readonly errorCallbacks: ErrorCallback<T>[] = [];
    private readonly completeCallbacks: CompleteCallback[] = [];

    constructor(
        executor: (next: (value: T | PromiseLike<T>) => void, complete: () => void, error: (reason?: unknown) => void) => void,
        private readonly options: { bufferSize: number } = { bufferSize: 1 }
    ) {
        executor(
            (value) => this.triggerNext(value),
            () => this.triggerComplete(),
            (error) => this.triggerError(error),
        )
    }

    private triggerNext(valueOrPromise: T | PromiseLike<T>): void {
        normalize(valueOrPromise).then((value) => {
            if (this.state.type !== 'active') return;

            this.buffer = [...this.buffer, value].slice(-1 * this.options.bufferSize);
            this.nextCallbacks.forEach((cb) => cb(value));
        });
    }

    private triggerComplete(): void {
        if (this.state.type !== 'active') return;

        Promise.resolve().then(() => {
            this.state = { type: 'completed' };
            this.completeCallbacks.forEach((cb) => cb());
        })
    }

    private triggerError(reason?: unknown): void {
        if (this.state.type !== 'active') return;

        Promise.resolve().then(() => {
            this.state = { type: 'failed', error: reason };
            this.errorCallbacks.forEach((cb) => cb(reason));
        })
    }

    public then<TResult1 = void, TResult2 = never>(
        onCompleted?: (() => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onFailed?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2> {
        // replay functionality
        if (this.state.type === 'completed') {
            return new Promise<TResult1 | TResult2>((resolve) => {
                resolve(onCompleted ? onCompleted() : undefined as TResult1)
            })
        } else if (this.state.type === 'failed' && onFailed) {
            const error = this.state.error;
            return new Promise<TResult1 | TResult2>((resolve) => {
                resolve(onFailed(error))
            })
        } else if (this.state.type === 'failed' && !onFailed) {
            const error = this.state.error;
            return Promise.reject(error)
        }

        return new Promise<TResult1 | TResult2>((resolve) => {
            this.completeCallbacks.push(() => {
                resolve(onCompleted ? onCompleted() : undefined as TResult1);
            })
            this.errorCallbacks.push((error) => {
                resolve(onFailed ? onFailed(error) : undefined as TResult1);
            })
        })
    }

    public catch<TResult = never>(onFailed?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<void | TResult> {
        // replay functionality
        if (this.state.type === 'completed') {
            return Promise.resolve<void>(void undefined)
        } else if (this.state.type === 'failed') {
            const error = this.state.error;
            return new Promise<TResult | void>((resolve) => {
                normalize(onFailed ? onFailed(error) : void undefined).then(resolve)
            })
        }

        return new Promise<TResult | void>((resolve) => {
            this.errorCallbacks.push((error) => {
                resolve(onFailed ? onFailed(error) : void undefined);
            })
        })
    }

    public completed(): Promise<void> {
        if (this.state.type === 'completed') {
            return Promise.resolve();
        } else if (this.state.type === 'failed') {
            return Promise.reject(this.state.error);
        }

        return new Promise<void>((resolve, reject) => {
            this.completeCallbacks.push(() => resolve())
            this.errorCallbacks.push((error) => reject(error))
        })
    }

    private next(): Promise<T> {
        return new Promise<T>((resolve) => {
            this.nextCallbacks.push((value) => resolve(value))
        })
    }

    public iterate(
        onNext: ((value: T) => void),
    ): Promise<void> {
        // replay functionality
        this.buffer.forEach(value => onNext(value));

        this.nextCallbacks.push((value) => onNext(value));

        return this.completed()
    }

    public async* asyncIterator(): AsyncIterableIterator<T> {
        for (const value of this.buffer) {
            yield value;
        }

        while (this.state.type === 'active') {
            const value = await Promise.race([this.next(), this.completed()])

            if (!value) {
                break
            }

            yield value
        }

        if (this.state.type === 'failed') {
            throw this.state.error;
        }
    }
}

function normalize<T>(value: T | PromiseLike<T>): PromiseLike<T> {
    if (!isPromiseLike(value)) {
        return Promise.resolve(value)
    }

    return value;
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
    return !!value && typeof value === 'object' && 'then' in value && typeof value.then === 'function';
}
