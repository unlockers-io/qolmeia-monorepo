import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import path from "node:path";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://qolmeia:qolmeia123@localhost:5436/qolmeia?schema=agents_test";
const FIXTURE_SECRET = "vitest-fixture-service-secret-value";
const RETRY_DELAY_MS = 100;

type TestService = {
  assertRunning: () => void;
  child: ChildProcess;
  closed: Promise<void>;
};

type TestRuntime = {
  fetch: typeof fetch;
  spawn: (command: string, args: Array<string>, options: SpawnOptions) => ChildProcess;
};

const startService = (
  script: string,
  env: NodeJS.ProcessEnv,
  launch: TestRuntime["spawn"],
): TestService => {
  // Own the server process itself: pnpm/tsx CLI wrappers can leave grandchildren alive.
  const child = launch(process.execPath, ["--import", "tsx", script], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  let startupError: Error | undefined;
  let hasClosed = false;
  child.once("error", (error: Error) => {
    startupError = error;
  });
  const closed = new Promise<void>((resolve) => {
    child.once("close", () => {
      hasClosed = true;
      resolve();
    });
  });
  return {
    assertRunning: () => {
      if (startupError !== undefined) {
        throw startupError;
      }
      if (hasClosed || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Test service ${script} exited before it was ready`);
      }
    },
    child,
    closed,
  };
};

const stopService = async ({ child, closed }: TestService): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) {
    await closed;
    return;
  }
  const forceKill = setTimeout(() => {
    child.kill("SIGKILL");
  }, 5000);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    deadline = setTimeout(() => {
      reject(new Error("Test service did not stop"));
    }, 10_000);
  });
  child.kill("SIGTERM");
  try {
    await Promise.race([closed, timeout]);
  } finally {
    clearTimeout(forceKill);
    clearTimeout(deadline);
  }
};

const delay = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, RETRY_DELAY_MS);
  });

const waitForService = async (
  service: TestService,
  url: string,
  request: typeof fetch,
  secret?: string,
): Promise<void> => {
  const deadline = Date.now() + 20_000;
  const attempt = async (): Promise<void> => {
    service.assertRunning();
    try {
      const response = await request(url, {
        headers: secret === undefined ? undefined : { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        service.assertRunning();
        return;
      }
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await delay();
    return attempt();
  };
  await attempt();
};

export const setupAgentsWorker = async (runtime: TestRuntime): Promise<() => Promise<void>> => {
  const services: Array<TestService> = [];
  const teardown = async (): Promise<void> => {
    const results = await Promise.allSettled(services.map(stopService));
    const errors = results.flatMap<unknown>((result) => {
      const reason: unknown = result.status === "rejected" ? result.reason : undefined;
      return result.status === "rejected" ? [reason] : [];
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, "Failed to stop test services");
    }
  };
  try {
    const fixture = startService(
      "src/testing/agents-fixture-server.ts",
      { AGENTS_FIXTURE_SECRET: FIXTURE_SECRET, DATABASE_URL: databaseUrl },
      runtime.spawn,
    );
    services.push(fixture);
    await waitForService(fixture, "http://127.0.0.1:4011/healthz", runtime.fetch, FIXTURE_SECRET);
    const api = startService(
      "src/index.ts",
      {
        BETTER_AUTH_SECRET: "test-secret-minimum-32-characters-long",
        CORS_ORIGINS: "http://localhost:3000",
        DATABASE_URL: databaseUrl,
        HOST: "127.0.0.1",
        INTERNAL_SHARED_SECRET: "vitest-internal-shared-secret-value",
        NODE_ENV: "test",
        PORT: "4010",
      },
      runtime.spawn,
    );
    services.push(api);
    await waitForService(api, "http://127.0.0.1:4010/healthz", runtime.fetch);
    return teardown;
  } catch (error) {
    await teardown();
    throw error;
  }
};

export default (): Promise<() => Promise<void>> => setupAgentsWorker({ fetch, spawn });
