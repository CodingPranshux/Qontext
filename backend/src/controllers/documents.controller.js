import { ingestDocument } from '../services/ingestion.service.js';
import { Document } from '../models/Document.js';

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
