import {cloneUrl, forceFormat, readAll} from "./utils";
import {
    Input,
    isInputArray,
    isInputBuffer,
    isInputObjectStream,
    isInputString,
    QueryContextInterface,
    ReadableTypedStream,
    Row
} from "./interface";
import {PassThrough, pipeline, Readable, Transform} from "stream";
import {IncomingMessage, request} from "http";
import ReadlineTransform from "readline-transform";
import {URL} from "url";
import ReadableStream = NodeJS.ReadableStream;


const readline = () => new ReadlineTransform({ skipEmpty: true });

const jsonParser = () => new Transform({
    writableObjectMode: true,
    readableObjectMode: true,

    transform(line, encoding, callback) {
        try {
            const data = JSON.parse(line);
            this.push(data);
            callback();
        } catch (err) {
            callback(err);
        }
    }
});

const jsonSerializer = () => new Transform({
    writableObjectMode: true,
    readableObjectMode: true,

    transform(data, encoding, callback) {
        try {
            const row = JSON.stringify(data);
            this.push(row);
            callback();
        } catch (err) {
            callback(err);
        }
    }
});

const toRawDataStream = <T>(data: Input<T>): ReadableStream => {
    if (isInputString(data) || isInputBuffer(data)) {
        return Readable.from(data);
    } else if (isInputArray(data)) {
        return Readable.from(data.map(item => JSON.stringify(item)).join("\n"));
    } else if (isInputObjectStream(data)) {
        return data.pipe(jsonSerializer());
    }
    return data;
}


export default class QueryContext<T> implements QueryContextInterface<T> {

    private readonly url: URL;
    private readonly query: string;
    private readonly data: Input<T> | undefined;

    constructor(dsn: URL, query: string, data?: Input<T>) {
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

    streamRaw(): NodeJS.ReadableStream {
        return this._rawStream(this.query);
    }

    stream(): ReadableTypedStream<T> {
        return this._rawStream(forceFormat(this.query, "JSONEachRow")).pipe(readline()).pipe(jsonParser());
    }

    streamRows<K extends Array<keyof T> = [keyof T] >(): ReadableTypedStream<Row<T, K>> {
        return this._rawStream(forceFormat(this.query, "JSONCompactEachRow")).pipe(readline()).pipe(jsonParser());
    }

    private _rawStream(query: string): NodeJS.ReadableStream {
        const s = new PassThrough();
        this.makeRequest(query).then(res => res.pipe(s)).catch(err => s.destroy(err));
        return s;
    }

    private makeRequest(query: string): Promise<IncomingMessage> {
        return new Promise((resolve, reject) => {
            const url = cloneUrl(this.url);
            url.searchParams.append("query", query);
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
            if (this.data !== undefined) {
                pipeline(toRawDataStream(this.data), req, err => {
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
