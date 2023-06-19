import connect, {HttpProto} from "../src/index.js";


export const testConn = () => connect({
    proto: process.env.TEST_PROTO as HttpProto || "http",
    host: process.env.TEST_HOST || "localhost",
    port: process.env.TEST_PORT || 8123,
    user: process.env.TEST_USER || "default",
    pwd: process.env.TEST_PWD || "",
    db: process.env.TEST_DB || "default"
});
