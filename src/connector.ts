import {IncomingMessage, request} from "http";
import {PassThrough, Readable} from "stream";
import {pipeline} from "stream/promises";
import {URL} from "url";
import {
    ClickhouseError,
    ConnectionError,
    ConnectorInterface,
    DataProcessingError,
    Dsn,
    Input,
    InputFunc,
    ParseMode,
    ParseOpts,
    ParseOptsObjects,
    ParseOptsRaw,
    ParseOptsRows,
    QueryContextInterface,
    QueryingError,
    TypedReadable
} from "./interface.js";
import {cloneUrl, dsnToUrl, forceFormat, jsonParser, normalizeInput, readAll, readline} from "./internal.js";


const defaultUrl = "http://localhost:8123/";

enum HttpStatus {
    OK = 200
}

enum HttpMethod {
    Get = "get",
    Post = "post"
}

const makeRequest = (server: URL, query: string, input: Input<unknown> | void): Promise<IncomingMessage> => {
    return new Promise((resolve, reject) => {
        const url = cloneUrl(server);
        const { data, format } = normalizeInput(input);
        url.searchParams.append("query", format ? forceFormat(query, format) : query);
        const req = request(url, { method: HttpMethod.Post }, res => {
            if (res.statusCode === HttpStatus.OK) {
                return resolve(res);
            }
            readAll(res)
                .then(msg => reject(new QueryingError(msg || `Got error response from server (status: ${res.statusCode})`)))
                .catch(err => reject(new QueryingError(`Error reading response: ${err.message}`)));
        });
        if (data) {
            pipeline(data, req).catch(err => {
                reject(err instanceof ClickhouseError ? err : new DataProcessingError(err.message));
            });
            // req stream will be closed automatically
        } else {
            req.once("error", err => reject(new ConnectionError(err.message)));
            req.end();
        }
    })
};


export const connect = (dsn?: Dsn): ConnectorInterface => {

    const url = dsnToUrl(dsn || defaultUrl);

    const rawStream = (query: string, input: Input<unknown> | void): Readable => {
        const s = new PassThrough();
        makeRequest(url, query, input).then(res => pipeline(res, s)).catch(err => s.destroy(err));
        return s;
    };

    const query = (sql: string): QueryContextInterface => {
        const exec = () =>
            //TODO: should we read response here?
            //TODO: use of skipReader instead readAll may be more efficient
            readAll(rawStream(sql)).then(() => {});
        const reader = <T>(opts: ParseOpts = { mode: ParseMode.Raw }): () => Readable | TypedReadable<T> => {
            switch (opts.mode) {
                case ParseMode.Raw:
                    return () => rawStream(sql);
                case ParseMode.Rows:
                    return () => rawStream(forceFormat(sql, "JSONCompactEachRow")).pipe(readline()).pipe(jsonParser());
                case ParseMode.Objects:
                    return () => rawStream(forceFormat(sql, "JSONEachRow")).pipe(readline()).pipe(jsonParser());
                default:
                    throw new DataProcessingError(`Unknown parse mode: ${opts.mode}`);
            }
        };
        function loader (opts?: ParseOptsRaw): () => Promise<string>;
        function loader <T extends Array<any>>(opts: ParseOptsRows): () => Promise<T[]>;
        function loader <T extends object>(opts: ParseOptsObjects): () => Promise<T[]>;
        function loader <T>(opts: ParseOpts = { mode: ParseMode.Raw }): () => Promise<string | T[]> {
            //TODO: use reader() to avoid code duplication
            switch (opts.mode) {
                case ParseMode.Raw:
                    return () => readAll(rawStream(sql));
                case ParseMode.Rows:
                    return async () =>
                        JSON.parse(await readAll(rawStream(forceFormat(sql, "JSONCompact")))).data;
                case ParseMode.Objects:
                    return async () =>
                        JSON.parse(await readAll(rawStream(forceFormat(sql, "JSON")))).data;
                default:
                    throw new DataProcessingError(`Unknown parse mode: ${opts.mode}`);
            }
        }
        return { exec, reader, loader };
    };

    const input = <T extends Input<Array<any> | object>>(sql: string): InputFunc<T> =>
        data =>
            //TODO: should we read response here?
            //TODO: use of skipReader instead readAll may be more efficient
            readAll(rawStream(sql, data)).then(() => {});

    return { query, input };
};
