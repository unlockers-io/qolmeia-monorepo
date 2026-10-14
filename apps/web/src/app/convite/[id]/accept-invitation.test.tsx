import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcceptInvitationView, type AcceptInvitationDependencies } from "./accept-invitation";

const renderAccept = (error: { code?: string; status?: number } | null) => {
  const push = vi.fn();
  const replace = vi.fn();
  const acceptInvitation = vi.fn<AcceptInvitationDependencies["acceptInvitation"]>();
  acceptInvitation.mockResolvedValue({ error });
  const dependencies: AcceptInvitationDependencies = {
    acceptInvitation,
    router: {
      push: (href) => {
        push(href);
      },
      refresh: () => {},
      replace: (href) => {
        replace(href);
      },
    },
  };
  render(<AcceptInvitationView dependencies={dependencies} invitationId="inv-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));
  return { acceptInvitation, push, replace };
};

describe("AcceptInvitation", () => {
  it("accepts the invitation and opens the chat", async () => {
    const { acceptInvitation, push } = renderAccept(null);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
    expect(acceptInvitation).toHaveBeenCalledWith("inv-1");
  });

  it("sends a signed-out visitor to the login and back", async () => {
    const { replace } = renderAccept({ status: 401 });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?from=%2Fconvite%2Finv-1");
    });
  });

  it("explains an invitation sent to another e-mail", async () => {
    renderAccept({ code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION", status: 403 });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este convite foi enviado para outro e-mail.",
    );
  });

  it("explains an expired or unknown invitation", async () => {
    renderAccept({ code: "INVITATION_NOT_FOUND", status: 400 });

    expect(await screen.findByRole("alert")).toHaveTextContent("já foi usado ou expirou");
  });
});
