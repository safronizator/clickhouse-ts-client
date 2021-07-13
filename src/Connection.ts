import {ConnectionInterface, Dsn, Input, QueryContextInterface} from "./interface";
import {URL} from "url";
import QueryContext from "./QueryContext";
import {dsnToUrl} from "./internal";


export interface ConnectionOpts {
    dsn: Dsn;
    encrypt: boolean;
}

const defaultUrl = "http://localhost:8123/";


export default class Connection implements ConnectionInterface {

    private readonly url: URL;

    constructor(opts?: Partial<ConnectionOpts>) {
        this.url = dsnToUrl(opts?.dsn || defaultUrl);
    }

    query<T, K extends Array<keyof T> = Array<keyof T>>(sql: string, data?: Input<T, K>): QueryContextInterface<T> {
        return new QueryContext(this.url, sql, data);
    }

}
