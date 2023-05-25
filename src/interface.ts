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

export interface QueryContextInterface<T> {
    exec(): Promise<void>;
    getResult(): Promise<T[]>;
    stream(): TypedReadable<T>;
    streamRaw(): Readable;
    streamRows<K extends Keys<T>>(): TypedReadable<Row<T, K>>;
}

type RawInput = Readable | Buffer | string;

type RowsStreamInput<T, K extends Keys<T>> = { rows: TypedReadable<Row<T, K>> };
type StreamInput<T, K extends Keys<T>> = TypedReadable<T> | RowsStreamInput<T, K>;

type DataRowsInput<T, K extends Keys<T>> = { rows: Array<Row<T, K>> };
type DataInput<T, K extends Keys<T>> = T[] | DataRowsInput<T, K>;

export type Input<T, K extends Keys<T> = Keys<T>> = StreamInput<T, K> | DataInput<T, K> | RawInput;


export const isReadable = (i: any): i is Readable => (i as Readable).readableObjectMode !== undefined;
export const isInputBuffer = <T, K extends Keys<T>>(i: Input<T, K>): i is Buffer => i instanceof Buffer;
export const isInputString = <T, K extends Keys<T>>(i: Input<T, K>): i is string => typeof i === "string";
export const isInputRawStream = <T, K extends Keys<T>>(i: Input<T, K>): i is Readable => isReadable(i) && !i.readableObjectMode;

export const isInputObjectStream = <T, K extends Keys<T>>(i: Input<T, K>): i is TypedReadable<T> => isReadable(i) && i.readableObjectMode;
export const isInputRowsStream = <T, K extends Keys<T>>(i: Input<T, K>): i is RowsStreamInput<T, K> => (i as RowsStreamInput<T, K>).rows !== undefined && isReadable((i as RowsStreamInput<T, K>).rows);

export const isInputDataArray = <T, K extends Keys<T>>(i: Input<T, K>): i is T[] => Array.isArray(i);
export const isInputDataRows = <T, K extends Keys<T>>(i: Input<T, K>): i is DataRowsInput<T, K> => Array.isArray((i as DataRowsInput<T, K>).rows);

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

export interface ConnectionInterface {

    // query without input
    query<T>(sql: string): QueryContextInterface<T>;

    // input as raw
    query<T>(sql: string, data: RawInput): QueryContextInterface<T>;

    // input as objects
    query<T>(sql: string, data: T[]): QueryContextInterface<T>;
    query<T>(sql: string, data: TypedReadable<T>): QueryContextInterface<T>;

    // input as rows
    query<T, K extends Keys<T> = Keys<T>>(sql: string, data: RowsStreamInput<T, K>): QueryContextInterface<T>;
    query<T, K extends Keys<T> = Keys<T>>(sql: string, data: DataRowsInput<T, K>): QueryContextInterface<T>;

}

export class ClickhouseError extends Error {}

export class ConnectionError extends ClickhouseError {}

export class DataProcessingError extends ClickhouseError {}

export class QueryingError extends ClickhouseError {}
