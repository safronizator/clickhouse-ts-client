import {strict as assert} from "assert";
import connect, {ParseMode, Row} from "../src";
import {readAll} from "../src/internal.js";
import {ShortRow, Test} from "./model.js";
import {createTestTabQuery, dropTestTabQuery, fillTestTabQuery, selectFullQuery, testData} from "./queries.js";


describe("Receiving data from DB", () => {

    const { query } = connect();

    const dropTable = query(dropTestTabQuery).exec;
    const createTable = query(createTestTabQuery).exec;
    const fillTable = query(fillTestTabQuery).exec;

    const queryFull = query(selectFullQuery);
    const queryDateNum = query("SELECT dt, num FROM test ORDER BY dt");

    const fullResultRawTabSeparated =
        "2023-01-01 00:00:00\ta\ttext1\t1\n" +
        "2023-01-01 00:00:01\tb\ttext2\t2\n" +
        "2023-01-01 00:00:02\tc\ttext3\t3\n";

    before(async () => {
        await dropTable();
        await createTable();
        await fillTable();
    });

    after(dropTable);

    it("should check result parsing as an array of objects", async () => {
        const loadData = queryFull.loader<Test>({ mode: ParseMode.Objects });
        assert.deepStrictEqual(await loadData(), testData, "Received data is not equal to expected");
    });

    it("should check result parsing as an array of rows", async () => {
        const loadData = queryDateNum.loader<Row<Test, ["dt", "num"]>>({ mode: ParseMode.Rows });
        assert.deepStrictEqual(
            await loadData(),
            testData.map(({ dt, num}) => [dt, num]),
            "Received data is not equal to expected"
        );
    });

    it("should check result parsing as a raw string", async () => {
        const loadData = queryFull.loader();
        assert.equal(
            await loadData(),
            fullResultRawTabSeparated,
            "Received data is not equal to expected"
        );
    });

    it("should check result streaming as parsed objects", async () => {
        const read = queryFull.reader<Test>({ mode: ParseMode.Objects });
        const data = [];
        for await (const entry of read()) {
            data.push(entry);
        }
        assert.deepStrictEqual(data, testData, "Received data is not equal to expected");
    });

    it("should check result streaming as parsed rows", async () => {
        const read = queryDateNum.reader<ShortRow>({ mode: ParseMode.Rows });
        const data = [];
        for await (const entry of read()) {
            data.push(entry);
        }
        assert.deepStrictEqual(
            data,
            testData.map(({ dt, num}) => [dt, num]),
            "Received data is not equal to expected"
        );
    });

    it("should check result streaming as raw", async () => {
        const read = queryFull.reader();
        const data = await readAll(read());
        assert.equal(
            data,
            fullResultRawTabSeparated,
            "Received data is not equal to expected"
        );
    });

    it("should check proper format substitution", async () => {
        const loadData = query("select * from test format TabSeparated").loader<Test>({ mode: ParseMode.Objects });
        assert.deepStrictEqual(await loadData(), testData, "Received data is not equal to expected");
    });


});
