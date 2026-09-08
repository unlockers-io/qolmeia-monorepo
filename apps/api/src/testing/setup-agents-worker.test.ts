import { ChildProcess } from "node:child_process";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupAgentsWorker } from "./setup-agents-worker";

const spawn = vi.fn<Parameters<typeof setupAgentsWorker>[0]["spawn"]>();

const createChild = (): ChildProcess => {
  const child = new ChildProcess();
  vi.spyOn(child, "kill").mockReturnValue(true);
  return child;
};

const closeChild = (child: ChildProcess): void => {
  Object.defineProperty(child, "signalCode", { value: "SIGTERM" });
  child.emit("close", null, "SIGTERM");
};

const fetchMock = vi.fn<typeof fetch>();
const setup = (): Promise<() => Promise<void>> => setupAgentsWorker({ fetch: fetchMock, spawn });

beforeEach(() => {
  vi.useFakeTimers();
  spawn.mockReset();
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("agents worker test services", () => {
  it("owns the Node servers directly and awaits both process closures", async () => {
    const fixture = createChild();
    const api = createChild();
    spawn.mockReturnValueOnce(fixture).mockReturnValueOnce(api);

    const teardown = await setup();

    expect(spawn).toHaveBeenNthCalledWith(
      1,
      process.execPath,
      ["--import", "tsx", "src/testing/agents-fixture-server.ts"],
      expect.objectContaining({
        cwd: path.resolve(import.meta.dirname, "../.."),
        stdio: "inherit",
      }),
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      process.execPath,
      ["--import", "tsx", "src/index.ts"],
      expect.objectContaining({ env: expect.objectContaining({ PORT: "4010" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4011/healthz",
      expect.objectContaining({
        headers: { Authorization: "Bearer vitest-fixture-service-secret-value" },
        signal: expect.any(AbortSignal),
      }),
    );

    const stopped = vi.fn();
    const finished = (async () => {
      await teardown();
      stopped();
    })();
    expect(fixture.kill).toHaveBeenCalledWith("SIGTERM");
    expect(api.kill).toHaveBeenCalledWith("SIGTERM");
    closeChild(api);
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).not.toHaveBeenCalled();
    closeChild(fixture);
    await finished;
    expect(stopped).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("force-stops only owned children when graceful shutdown times out", async () => {
    const fixture = createChild();
    const api = createChild();
    spawn.mockReturnValueOnce(fixture).mockReturnValueOnce(api);
    const teardown = await setup();

    const finished = teardown();
    closeChild(api);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fixture.kill).toHaveBeenLastCalledWith("SIGKILL");
    expect(api.kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
    closeChild(fixture);
    await finished;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up when spawning the first service fails", async () => {
    const fixture = createChild();
    spawn.mockReturnValue(fixture);
    fetchMock.mockRejectedValue(new Error("Service unavailable"));
    const starting = setup();
    const failure = expect(starting).rejects.toThrow("Cannot spawn Node");
    fixture.emit("error", new Error("Cannot spawn Node"));
    closeChild(fixture);

    await vi.advanceTimersByTimeAsync(100);
    await failure;
    expect(spawn).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops the first service when the second exits before readiness", async () => {
    const fixture = createChild();
    const api = createChild();
    vi.mocked(fixture.kill).mockImplementation(() => {
      closeChild(fixture);
      return true;
    });
    spawn.mockReturnValueOnce(fixture).mockReturnValueOnce(api);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValue(new Error("Service unavailable"));
    const failure = expect(setup()).rejects.toThrow(
      "Test service src/index.ts exited before it was ready",
    );
    await vi.advanceTimersByTimeAsync(0);
    closeChild(api);

    await vi.advanceTimersByTimeAsync(100);
    await failure;
    expect(fixture.kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up after a readiness timeout", async () => {
    const fixture = createChild();
    vi.mocked(fixture.kill).mockImplementation(() => {
      closeChild(fixture);
      return true;
    });
    spawn.mockReturnValue(fixture);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const failure = expect(setup()).rejects.toThrow(
      "Timed out waiting for http://127.0.0.1:4011/healthz",
    );

    await vi.advanceTimersByTimeAsync(20_000);
    await failure;
    expect(fixture.kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
    expect(spawn).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a bounded failure if owned processes never close", async () => {
    const fixture = createChild();
    const api = createChild();
    spawn.mockReturnValueOnce(fixture).mockReturnValueOnce(api);
    const teardown = await setup();
    const failure = expect(teardown()).rejects.toThrow("Failed to stop test services");

    await vi.advanceTimersByTimeAsync(10_000);
    await failure;
    expect(fixture.kill).toHaveBeenLastCalledWith("SIGKILL");
    expect(api.kill).toHaveBeenLastCalledWith("SIGKILL");
    expect(vi.getTimerCount()).toBe(0);
    closeChild(fixture);
    closeChild(api);
  });
});
