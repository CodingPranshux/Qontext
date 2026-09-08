import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    // Character offsets into the parsed source text — used for citation
    // mapping in Phase 4 (map a claim back to page/offset in the source doc).
    startOffset: { type: Number, required: true },
    endOffset: { type: Number, required: true },
    tokenCount: { type: Number, required: true },
    sourceFilename: { type: String, required: true },
  },
  { timestamps: true }
);

export const Chunk = mongoose.model('Chunk', chunkSchema);
