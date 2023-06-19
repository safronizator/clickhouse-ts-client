import "stream";
import {Readable, Writable} from "stream";
import {URL} from "url";

export type HttpProto = "http" | "https";

export type Format =  "TabSeparated" | "TabSeparatedRaw" | "TabSeparatedWithNames" | "TabSeparatedWithNamesAndTypes" | "Template" | "TemplateIgnoreSpaces" | "CSV" | "CSVWithNames" | "CustomSeparated" | "Values" | "Vertical" | "VerticalRaw" | "JSON" | "JSONAsString" | "JSONString" | "JSONCompact" | "JSONCompactString" | "JSONEachRow" | "JSONEachRowWithProgress" | "JSONStringsEachRow" | "JSONStringsEachRowWithProgress" | "JSONCompactEachRow" | "JSONCompactEachRowWithNamesAndTypes" | "JSONCompactStringEachRow" | "JSONCompactStringEachRowWithNamesAndTypes" | "TSKV" | "Pretty" | "PrettyCompact" | "PrettyCompactMonoBlock" | "PrettyNoEscapes" | "PrettySpace" | "Protobuf" | "ProtobufSingle" | "Avro" | "AvroConfluent" | "Parquet" | "Arrow" | "ArrowStream" | "ORC" | "RowBinary" | "RowBinaryWithNamesAndTypes" | "Native" | "Null" | "XML" | "CapnProto" | "LineAsString" | "Regexp" | "RawBLOB";

export interface TypedReadable<T> extends Readable {
    read(): T;
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface TypedWritable<T> extends Writable {
    write(chunk: T, cb?: (error: Error | null | undefined) => void): boolean;
    write(chunk: T, encoding: never, cb?: (error: Error | null | undefined) => void): boolean;
    end(cb?: () => void): this;
}

export interface DsnOpts {
    proto?: HttpProto;
    host: string;
    port?: number | string;
    user?: string;
    pwd?: string;
    db?: string;
}

export type DsnUrl = string | URL;

export type Dsn = DsnUrl | DsnOpts;

export enum ParseMode {
    Raw,
    Rows,
    Objects
}

export type RawInput = Readable | Buffer | string;
export type ArrayOrStreamInput<T> = T[] | TypedReadable<T>;
export type RowsStreamInput1<T> = { rows: TypedReadable<T>; };
export type RowsDataArrayInput<T> = { rows: T[]; };
export type RowsInput<T> = RowsStreamInput1<T> | RowsDataArrayInput<T>;
export type Input<T> = ArrayOrStreamInput<T> | RowsInput<T> | RawInput;

export interface InputFunc<T extends Input<Array<any> | object>> {
    (input: T): Promise<void>;
}

export interface InputFactoryFunc {
    (sql: string): InputFunc<Input<Array<any> | object>>;
    <T extends Array<any>>(sql: string): InputFunc<RowsInput<T>>;
    <T extends object>(sql: string): InputFunc<ArrayOrStreamInput<T>>;
}

export interface ParseOpts {
    mode: ParseMode;
    //TODO: transforming function
}

export interface ParseOptsRaw extends ParseOpts {
    mode: ParseMode.Raw;
}

export interface ParseOptsRows extends ParseOpts {
    mode: ParseMode.Rows;
}

export interface ParseOptsObjects extends ParseOpts {
    mode: ParseMode.Objects;
}

export interface QueryContextInterface {
    exec(): Promise<void>;
    reader(opts?: ParseOptsRaw): () => Readable;
    reader<T extends Array<any>>(opts: ParseOptsRows): () => TypedReadable<T>;
    reader<T extends object>(opts: ParseOptsObjects): () => TypedReadable<T>;
    loader(opts?: ParseOptsRaw): () => Promise<string>;
    loader<T extends Array<any>>(opts: ParseOptsRows): () => Promise<T[]>;
    loader<T extends object>(opts: ParseOptsObjects): () => Promise<T[]>;
}

export interface ConnectorInterface {
    query: (sql: string) => QueryContextInterface;
    input: InputFactoryFunc;
}

export class ClickhouseError extends Error {}

export class ConnectionError extends ClickhouseError {}

export class DataProcessingError extends ClickhouseError {}

export class QueryingError extends ClickhouseError {}
