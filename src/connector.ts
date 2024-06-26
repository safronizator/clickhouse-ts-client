import {IncomingMessage, request as insecureRequest} from "http";
import {request as secureRequest} from "https";
import {PassThrough, Readable} from "stream";
import {pipeline} from "stream/promises";
import {URL} from "url";
import {
    ClickhouseError,
    ConnectionError,
    ConnectionOpts,
    ConnectorInterface,
    DataProcessingError,
    Dsn,
    Input,
    InputFunc,
    isDsnOpts,
    Parameters,
    ParseMode,
    ParseOpts,
    ParseOptsObjects,
    ParseOptsRaw,
    ParseOptsRows,
    QueryContextInterface,
    QueryingError,
    TypedReadable
} from "./interface.js";
import {
    cloneUrl,
    dsnToUrl,
    forceFormat,
    jsonParser,
    normalizeInput,
    readAll,
    readAllObjects,
    readline
} from "./internal.js";


const defaultUrl = "http://localhost:8123/";

enum HttpStatus {
    OK = 200
}

enum HttpMethod {
    Get = "get",
    Post = "post"
}

const getRequestFunc = (url: URL) => url.protocol === "https:" ? secureRequest : insecureRequest;

interface RequestOpts {
    url: URL;
    query: string;
    params: Parameters;
    input: Input<unknown> | void;
    timeout: number;
}

const makeRequest = (opts: RequestOpts): Promise<IncomingMessage> =>
    new Promise((resolve, reject) => {
        const { url: srcUrl, query, params, input, timeout } = opts;
        const url = cloneUrl(srcUrl);
        const { data, format } = normalizeInput(input);
        url.searchParams.append("query", format ? forceFormat(query, format) : query);
        Object.entries(params).forEach(([key, value]) => url.searchParams.append(`param_${key}`, value.toString()));
        const request = getRequestFunc(url);
        const req = request(
            url,
            {
                method: HttpMethod.Post,
                timeout
            },
            res => {
                if (res.statusCode === HttpStatus.OK) {
                    return resolve(res);
                }
                readAll(res)
                    .then(msg => reject(new QueryingError(msg || `Got error response from server (status: ${res.statusCode})`)))
                    .catch(err => reject(new QueryingError(`Error reading response: ${err.message}`)));
            }
        );
        if (data) {
            pipeline(data, req).catch(err => {
                reject(err instanceof ClickhouseError ? err : new DataProcessingError(err.message));
            });
            // req stream will be closed automatically
        } else {
            req.once("error", err => reject(new ConnectionError(err.message)));
            req.end();
        }
    });


export const connect = (opts?: Dsn | Partial<ConnectionOpts>): ConnectorInterface => {

    const nOpts: ConnectionOpts = {
        dsn: defaultUrl,
        timeout: 5000,
        ...(typeof opts === "string" || opts instanceof URL || isDsnOpts(opts) ? { dsn: opts } : (opts || {}))
    };
    const url = dsnToUrl(nOpts.dsn);
    const timeout = nOpts.timeout;

    const rawStream = (query: string, params: Parameters, input: Input<unknown> | void): Readable => {
        const s = new PassThrough();
        makeRequest({ url, query, params, input, timeout }).then(res => pipeline(res, s)).catch(err => s.destroy(err));
        return s;
    };

    const query = (sql: string): QueryContextInterface => {
        const exec = (params: Parameters = {}) =>
            //TODO: should we read response here?
            //TODO: use of skipReader instead readAll may be more efficient
            readAll(rawStream(sql, params)).then(() => {});
        const reader = <T>(opts: ParseOpts = { mode: ParseMode.Raw }): (params?: Parameters) => Readable | TypedReadable<T> => {
            switch (opts.mode) {
                case ParseMode.Raw:
                    return (params: Parameters = {}) => rawStream(sql, params || {});
                case ParseMode.Rows:
                    return (params: Parameters = {}) =>
                        rawStream(forceFormat(sql, "JSONCompactEachRow"), params)
                            .pipe(readline())
                            .pipe(jsonParser());
                case ParseMode.Objects:
                    return (params: Parameters = {}) =>
                        rawStream(forceFormat(sql, "JSONEachRow"), params)
                            .pipe(readline())
                            .pipe(jsonParser());
                default:
                    throw new DataProcessingError(`Unknown parse mode: ${opts.mode}`);
            }
        };
        function loader (opts?: ParseOptsRaw): (params?: Parameters) => Promise<string>;
        function loader <T extends Array<any>>(opts: ParseOptsRows): (params?: Parameters) => Promise<T[]>;
        function loader <T extends object>(opts: ParseOptsObjects): (params?: Parameters) => Promise<T[]>;
        function loader <T>(opts: ParseOpts = { mode: ParseMode.Raw }): (params?: Parameters) => Promise<string | T[]> {
            const read = reader<T>(opts);
            if (opts.mode === ParseMode.Raw) {
                return (params: Parameters = {}) => readAll(read(params));
            } else if (opts.mode === ParseMode.Rows || opts.mode === ParseMode.Objects) {
                return (params: Parameters = {}) => readAllObjects(read(params));
            }
            throw new DataProcessingError(`Unknown parse mode: ${opts.mode}`);
        }
        return { exec, reader, loader };
    };

    const input = <T extends Input<Array<any> | object>>(sql: string): InputFunc<T> =>
        (data, params) =>
            //TODO: should we read response here?
            //TODO: use of skipReader instead readAll may be more efficient
            readAll(rawStream(sql, params || {}, data)).then(() => {});

    return { query, input };
};
