import {URL} from "url";
import {
    DataProcessingError,
    Dsn,
    Format,
    Input,
    isInputBuffer,
    isInputDataArray,
    isInputDataRows,
    isInputObjectStream,
    isInputRawStream,
    isInputRowsStream,
    isInputString
} from "./interface";
import {PassThrough, pipeline, Readable, Transform} from "stream";
import ReadlineTransform from "readline-transform";


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

export const jsonSerializer = () => new Transform({
    writableObjectMode: true,
    readableObjectMode: true,

    transform(data, encoding, callback) {
        try {
            const row = JSON.stringify(data);
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

export const normalizeInput = <T, K extends Array<keyof T>>(i: Input<T, K> | undefined): NormalizedInput => {
    if (i === undefined) {
        return emptyInput;
    } else if (isInputObjectStream(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(i, jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONEachRow"
        };
    } else if (isInputRawStream(i)) {
        return { data: i };
    } else if (isInputString(i) || isInputBuffer(i)) {
        return { data: Readable.from(i, { objectMode: false }) };
    } else if (isInputDataRows(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(Readable.from(i.rows), jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONCompactEachRow"
        };
    } else if (isInputRowsStream(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(i.rows, jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONCompactEachRow"
        };
    } else if (isInputDataArray(i)) {
        const data = new PassThrough({ objectMode: true });
        pipeline(Readable.from(i), jsonSerializer(), data, _ => {});
        return {
            data,
            format: "JSONEachRow"
        }
    }
    throw new DataProcessingError("Unknown input format");
}
