import { execFileSync } from "node:child_process";

import { checkout, testDatabaseUrl } from "./test-database";

export default (): void => {
  execFileSync("pnpm", ["--filter=@repo/db", "exec", "prisma", "db", "push"], {
    cwd: checkout,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
};
