import "stream";
import {Readable, Writable} from "stream";
import {URL} from "url";


export type Format =  "TabSeparated" | "TabSeparatedRaw" | "TabSeparatedWithNames" | "TabSeparatedWithNamesAndTypes" | "Template" | "TemplateIgnoreSpaces" | "CSV" | "CSVWithNames" | "CustomSeparated" | "Values" | "Vertical" | "VerticalRaw" | "JSON" | "JSONAsString" | "JSONString" | "JSONCompact" | "JSONCompactString" | "JSONEachRow" | "JSONEachRowWithProgress" | "JSONStringsEachRow" | "JSONStringsEachRowWithProgress" | "JSONCompactEachRow" | "JSONCompactEachRowWithNamesAndTypes" | "JSONCompactStringEachRow" | "JSONCompactStringEachRowWithNamesAndTypes" | "TSKV" | "Pretty" | "PrettyCompact" | "PrettyCompactMonoBlock" | "PrettyNoEscapes" | "PrettySpace" | "Protobuf" | "ProtobufSingle" | "Avro" | "AvroConfluent" | "Parquet" | "Arrow" | "ArrowStream" | "ORC" | "RowBinary" | "RowBinaryWithNamesAndTypes" | "Native" | "Null" | "XML" | "CapnProto" | "LineAsString" | "Regexp" | "RawBLOB";

export interface TypedReadable<T> extends Readable {
    read(): T;
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface TypedWritable<T> extends Writable {
    write(chunk: T, cb?: (error: Error | null | undefined) => void): boolean;
    write(chunk: T, encoding: never, cb?: (error: Error | null | undefined) => void): boolean;
    end(cb?: () => void): void;
}

export type Keys<T> = Array<keyof T>;

type Lookup<T, K> = K extends keyof T ? T[K] : never;

export type Row<T, K extends Keys<T> = Keys<T>> = { [I in keyof K]: Lookup<T, K[I]> };

export interface DsnOpts {
    proto?: "http" | "https";
    host: string;
    port?: number | string;
    user?: string;
    pwd?: string;
    db?: string;
}

export type DsnUrl = string | URL;

export type Dsn = DsnUrl | DsnOpts;

export type RawInput = Readable | Buffer | string;
export type ArrayOrStreamInput<T> = T[] | TypedReadable<T>;
export type RowsStreamInput1<T> = { rows: TypedReadable<T>; };
export type RowsDataArrayInput<T> = { rows: T[]; };
export type RowsInput<T> = RowsStreamInput1<T> | RowsDataArrayInput<T>;
export type Input<T> = ArrayOrStreamInput<T> | RowsInput<T> | RawInput;

export interface QueryContextInterface<O, I> {
    execute: (input: I) => Promise<void>;
    parseResult: (input: I) => Promise<O[]>;
    parseResultRows: <K extends Array<unknown>>(input: I) => Promise<K[]>;
    streamResult: (input: I) => TypedReadable<O>;
    streamResultRaw: (input: I) => Readable;
    streamResultRows: <K extends Array<unknown>>(input: I) => TypedReadable<K>;
}

export interface QueryFactoryFunc {
    <O>(sql: string): QueryContextInterface<O, void | Input<any>>;
    <O, I extends never>(sql: string): QueryContextInterface<O, void>;
    <O, I extends RawInput>(sql: string): QueryContextInterface<O, RawInput>;
    <O, I extends Array<any>>(sql: string): QueryContextInterface<O, RowsInput<I>>;
    <O, I extends object>(sql: string): QueryContextInterface<O, ArrayOrStreamInput<I>>;
}

export class ClickhouseError extends Error {}

export class ConnectionError extends ClickhouseError {}

export class DataProcessingError extends ClickhouseError {}

export class QueryingError extends ClickhouseError {}
