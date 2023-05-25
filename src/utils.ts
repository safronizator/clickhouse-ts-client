import {Duplex, PassThrough} from "stream";
import {pipeline as pipeline_internal} from "stream/promises";
import {Keys, Row, TypedReadable, TypedWritable} from "./interface.js";
import ReadableStream = NodeJS.ReadableStream;
import WritableStream = NodeJS.WritableStream;

export const createStreamInput = <T>(): TypedReadable<T> & TypedWritable<T> => new PassThrough({
    objectMode: true
});

export const createRowsStreamInput = <T, K extends Keys<T> = Keys<T>>(): TypedReadable<Row<T, K>> & TypedWritable<Row<T, K>> => new PassThrough({
    objectMode: true
});

export const createRawStreamInput = (): Duplex => new PassThrough();

export const pipeline = <I, O=I>(src: TypedReadable<I>, dst: TypedWritable<O>): Promise<void> =>
    pipeline_internal(src as unknown as ReadableStream, dst as unknown as WritableStream);
