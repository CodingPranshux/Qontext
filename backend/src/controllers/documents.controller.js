import mongoose from 'mongoose';
import { ingestDocument } from '../services/ingestion.service.js';
import { Document } from '../models/Document.js';
import { Chunk } from '../models/Chunk.js';
import vectorStore from '../models/vectorStore/index.js';

export async function getDocuments(req, res, next) {
  try {
    const documents = await Document.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      documents: documents.map((doc) => ({
        id: doc._id,
        filename: doc.filename,
        status: doc.status,
        chunkCount: doc.chunkCount,
        sizeBytes: doc.sizeBytes,
        createdAt: doc.createdAt,
        error: doc.error,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function postUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'file is required (multipart field "file")' } });
    }

    const { document, chunkCount } = await ingestDocument({ tenantId: req.tenantId, file: req.file });

    res.status(201).json({
      document: {
        id: document._id,
        filename: document.filename,
        status: document.status,
        chunkCount,
        error: document.error,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a document and everything derived from it: its chunks (MongoDB)
 * and their embeddings (vector store). Scoped to the authenticated tenant —
 * a document ID from another tenant 404s exactly like one that doesn't
 * exist, rather than leaking whether it exists elsewhere.
 */
export async function deleteDocument(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: { message: 'Document not found' } });
    }

    const document = await Document.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!document) {
      return res.status(404).json({ error: { message: 'Document not found' } });
    }

    const chunks = await Chunk.find({ documentId: document._id, tenantId: req.tenantId }, '_id').lean();
    const chunkIds = chunks.map((c) => c._id.toString());

    await vectorStore.deleteByChunkIds(chunkIds);
    await Chunk.deleteMany({ documentId: document._id, tenantId: req.tenantId });
    await document.deleteOne();

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
