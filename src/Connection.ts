import {URL} from "url";
import {ConnectionInterface, Dsn, Input, Keys, QueryContextInterface} from "./interface.js";
import {dsnToUrl} from "./internal.js";
import QueryContext from "./QueryContext.js";


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

    query<T, K extends Keys<T> = Keys<T>>(sql: string, data?: Input<T, K>): QueryContextInterface<T> {
        return new QueryContext(this.url, sql, data);
    }

}
