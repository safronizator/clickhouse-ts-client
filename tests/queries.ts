import {Test} from "./model.js";

export const dropTestTabQuery = "DROP TABLE IF EXISTS test";

export const createTestTabQuery = `
CREATE TABLE test
   (
       dt   DateTime64(0) default now(),
       mark String,
       text String   default '',
       num  Int      default 0
   ) ENGINE = MergeTree() ORDER BY (dt, mark)`;

export const clearTestTabQuery = "TRUNCATE TABLE test";

export const fillTestTabQuery = `
INSERT INTO test (dt, mark, text, num) VALUES
    ('2023-01-01 00:00:00', 'a', 'text1', 1),
    ('2023-01-01 00:00:01', 'b', 'text2', 2),
    ('2023-01-01 00:00:02', 'c', 'text3', 3)
`;

export const testData: Test[] = [
    {
        dt: "2023-01-01 00:00:00",
        mark: "a",
        text: "text1",
        num: 1
    },
    {
        dt: "2023-01-01 00:00:01",
        mark: "b",
        text: "text2",
        num: 2
    },
    {
        dt: "2023-01-01 00:00:02",
        mark: "c",
        text: "text3",
        num: 3
    }
];

export const selectFullQuery = "SELECT * FROM test ORDER BY dt";
