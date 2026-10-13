import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";

import { ClientReadyForm } from "./client-ready-form";

const Form = () => (
  <ClientReadyForm>
    <input aria-label="Email" />
    <button type="submit">Send</button>
  </ClientReadyForm>
);

it("keeps every control in the form disabled until it hydrates", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Form />);
  const input = container.querySelector("input");
  const button = container.querySelector("button");
  expect(input?.matches(":disabled")).toBe(true);
  expect(button?.matches(":disabled")).toBe(true);

  act(() => {
    hydrateRoot(container, <Form />);
  });
  expect(input?.matches(":disabled")).toBe(false);
  expect(button?.matches(":disabled")).toBe(false);
});

it("passes form props through to the form element", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(
    <ClientReadyForm className="grid" noValidate>
      <input aria-label="Email" />
    </ClientReadyForm>,
  );
  const form = container.querySelector("form");
  expect(form?.className).toBe("grid");
  expect(form?.noValidate).toBe(true);
});
