import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const RESUME_MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } as const;

/** Checks extension, size and the file's own signature, so a renamed file is rejected. Returns an error message or null. */
export function validateResumeFile(name: string, bytes: Uint8Array): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext !== "pdf" && ext !== "docx") return "Upload a PDF or DOCX file.";
  if (bytes.length === 0) return "That file is empty.";
  if (bytes.length > MAX_RESUME_BYTES) return "Keep the file under 5 MB.";
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (ext === "pdf" && !head.startsWith("%PDF-")) return "That does not look like a real PDF.";
  if (ext === "docx" && !(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) return "That does not look like a real DOCX.";
  return null;
}
export const resumeMime = (name: string) => (name.toLowerCase().endsWith(".pdf") ? RESUME_MIME.pdf : RESUME_MIME.docx);
export const safeFileName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-80) || "resume";

const line = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
export const builtResumeSchema = z.object({
  headline: line(120).min(2, "Add a short headline."),
  summary: line(600),
  education: line(800).min(2, "Add your education."),
  experience: line(2000),
  skills: line(600),
});
export type BuiltResume = z.infer<typeof builtResumeSchema>;
