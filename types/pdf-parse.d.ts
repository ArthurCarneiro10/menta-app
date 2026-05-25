declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;

  export default pdfParse;
}