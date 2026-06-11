declare module 'pdf-parse' {
  interface PdfParseResult {
    numpages: number;
    text: string;
    info?: Record<string, unknown>;
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
