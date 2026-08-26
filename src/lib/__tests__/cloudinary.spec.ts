import { buildUploadFolder } from "../cloudinary";

describe("organisation upload folders", () => {
  it("keeps existing Moksha folder paths stable", () => {
    expect(buildUploadFolder("MOKSHA", "moksha-sewa/volunteers/photographs"))
      .toBe("moksha-sewa/volunteers/photographs");
  });

  it("namespaces relative folders by organisation", () => {
    expect(buildUploadFolder("NAMOGANGE", "gallery")).toBe("namo-gange/gallery");
    expect(buildUploadFolder("AROGYA", "delegates/id-proofs")).toBe("arogya/delegates/id-proofs");
  });

  it("rejects traversal and malformed folders", () => {
    expect(() => buildUploadFolder("MOKSHA", "../arogya/private")).toThrow("Invalid upload folder");
    expect(() => buildUploadFolder("MOKSHA", "media//nested")).toThrow("Invalid upload folder");
  });
});
