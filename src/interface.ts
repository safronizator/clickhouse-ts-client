import "stream";
import {Readable as TypedReadable} from "stronger-typed-streams";
import {Readable} from "stream";
import ReadableStream = NodeJS.ReadableStream;


export type Format =  "TabSeparated" | "TabSeparatedRaw" | "TabSeparatedWithNames" | "TabSeparatedWithNamesAndTypes" | "Template" | "TemplateIgnoreSpaces" | "CSV" | "CSVWithNames" | "CustomSeparated" | "Values" | "Vertical" | "VerticalRaw" | "JSON" | "JSONAsString" | "JSONString" | "JSONCompact" | "JSONCompactString" | "JSONEachRow" | "JSONEachRowWithProgress" | "JSONStringsEachRow" | "JSONStringsEachRowWithProgress" | "JSONCompactEachRow" | "JSONCompactEachRowWithNamesAndTypes" | "JSONCompactStringEachRow" | "JSONCompactStringEachRowWithNamesAndTypes" | "TSKV" | "Pretty" | "PrettyCompact" | "PrettyCompactMonoBlock" | "PrettyNoEscapes" | "PrettySpace" | "Protobuf" | "ProtobufSingle" | "Avro" | "AvroConfluent" | "Parquet" | "Arrow" | "ArrowStream" | "ORC" | "RowBinary" | "RowBinaryWithNamesAndTypes" | "Native" | "Null" | "XML" | "CapnProto" | "LineAsString" | "Regexp" | "RawBLOB";

export interface ReadableTypedStream<Out> extends TypedReadable<Out> {
    read(): Out;
    [Symbol.asyncIterator](): AsyncIterableIterator<Out>;
}

type Lookup<T, K> = K extends keyof T ? T[K] : never;

export type Row<T, K extends Array<keyof T>> = { [I in keyof K]: Lookup<T, K[I]> };

export interface QueryContextInterface<T> {
    exec(): Promise<void>;
    getResult(): Promise<T[]>;
    stream(): ReadableTypedStream<T>;
    streamRaw(): ReadableStream;
    streamRows<K extends Array<keyof T> = [keyof T]>(): ReadableTypedStream<Row<T, K>>;
}

export type Input<T> = T[] | ReadableTypedStream<T> | Readable | Buffer | string;

export const isInputString = (i: Input<unknown>): i is string => typeof i === "string";
export const isInputBuffer = (i: Input<unknown>): i is Buffer => i instanceof Buffer;
export const isInputArray = <T>(i: Input<T>): i is T[] => Array.isArray(i);
export const isInputObjectStream = <T>(i: Input<T>): i is ReadableTypedStream<T> => (i as ReadableTypedStream<T>).readableObjectMode;

export interface ConnectionInterface {

    query<T>(sql: string, data?: Input<T>): QueryContextInterface<T>;

}


