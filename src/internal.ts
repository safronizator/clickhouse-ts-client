import ReadlineTransform from "readline-transform";
import {PassThrough, pipeline, Readable, Transform} from "stream";
import {URL} from "url";
import {
    DataProcessingError,
    Dsn,
    Format,
    Input,
    RowsDataArrayInput,
    RowsStreamInput1,
    TypedReadable
} from "./interface.js";


export const cloneUrl = (u: URL) => new URL(u.href);

export const dsnToUrl = (dsn: Dsn) => {
    if (dsn instanceof URL) {
        return cloneUrl(dsn);
    } else if (typeof dsn === "string") {
        return new URL(dsn);
    }
    return new URL(`${dsn.proto || "http"}://${dsn.user || dsn.pwd ? `${dsn.user || "default"}:${dsn.pwd}@` : ""}${dsn.host}:${dsn.port || "8123"}/${dsn.db ? `?database=${dsn.db}` : ""}`);
};

const formatRegexp = /FORMAT\s+\b(TabSeparated|TabSeparatedRaw|TabSeparatedWithNames|TabSeparatedWithNamesAndTypes|Template|TemplateIgnoreSpaces|CSV|CSVWithNames|CustomSeparated|Values|Vertical|VerticalRaw|JSON|JSONAsString|JSONString|JSONCompact|JSONCompactString|JSONEachRow|JSONEachRowWithProgress|JSONStringsEachRow|JSONStringsEachRowWithProgress|JSONCompactEachRow|JSONCompactEachRowWithNamesAndTypes|JSONCompactStringEachRow|JSONCompactStringEachRowWithNamesAndTypes|TSKV|Pretty|PrettyCompact|PrettyCompactMonoBlock|PrettyNoEscapes|PrettySpace|Protobuf|ProtobufSingle|Avro|AvroConfluent|Parquet|Arrow|ArrowStream|ORC|RowBinary|RowBinaryWithNamesAndTypes|Native|Null|XML|CapnProto|LineAsString|Regexp|RawBLOB)\b/i;

export const forceFormat = (query: string, format: Format) => {
    if (!query.match(formatRegexp)) {
        return `${query} FORMAT ${format}`;
    }
    return query.replace(formatRegexp, `FORMAT ${format}`);
};

export const readAll = async (readable: Readable) => {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
};

export const readline = () => new ReadlineTransform({ skipEmpty: true });

export const jsonParser = () => new Transform({
    writableObjectMode: true,
    readableObjectMode: true,

    transform(line, encoding, callback) {
        try {
            const data = JSON.parse(line);
            this.push(data);
            callback();
        } catch (err) {
            callback(new DataProcessingError(err.message));
        }
    }
});

function dateReplacer(this: { [key: string]: any; }, k: string, v: any) {
    if (this[k] instanceof Date) {
        return Math.floor(this[k].getTime() / 1000);
    }
    return v;
}

export const jsonSerializer = () => new Transform({
    writableObjectMode: true,
    readableObjectMode: true,

    transform(data, encoding, callback) {
        try {
            const row = JSON.stringify(data, dateReplacer);
            this.push(row);
            callback();
        } catch (err) {
            callback(new DataProcessingError(err.message));
        }
    }
});

export interface NormalizedInput {
    data?: Readable;
    format?: Format;
}

export const emptyInput: NormalizedInput = {};

export const isReadable = (i: any): i is Readable => (i as Readable).readableObjectMode !== undefined;
export const isBuffer = (i: Input<any>): i is Buffer => i instanceof Buffer;
export const isString = (i: Input<any>): i is string => typeof i === "string";
export const isStream = <T>(i: Input<T>): i is TypedReadable<T> => isReadable(i) && i.readableObjectMode;
export const isRawStream = (i: Input<any>): i is Readable => isReadable(i) && !i.readableObjectMode;
export const isRowsStream = <T>(i: Input<T>): i is RowsStreamInput1<T> => (i as RowsStreamInput1<T>).rows !== undefined && isStream((i as RowsStreamInput1<T>).rows);
export const isDataArray = <T>(i: Input<T>): i is Array<T> => Array.isArray(i);
export const isRowsDataArray = <T>(i: Input<T>): i is RowsDataArrayInput<T> => isDataArray((i as RowsDataArrayInput<T>).rows);

export const normalizeInput = <T>(i: Input<T> | void): NormalizedInput => {
    if (i === undefined) {
        return emptyInput;
    } else if (isStream(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(i, jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONEachRow"
        };
    } else if (isRawStream(i)) {
        return { data: i };
    } else if (isString(i) || isBuffer(i)) {
        return { data: Readable.from(i, { objectMode: false }) };
    } else if (isRowsDataArray(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(Readable.from(i.rows), jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONCompactEachRow"
        };
    } else if (isRowsStream(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(i.rows, jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONCompactEachRow"
        };
    } else if (isDataArray(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(Readable.from(i), jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONEachRow"
        }
    }
    throw new DataProcessingError("Unknown input format");
}
