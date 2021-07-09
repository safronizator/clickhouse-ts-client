import {ConnectionInterface, Input, QueryContextInterface} from "./interface";
import {URL} from "url";
import {dsnToUrl} from "./utils";
import QueryContext from "./QueryContext";


export interface DsnOpts {
    proto?: "http" | "https";
    host: string;
    port?: number | string;
    user?: string;
    pwd?: string;
    db?: string;
}

export type DsnUrl = string | URL;

export type Dsn = DsnUrl | DsnOpts;

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

    query<T>(sql: string, data?: Input<T>): QueryContextInterface<T> {
        return new QueryContext<T>(this.url, sql, data);
    }

}
