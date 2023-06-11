import {Row} from "../src/index.js";


export interface Test {
    dt: string;
    mark: string;
    text: string;
    num: number;
}

export type ShortRow = Row<Test, ["dt", "num"]>;
