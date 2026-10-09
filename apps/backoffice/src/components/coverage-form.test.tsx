import type { CoverageResponse, MeResponse } from "@repo/worker-api/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CoverageForm } from "./coverage-form";

const refresh = vi.fn<() => void>();
const router: AppRouterInstance = {
  back: vi.fn<() => void>(),
  bfcacheId: "coverage-test",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh,
  replace: vi.fn<() => void>(),
};
const me: MeResponse = {
  currentOrg: null,
  orgs: [{ id: "co_staff", name: "Qolmeia", role: "STAFF", slug: "qolmeia" }],
  role: null,
  user: {
    displayName: null,
    email: "operator@qolmeia.dev",
    emailVerified: true,
    id: "u_1",
    image: null,
    name: "Operator",
    username: null,
  },
};
const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
  Promise.resolve(Response.json(url === "/api/me" ? me : {})),
);

const options: CoverageResponse["options"] = {
  companies: [],
  disciplines: ["marketing-strategist", "designer"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coverage response compatibility", () => {
  it.each([
    { label: "Marketing Strategist", response: options, version: "without labels" },
    {
      label: "Estrategista de marketing",
      response: {
        ...options,
        disciplineNames: { "marketing-strategist": "Estrategista de marketing" },
      },
      version: "with labels",
    },
  ])("edits and saves discipline IDs $version", async ({ label, response }) => {
    render(
      <AppRouterContext value={router}>
        <CoverageForm initial={{ companies: [], disciplines: ["designer"] }} options={response} />
      </AppRouterContext>,
    );

    expect(screen.getByRole("checkbox", { name: "Designer" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cobertura" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/backoffice/assignments/me"),
        expect.objectContaining({
          body: JSON.stringify({
            companies: [],
            disciplines: ["designer", "marketing-strategist"],
          }),
          method: "PUT",
        }),
      );
      expect(refresh).toHaveBeenCalledOnce();
    });
    const save = fetchMock.mock.calls.find(([url]) => url.endsWith("/assignments/me"));
    expect(new Headers(save?.[1]?.headers).get("X-Org-Id")).toBe("co_staff");
  });
});
