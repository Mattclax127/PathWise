import { describe, expect, it } from "vitest";
import { MAX_RESUME_BYTES, builtResumeSchema, safeFileName, validateResumeFile } from "@/lib/engine/resume";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2]);
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]);

describe("resume upload validation", () => {
  it("accepts a real PDF and DOCX", () => {
    expect(validateResumeFile("cv.pdf", pdf)).toBeNull();
    expect(validateResumeFile("cv.DOCX", zip)).toBeNull();
  });
  it("rejects wrong types, renamed files, empty and oversized files", () => {
    expect(validateResumeFile("cv.exe", pdf)).toBeTruthy();
    expect(validateResumeFile("cv.pdf", zip)).toBeTruthy();
    expect(validateResumeFile("cv.docx", pdf)).toBeTruthy();
    expect(validateResumeFile("cv.pdf", new Uint8Array())).toBeTruthy();
    expect(validateResumeFile("cv.pdf", new Uint8Array(MAX_RESUME_BYTES + 1).fill(0x25))).toBeTruthy();
  });
  it("sanitizes file names", () => {
    expect(safeFileName("../../etc/pass wd.pdf")).not.toContain("/");
    expect(safeFileName("...")).toBe("resume");
  });
  it("validates the built resume form", () => {
    expect(builtResumeSchema.safeParse({ headline: "Marketing graduate", summary: "", education: "BA Marketing", experience: "", skills: "" }).success).toBe(true);
    expect(builtResumeSchema.safeParse({ headline: "", summary: "", education: "", experience: "", skills: "" }).success).toBe(false);
  });
});
