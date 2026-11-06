import { describe, expect, it } from "vitest";

import { uploadRefusal } from "@/lib/library";

describe("uploadRefusal", () => {
  it("lists each target's accepted formats", () => {
    const pdf = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });

    expect(uploadRefusal(pdf, "brand")).toBe(
      "Formato não suportado. Use PNG, JPG, WEBP, GIF ou SVG.",
    );
    expect(uploadRefusal(pdf, "chat")).toBe("Formato não suportado. Use PNG, JPG, WEBP ou GIF.");
  });
});
