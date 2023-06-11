import {strict as assert} from "assert";
import {createReadStream} from "fs";
import {Readable, Writable} from "stream";
import {pipeline} from "stream/promises";
import connect, {createStreamInput, ParseMode} from "../src/index.js";
import {ShortRow, Test} from "./model.js";
import {clearTestTabQuery, createTestTabQuery, dropTestTabQuery, selectFullQuery, testData} from "./queries.js";


describe("Sending data to DB", () => {

    const { query, input } = connect();

    const dropTable = query(dropTestTabQuery).exec;
    const createTable = query(createTestTabQuery).exec;
    const clearTable = query(clearTestTabQuery).exec;
    const selectFull = query(selectFullQuery).loader<Test>({ mode: ParseMode.Objects });
    const selectShortRows = query("SELECT dt, num FROM test ORDER BY dt").loader<ShortRow>({ mode: ParseMode.Rows });

    async function *genTestData() {
        for (const item of testData) {
            yield item;
        }
    }

    before(async () => {
        await dropTable();
        await createTable();
    });

    afterEach(clearTable);

    after(dropTable);

    it("should check data sending as an array of objects", async () => {
        const sendData = input<Test>("insert into test");
        await sendData(testData);
        assert.deepStrictEqual(await selectFull(), testData, "Received data is not equal to expected");
    });

    it("should check data sending as an array of rows", async () => {
        const sendData = input<ShortRow>("insert into test (dt, num)");
        const data: ShortRow[] = [
            [ "2023-01-01 00:00:00", 1 ],
            [ "2023-01-01 00:00:01", 2 ],
            [ "2023-01-01 00:00:02", 3 ]
        ];
        await sendData({ rows: data });
        assert.deepStrictEqual(await selectShortRows(), data, "Received data is not equal to expected");
    });

    it("should check data sending as a raw string", async () => {
        const sendData = input("insert into test format TabSeparated");
        const data = "2023-01-01 00:00:00\ta\ttext1\t1\n" +
            "2023-01-01 00:00:01\tb\ttext2\t2\n" +
            "2023-01-01 00:00:02\tc\ttext3\t3\n";
        await sendData(data);
        assert.deepStrictEqual(await selectFull(), testData, "Received data is not equal to expected");
    });

    it("should check data sending as a stream of objects", async () => {
        const sendData = input<Test>("insert into test");
        const data = createStreamInput<Test>();
        pipeline(Readable.from(genTestData()), data as Writable).catch(() => {});
        await sendData(data);
        assert.deepStrictEqual(await selectFull(), testData, "Received data is not equal to expected");
    });

    it("should check data sending as a stream of rows", async () => {
        const sendData = input<ShortRow>("insert into test (dt, num)");
        const data = createStreamInput<ShortRow>();
        const rows: ShortRow[] = [
            [ "2023-01-01 00:00:00", 1 ],
            [ "2023-01-01 00:00:01", 2 ],
            [ "2023-01-01 00:00:02", 3 ]
        ];
        pipeline(Readable.from(rows), data as Writable).catch(() => {});
        await sendData({ rows: data });
        assert.deepStrictEqual(await selectShortRows(), rows, "Received data is not equal to expected");
    });

    it("should check data sending from the raw stream", async () => {
        const sendData = input("insert into test format TabSeparated");
        await sendData(createReadStream("tests/test-data.tsv"));
        assert.deepStrictEqual(await selectFull(), testData, "Received data is not equal to expected");
    });

    it("should check proper format substitution", async () => {
        const sendData = input<Test>("insert into test format TabSeparatedWithNames");
        await sendData(testData);
        assert.deepStrictEqual(await selectFull(), testData, "Received data is not equal to expected");
    });

});
