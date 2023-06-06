import {strict as assert} from "assert";
import connect, {Row} from "../src";
import {readAll} from "../src/internal.js";
import {Test} from "./model.js";
import {createTestTabQuery, dropTestTabQuery, fillTestTabQuery, testData} from "./queries.js";



describe("Receiving data from DB", () => {

    const query = connect();

    const dropTable = query<void, never>(dropTestTabQuery).execute;
    const createTable = query<void, never>(createTestTabQuery).execute;
    const fillTable = query<void, never>(fillTestTabQuery).execute;

    before(async () => {
        await dropTable();
        await createTable();
        await fillTable();
    });

    after(() => {
        return dropTable();
    });

    it("should check result parsing as an array of objects", async () => {
        const data = await query<Test, never>("SELECT * FROM test ORDER BY dt").parseResult();
        assert.deepStrictEqual(data, testData, "Received data is not equal to expected");
    });

    it("should check result parsing as an array of rows", async () => {
        //TODO: unobvious typings:
        const data = await query(
            "SELECT dt, num FROM test ORDER BY dt"
        ).parseResultRows<Row<Test, ["dt", "num"]>>();
        assert.deepStrictEqual(
            data,
            testData.map(({ dt, num}) => [dt, num]),
            "Received data is not equal to expected"
        );
    });

    it("should check result streaming as parsed objects", async () => {
        const s = query<Test, never>("SELECT * FROM test ORDER BY dt").streamResult();
        const data = [];
        for await (const entry of s) {
            data.push(entry);
        }
        assert.deepStrictEqual(data, testData, "Received data is not equal to expected");
    });

    it("should check result streaming as parsed rows", async () => {
        //TODO: unobvious typings:
        const s = query(
            "SELECT dt, num FROM test ORDER BY dt"
        ).streamResultRows<Row<Test, ["dt", "num"]>>();
        const data = [];
        for await (const entry of s) {
            data.push(entry);
        }
        assert.deepStrictEqual(
            data,
            testData.map(({ dt, num}) => [dt, num]),
            "Received data is not equal to expected"
        );
    });

    it("should check result streaming as raw objects", async () => {
        const data = await readAll(query(
            "SELECT * FROM test ORDER BY dt LIMIT 2 FORMAT TabSeparated"
        ).streamResultRaw());
        assert.equal(
            data,
            "2023-01-01 00:00:00\ta\ttext1\t1\n2023-01-01 00:00:01\tb\ttext2\t2\n",
            "Received data is not equal to expected"
        );
    });


});
