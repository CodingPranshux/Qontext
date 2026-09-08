import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Document = mongoose.model('Document', documentSchema);
