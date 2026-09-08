import pdfParse from 'pdf-parse';

/**
 * Parses an uploaded file's buffer into raw text.
 *
 * pdf-parse is used for PDFs: it's a thin, pure-JS wrapper around Mozilla's
 * pdf.js text extraction with a simple `parse(buffer) -> { text }` API and no
 * native/system dependencies (unlike e.g. pdftotext-based libraries), which
 * matters for a scaffold that has to run the same way on any machine.
 */
export async function parseFile({ buffer, mimeType, filename }) {
  const lowerName = (filename || '').toLowerCase();

  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const { text } = await pdfParse(buffer);
    return text;
  }

  if (mimeType === 'text/plain' || lowerName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  const err = new Error(`Unsupported file type: ${mimeType || filename}`);
  err.status = 415;
  throw err;
}
