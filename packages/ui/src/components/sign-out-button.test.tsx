import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SignOutButtonView as SignOutButton,
  type SignOutButtonDependencies,
} from "./sign-out-button";

const signOutMock = vi.fn(() => Promise.resolve());
const pushMock = vi.fn();
const refreshMock = vi.fn();
const toastErrorMock = vi.fn();

const dependencies: SignOutButtonDependencies = {
  router: {
    push: (path) => {
      pushMock(path);
    },
    refresh: () => {
      refreshMock();
    },
  },
  showError: (message) => {
    toastErrorMock(message);
  },
  signOut: signOutMock,
};

describe("SignOutButton", () => {
  beforeEach(() => {
    signOutMock.mockClear();
    pushMock.mockClear();
    refreshMock.mockClear();
    toastErrorMock.mockClear();
  });

  it("renders the default label", () => {
    render(<SignOutButton dependencies={dependencies} />);
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("renders a custom label", () => {
    render(<SignOutButton dependencies={dependencies} label="Encerrar sessão" />);
    expect(screen.getByRole("button", { name: "Encerrar sessão" })).toBeTruthy();
  });

  it("calls authClient.signOut and redirects to /login on click", async () => {
    render(<SignOutButton dependencies={dependencies} />);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await vi.waitFor(() => {
      expect(signOutMock).toHaveBeenCalledOnce();
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });

  it("shows an error toast when signOut throws", async () => {
    signOutMock.mockRejectedValueOnce(new Error("boom"));

    render(<SignOutButton dependencies={dependencies} />);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await vi.waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
