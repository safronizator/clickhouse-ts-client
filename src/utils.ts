import {Duplex, PassThrough} from "stream";
import {Row, TypedReadable, TypedWritable} from "./interface";


export const createStreamInput = <T>(): TypedReadable<T> & TypedWritable<T> => new PassThrough({
    objectMode: true
});

export const createRowsStreamInput = <T, K extends Array<keyof T> = [keyof T]>(): TypedReadable<Row<T, K>> & TypedWritable<Row<T, K>> => new PassThrough({
    objectMode: true
});

export const createRawStreamInput = (): Duplex => new PassThrough();
