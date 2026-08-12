import { describe, expect, it } from "vitest";
import { sniffMimeType } from "./sniff-mime-type";

describe("sniffMimeType", () => {
  it("recognizes a PDF signature", () => {
    expect(sniffMimeType(Buffer.from("%PDF-1.4\n..."))).toBe("application/pdf");
  });

  it("recognizes a JPEG signature", () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("image/jpeg");
  });

  it("recognizes a PNG signature", () => {
    expect(sniffMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe("image/png");
  });

  it("returns null for content not matching any of the 3 known signatures", () => {
    expect(sniffMimeType(Buffer.from("<html><body>not a real upload</body></html>"))).toBeNull();
  });

  it("returns null for a client claiming PDF while the bytes are actually an executable", () => {
    // MZ header — Windows PE executable — is exactly the kind of mismatch this exists to catch.
    expect(sniffMimeType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(sniffMimeType(Buffer.alloc(0))).toBeNull();
  });
});
