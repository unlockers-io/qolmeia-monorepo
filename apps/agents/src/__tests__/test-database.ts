import { createHash } from "node:crypto";
import path from "node:path";

const LOCAL_SERVER_URL = "postgresql://qolmeia:qolmeia123@127.0.0.1:5436/qolmeia";

const checkout = path.resolve(import.meta.dirname, "../../../..");
const databaseName = `qolmeia_worker_${createHash("sha256").update(checkout).digest("hex").slice(0, 12)}`;

const url = new URL(process.env.DATABASE_URL ?? LOCAL_SERVER_URL);
url.pathname = `/${databaseName}`;
url.search = "";

const testDatabaseUrl = url.toString();

export { checkout, testDatabaseUrl };
