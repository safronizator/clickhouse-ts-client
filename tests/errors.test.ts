import {strict as assert} from "assert";
import {Readable, Writable} from "stream";
import {pipeline} from "stream/promises";
import connect, {ConnectionError, createStreamInput, DataProcessingError, QueryingError} from "../src/index.js";
import {Test} from "./model.js";
import {createTestTabQuery, dropTestTabQuery, testData} from "./queries.js";


describe("Testing errors", () => {

    const { query, input } = connect();
    const dropTable = query(dropTestTabQuery).exec;
    const createTable = query(createTestTabQuery).exec;

    before(async () => {
        await dropTable();
        await createTable();
    });

    after(dropTable);

    async function *genError() {
        for (const item of testData) {
            yield item;
        }
        throw new Error("Test error");
    }

    it("should check connection error", async () => {
        const queryError = connect({ host: "localhost", port: 12345 }).query("select 1").loader();
        await assert.rejects(queryError, ConnectionError);
    });

    it("should check query syntax error", async () => {
        const queryError = query("select from test").loader();
        await assert.rejects(queryError, QueryingError);
    });

    it("should check input query syntax error", async () => {
        const inputError = input<Test>("insert into test (");
        await assert.rejects(
            () => inputError([{ dt: "2023-01-01 00:00:00", mark: "a", text: "text1", num: 1 }]),
            QueryingError
        );
    });

    it("should check input query format error", async () => {
        const inputError = input("insert into test format TabSeparated");
        await assert.rejects(
            () => inputError("2023-01-01 00:00:00;a;text1;1\n"),
            QueryingError
        );
    });

    it("should check input query streaming error", async () => {
        const sendData = input<Test>("insert into test");
        const data = createStreamInput<Test>();
        pipeline(Readable.from(genError()), data as Writable).catch(() => {});
        await assert.rejects(
            () => sendData(data),
            DataProcessingError
        );
    });

});
