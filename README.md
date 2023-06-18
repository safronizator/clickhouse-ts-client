# clickhouse-node-cli

Clickhouse DB client for NodeJS written in Typescript.

## Key features

- Provides a simple and clear interface for working with ClickHouse databases
- Supports streaming for efficient memory utilization 
- Optional type checking for query results and input data
- Minimal dependencies

## Table of Contents

- [Installation](#installation)
- [Usage example](#usage-example)
- [Guide](#guide)
  - [Setting up a connection](#setting-up-a-connection)
  - [Executing a query](#executing-a-query)
  - [Receive data from DB](#receive-data-from-db)
    - [Load/parse whole result](#loadparse-whole-result)
    - [Stream query results](#stream-query-results)
    - [Describe types for query results](#describe-types-for-query-results)
  - [Send data into DB](#send-data-into-db)
    - [Describe types for input data](#describe-types-for-input-data)
  - [Avoiding SQL injections](#avoiding-sql-injections)
  - [Error handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## Installation

You can install clickhouse-node-cli using npm/yarn:

```shell
npm install clickhouse-node-cli

# or

yarn add clickhouse-node-cli
```

## Usage example

To use clickhouse-node-cli, require the library and create an instance of the ConnectorInterface:

```javascript
import clickhouse, { ParseMode } from "clickhouse-node-cli";

const { query, input } = clickhouse();

const createTab = query("CREATE TABLE IF NOT EXISTS clicks (time DateTime, ip IPv4) ENGINE = Memory").exec;
const dropTab = query("DROP TABLE IF EXISTS clicks").exec;
const insertData = input("INSERT INTO clicks");
const getDailyStats = query("SELECT toDate(time) as dt, uniq(ip) FROM clicks GROUP BY dt").loader({ mode: ParseMode.Rows });

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

### Receive data from DB

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

type ClickRow = Row<CLick, ["time", "ip"]>; // [string, number];

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

### Send data into DB

_TODO_

#### Describe types for input data

_TODO_

### Avoiding SQL injections

_TODO_

### Error handling

_TODO_

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, please create an issue or submit a pull request on the [GitHub repository](https://github.com/webproducer/clickhouse-node-cli).

## License

clickhouse-node-cli is [MIT licensed](./LICENSE).

