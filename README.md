# clickhouse-ts-client

Clickhouse DB client for NodeJS written in Typescript.

## Key features

- Provides a simple and clear interface for working with ClickHouse databases
- Supports streaming for efficient memory utilization
- Supports parameterized queries
- Optional type checking for query results and input data
- Minimal dependencies

## Table of Contents

- [Installation](#installation)
- [Usage example](#usage-example)
- [Guide](#guide)
  - [Setting up a connection](#setting-up-a-connection)
  - [Executing a query](#executing-a-query)
  - [Receiving data from DB](#receiving-data-from-db)
    - [Load/parse whole result](#loadparse-whole-result)
    - [Stream query results](#stream-query-results)
    - [Describe types for query results](#describe-types-for-query-results)
  - [Sending data into DB](#sending-data-into-db)
    - [Describe types for input data](#describe-types-for-input-data)
  - [Parameterized queries](#parameterized-queries)
  - [Error handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## Installation

You can install clickhouse-node-cli using npm/yarn:

```shell
npm install clickhouse-ts-client

# or

yarn add clickhouse-ts-client
```

## Usage example

To use clickhouse-node-cli, require the library and create an instance of the ConnectorInterface:

```javascript
import clickhouse, { ParseMode } from "clickhouse-node-cli";

const { query, input } = clickhouse();

const createTab = query("CREATE TABLE IF NOT EXISTS clicks (time DateTime, ip IPv4) ENGINE = Memory").exec;
const dropTab = query("DROP TABLE IF EXISTS clicks").exec;
const insertData = input("INSERT INTO clicks");
const getDailyStats = query("SELECT toDate(time) as dt, uniq(ip) FROM clicks GROUP BY dt")
        .loader({ mode: ParseMode.Rows });

await createTab();
await insertData([
    { time: "2023-06-16 23:45:00", ip: "192.168.1.0" },
    { time: "2023-06-17 00:01:15", ip: "192.168.1.1" },
    { time: "2023-06-17 14:47:01", ip: "192.168.1.1" },
]);
console.table([["Date", "Uniq clicks"], ...await getDailyStats()]);
await dropTab();
```

## Guide

### Setting up a connection

```javascript
import clickhouse from "clickhouse-node-cli";

// using settings object:
const conn1 = clickhouse({
    proto: "https",
    host: "192.168.1.0",
    port: 18123, // you can pass string here as well
    user: "tester",
    pwd: "secret",
    db: "test"
});

// using DSN string:
const conn2 = clickhouse("https://tester:secret@192.168.1.0:18123/?database=test");
```

Note: call to default function will not establish a connection, it will only create a connector object. Connection will be established on first query call.

### Executing a query

```javascript
const { query } = clickhouse();
await query("CREATE TABLE IF NOT EXISTS clicks (time DateTime, ip IPv4) ENGINE = Memory").exec();
```

### Receiving data from DB

#### Load/parse whole result

```javascript
const last100ClicksQuery = query("SELECT * FROM clicks ORDER BY time DESC LIMIT 100 FORMAT PrettyCompact");

// Don't parse data, just return raw string as it was received from DB:
const loadRaw = last100ClicksQuery.loader(); // default mode is ParseMode.Raw
console.log(await loadRaw());

// Parse data as array of objects:
const loadClicks = last100ClicksQuery.loader({ mode: ParseMode.Objects });
const uniqIps = new Set((await loadClicks()).map(({ ip }) => ip));

// Parse data as array of rows:
const loadRows = last100ClicksQuery.loader({ mode: ParseMode.Rows });
console.table(await loadRows());
```

Note: format defined by query will be overridden if you use `Rows` or `Objects` parse mode.

#### Stream query results

```javascript
import {createWriteStream} from "fs";
import {pipeline} from "stream/promises";

const last100ClicksQuery = query("SELECT * FROM clicks ORDER BY time DESC LIMIT 100 FORMAT CSV");

// Stream response without parsing:
const readRaw = last100ClicksQuery.reader(); // default mode is ParseMode.Raw
await pipeline(readRaw(), createWriteStream("clicks.csv"));

// Create a stream of objects:
const read = last100ClicksQuery.reader({ mode: ParseMode.Objects });
for await (const { time, ip } of read()) {
    console.log(`${time};${ip}`);
}

// Stream as parsed rows:
const readRows = last100ClicksQuery.reader({ mode: ParseMode.Rows });
for await (const [time, ip] of readRows()) {
    console.log(`${time};${ip}`);
}
```

Notes:
- format defined by query will be overridden if you use `Rows` or `Objects` parse mode
- stream returned by `reader` function is a NodeJS ReadableStream, so you can use it with any other NodeJS stream API
- returned stream set to the [object mode](https://nodejs.org/api/stream.html#object-mode) if you use `Rows` or `Objects` parse mode

#### Describe types for query results

You can pass generic type to the loader/reader funcs to get type checking for query results:

```typescript
import { Row } from "clickhouse-node-cli";

interface Click {
    time: string;
    ip: number;
}

type ClickRow = Row<Click, ["time", "ip"]>; // [string, number];

const last100ClicksQuery = query("SELECT time, ip FROM clicks ORDER BY time DESC LIMIT 100");

// we can pass type in both rows and objects mode:
const loadClicks = last100ClicksQuery.loader<Click>({ mode: ParseMode.Objects }); // () => Promise<Click[]>
const loadClickRows = last100ClicksQuery.loader<ClickRow>({ mode: ParseMode.Rows }); // () => Promise<ClickRow[]>

// same for stream:
const readClicks = last100ClicksQuery.reader<Click>({ mode: ParseMode.Objects }); // () => TypedReadable<Click>
const readClickRows = last100ClicksQuery.reader<ClickRow>({ mode: ParseMode.Rows }); // () => TypedReadable<ClickRow>

// TS will emit an error if you try to pass wrong type for the current parse mode
const loadClicksE = last100ClicksQuery.loader<Click>(); // compile error!
const loadClickRowsE = last100ClicksQuery.loader<ClickRow>({ mode: ParseMode.Objects }); // compile error!
```

### Sending data into DB

```javascript
import { createReadStream } from "fs";
import { Readable } from "stream";
import clickhouse, { createStreamInput } from "clickhouse-node-cli";

const { input } = clickhouse();

const insertData = input("INSERT INTO clicks FORMAT CSV");

// Insert data from CSV string:
await insertData(`2023-06-16 23:45:00,192.168.1.0\n2023-06-17 00:01:15,192.168.1.1`);

// Insert data from array of objects:
await insertData([
    { time: "2023-06-16 23:45:00", ip: "192.168.1.0" },
    { time: "2023-06-17 00:01:15", ip: "192.168.1.1" }
]);

// Insert data from array of rows:
await insertData({
    rows: [
        ["2023-06-17 14:47:01", "192.168.1.0"],
        ["2023-06-17 00:01:15", "192.168.1.1"]
    ]
});

// Insert data from raw stream:
await insertData(createReadStream("clicks.csv"));

// Insert data from stream of objects (we use generator here to create a stream):
async function *generateClicks(n=100) {
    for (let i=0; i<n; i++) {
        yield { time: new Date(), ip: "192.168.1.0" };
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
await insertData(Readable.from(generateClicks()));

// Insert data from stream of rows 
// (we use util function createStreamInput here to create a temporary stream):
const rows = createStreamInput();
(async (n=100) => {
    for (let i=0; i<n; i++) {
        rows.write([new Date(), "192.168.1.0"]);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    rows.end();
})().catch(console.error);
await insertData({ rows });
```

Note: format defined by query will be overridden if you use objects/rows input mode.

#### Describe types for input data

```typescript
import { Row } from "clickhouse-node-cli";

interface Click {
  time: string;
  ip: number;
}

type ClickRow = Row<CLick, ["time", "ip"]>; // [string, number];

const { input } = clickhouse();

const insertClicks = input<Click>("INSERT INTO clicks");
await insertData([
  { time: "2023-06-16 23:45:00", ip: 3232235776 /* "192.168.1.0" in a long format */ }
]); // OK
await insertData([
  { time: "2023-06-16 23:45:00", ip: "192.168.1.0" }
]); // compile error!

const insertClickRows = input<ClickRow>("INSERT INTO clicks (time, ip)");
await insertClickRows({
    rows: [
        ["2023-06-16 23:45:00", 3232235776]
    ]
}); // OK
await insertClickRows({
    rows: [
        ["2023-06-16 23:45:00", "192.168.1.0"]
    ]
}); // compile error!
await insertClickRows([
  { time: "2023-06-16 23:45:00", ip: 3232235776 /* "192.168.1.0" in a long format */ }
]); // compile error!
```

### Parameterized queries

Clickhouse [supports parameterized queries](https://clickhouse.com/docs/en/interfaces/http#cli-queries-with-parameters) in a form of `{name:type}` placeholders. You can use them in your queries and pass values for them as an object:

```javascript
const { query } = clickhouse();
const loadData = query("select * from clicks where toDate(time) = {date:String}");

const someApiHandler = async (req, res) => {
    const { date } = req.query;
    res.json(await loadData({ date }));
};
```

Notes:
- you should use parameterized queries to avoid [SQL injection](https://en.wikipedia.org/wiki/SQL_injection) when you pass user input to the query string
- you may not to pre-process the input values some way, because it's not a part of the query string, and you'll just get an error if your input is not correct for the specified format (or format that was inferred from the type of input data)


### Error handling

There are three types of errors that can be thrown: `ConnectionError`, `DataProcessingError` and `QueryingError`. All of them are subclasses of `ClickhouseError`.

```javascript
import clickhouse, { ClickhouseError, ConnectionError, DataProcessingError, QueryingError } from "clickhouse-node-cli";

const { query } = clickhouse( { host: "wrong.host" } );

try {
    await query("INSERT INTO clicks VALUES (1, 2, 3)").exec();
} catch (err) {
    if (err instanceof ClickhouseError) {
        switch (true) {
            case err instanceof ConnectionError:
                // handle ConnectionError
            case err instanceof DataProcessingError:
                // handle DataProcessingError
            case err instanceof QueryingError:
                // handle QueryingError
            default:
                // handle other ClickhouseError (normally it should not happen)
        }
    } else {
        throw err;
    }
}
```

Note: `ConnectionError` is thrown only when you try to execute a query, but not when you initialize a connection. So you can create a connection with wrong credentials, but you'll get an error only when you try to execute a query.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, please create an issue or submit a pull request on the [GitHub repository](https://github.com/safronizator/clickhouse-ts-client).

## License

clickhouse-node-cli is [MIT licensed](./LICENSE).

