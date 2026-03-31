import { extractText } from "unpdf";

export async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), {
    // Use the legacy build to avoid browser-only APIs (e.g. DOMMatrix) in Node.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMozPdfJs: async () => import("pdfjs-dist/legacy/build/pdf.mjs") as any,
  });
  return Array.isArray(text) ? text.join("\n\n") : String(text);
}
