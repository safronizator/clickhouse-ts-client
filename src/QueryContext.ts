import {Input, QueryContextInterface, Row, TypedReadable} from "./interface";
import {PassThrough, pipeline, Readable} from "stream";
import {IncomingMessage, request} from "http";
import {URL} from "url";
import {cloneUrl, forceFormat, jsonParser, normalizeInput, readAll, readline} from "./internal";


export default class QueryContext<T, K extends Array<keyof T>> implements QueryContextInterface<T> {

    private readonly url: URL;
    private readonly query: string;
    private readonly data: Input<T, K> | undefined;

    constructor(dsn: URL, query: string, data?: Input<T, K>) {
        this.url = cloneUrl(dsn);
        this.query = query;
        this.data = data;
    }

    async getResult(): Promise<T[]> {
        const res = JSON.parse(await readAll(this._rawStream(forceFormat(this.query, "JSON"))));
        return res.data;
    }

    async exec(): Promise<void> {
        await readAll(this._rawStream(this.query));
    }

    streamRaw(): Readable {
        return this._rawStream(this.query);
    }

    stream(): TypedReadable<T> {
        return this._rawStream(forceFormat(this.query, "JSONEachRow")).pipe(readline()).pipe(jsonParser());
    }

    streamRows<K extends Array<keyof T> = [keyof T] >(): TypedReadable<Row<T, K>> {
        return this._rawStream(forceFormat(this.query, "JSONCompactEachRow")).pipe(readline()).pipe(jsonParser());
    }

    private _rawStream(query: string): Readable {
        const s = new PassThrough();
        this.makeRequest(query).then(res => res.pipe(s)).catch(err => s.destroy(err));
        return s;
    }

    private makeRequest(query: string): Promise<IncomingMessage> {
        return new Promise((resolve, reject) => {
            const url = cloneUrl(this.url);
            const { data, format } = normalizeInput(this.data);
            url.searchParams.append("query", format ? forceFormat(query, format) : query);
            const req = request(url, {
                //TODO: fix "magic" constant:
                method: "post"
            }, res => {
                //TODO: fix "magic" constant:
                if (res.statusCode === 200) {
                    resolve(res);
                    return;
                }
                //TODO: add custom Error type?
                //TODO: unnecessary rejecting?
                readAll(res)
                    .then(msg => reject(new Error(msg || `Got error response from server (status: ${res.statusCode})`)))
                    .catch(err => reject(new Error(`Error reading response: ${err.message}`)));
            });
            req.once("error", reject); //TODO: unnecessary rejecting?
            if (data) {
                pipeline(data, req, err => {
                    if (err) {
                        reject(err); //TODO: unnecessary rejecting?
                    }
                    req.end();
                });
            } else {
                req.end();
            }
        })
    }



}
