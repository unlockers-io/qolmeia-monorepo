import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssetImage } from "./asset-image";

describe("AssetImage", () => {
  it.each([
    "https://assets.example.com/assets/private?expires=123&signature=test-signature",
    "blob:https://app.example.com/upload-preview",
  ])("fetches %s directly without putting private content in the optimizer cache", (src) => {
    render(<AssetImage alt="Referência de marca" height={800} src={src} width={800} />);
    const image = screen.getByRole("img", { name: "Referência de marca" });
    expect(image).toHaveAttribute("src", src);
    expect(image).toHaveAttribute("height", "800");
    expect(image).toHaveAttribute("width", "800");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("lazy-loads remote asset thumbnails", () => {
    render(
      <AssetImage alt="Arquivo" height={64} src="https://assets.example.com/a.png" width={64} />,
    );
    expect(screen.getByRole("img", { name: "Arquivo" })).toHaveAttribute("loading", "lazy");
  });
});
