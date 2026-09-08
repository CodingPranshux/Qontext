import { config } from '../config/index.js';
import { Document } from '../models/Document.js';
import { Chunk } from '../models/Chunk.js';
import vectorStore from '../models/vectorStore/index.js';
import { parseFile } from './parsers/index.js';
import { chunkText } from './chunking.service.js';
import { embedTexts as defaultEmbedTexts } from './embedding.service.js';

/**
 * Ingests one uploaded file for a tenant: parse -> chunk -> embed -> dual
 * write (MongoDB for raw text/metadata, vector store for embeddings).
 *
 * `embedTexts` is an injectable dependency (defaults to the real OpenAI
 * client) purely so tests can substitute a fake embedder and avoid live
 * network calls / API keys — everything else always uses the real DB layer.
 *
 * tenantId must already be a trusted value derived from the JWT by
 * requireAuth — this function does not accept it from anywhere else.
 */
export async function ingestDocument({ tenantId, file, embedTexts = defaultEmbedTexts, chunkOptions = {} }) {
  if (!tenantId) {
    throw new Error('ingestDocument requires a tenantId derived from the authenticated request');
  }
  if (!file) {
    const err = new Error('file is required');
    err.status = 400;
    throw err;
  }

  const rawText = await parseFile({
    buffer: file.buffer,
    mimeType: file.mimetype,
    filename: file.originalname,
  });

  const document = await Document.create({
    tenantId,
    filename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    status: 'processing',
  });

  const chunks = chunkText(rawText, {
    chunkSize: chunkOptions.chunkSize ?? config.chunking.size,
    overlap: chunkOptions.overlap ?? config.chunking.overlap,
  });

  if (chunks.length === 0) {
    document.status = 'ready';
    document.chunkCount = 0;
    await document.save();
    return { document, chunkCount: 0 };
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));

  const chunkDocs = await Chunk.insertMany(
    chunks.map((chunk) => ({
      tenantId,
      documentId: document._id,
      chunkIndex: chunk.index,
      text: chunk.text,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      tokenCount: chunk.tokenCount,
      sourceFilename: file.originalname,
    }))
  );

  await Promise.all(
    chunkDocs.map((chunkDoc, i) =>
      vectorStore.upsertVector({
        tenantId: tenantId.toString(),
        chunkId: chunkDoc._id.toString(),
        embedding: embeddings[i],
      })
    )
  );

  document.status = 'ready';
  document.chunkCount = chunkDocs.length;
  await document.save();

  return { document, chunkCount: chunkDocs.length };
}
