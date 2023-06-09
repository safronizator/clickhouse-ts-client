import {Duplex, PassThrough} from "stream";
import {pipeline as pipeline_internal} from "stream/promises";
import {TypedReadable, TypedWritable} from "./interface.js";
import ReadableStream = NodeJS.ReadableStream;
import WritableStream = NodeJS.WritableStream;

export const createStreamInput = <T>(): TypedReadable<T> & TypedWritable<T> => new PassThrough({
    objectMode: true
});

export const createRawStreamInput = (): Duplex => new PassThrough();

export const pipeline = <I, O extends I>(src: TypedReadable<I>, dst: TypedWritable<O>): Promise<void> =>
    pipeline_internal(src as unknown as ReadableStream, dst as unknown as WritableStream);

export type Keys<T> = Array<keyof T>;

type Lookup<T, K> = K extends keyof T ? T[K] : never;

export type Row<T, K extends Keys<T> = Keys<T>> = { [I in keyof K]: Lookup<T, K[I]> };
