import {IncomingMessage, request} from "http";
import {PassThrough, Readable} from "stream";
import {pipeline} from "stream/promises";
import {URL} from "url";
import {
    ClickhouseError,
    ConnectionError,
    DataProcessingError,
    Dsn,
    Input,
    QueryFactoryFunc,
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


export const connect = (dsn?: Dsn): QueryFactoryFunc => {

    const url = dsnToUrl(dsn || defaultUrl);

    const rawStream = (query: string, input: Input<unknown> | void): Readable => {
        const s = new PassThrough();
        makeRequest(url, query, input).then(res => pipeline(res, s)).catch(err => s.destroy(err));
        return s;
    };

    return <O, I>(sql: string) => {
        const execute = async (input: void | Input<I>): Promise<void> => {
            await readAll(rawStream(sql, input));
        };
        const parseResult = async <I>(input: void | Input<I>): Promise<O[]> => {
            const res = JSON.parse(await readAll(rawStream(forceFormat(sql, "JSON"), input)));
            return res.data;
        };
        const parseResultRows = async <K extends Array<unknown>>(input: void | Input<I>): Promise<K[]> => {
            const res = JSON.parse(await readAll(rawStream(forceFormat(sql, "JSONCompact"), input)));
            return res.data;
        };
        const streamResult = (input: void | Input<I>): TypedReadable<O> => {
            return rawStream(forceFormat(sql, "JSONEachRow"), input).pipe(readline()).pipe(jsonParser());
        };
        const streamResultRows = <K extends Array<unknown>>(input: void | Input<I>): TypedReadable<K> => {
            return rawStream(forceFormat(sql, "JSONCompactEachRow"), input).pipe(readline()).pipe(jsonParser());
        };
        const streamResultRaw = (input: void | Input<I>): Readable => {
            return rawStream(sql, input);
        };
        return {
            execute,
            parseResult,
            parseResultRows,
            streamResult,
            streamResultRaw,
            streamResultRows
        };
    };
};
