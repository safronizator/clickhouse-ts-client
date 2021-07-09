import {URL} from "url";
import {Dsn} from "./Connection";
import {Format} from "./interface";
import ReadableStream = NodeJS.ReadableStream;


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

export const readAll = async (readable: ReadableStream) => {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks as Uint8Array[]).toString();
};
