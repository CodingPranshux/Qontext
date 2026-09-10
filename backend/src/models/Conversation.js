import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema(
  {
    chunkId: String,
    text: String,
    documentId: String,
    sourceFilename: String,
    chunkIndex: Number,
    startOffset: Number,
    endOffset: Number,
    rerankScore: Number,
  },
  { _id: false }
);

const turnSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  sources: { type: [sourceSchema], default: [] },
  citedChunkIds: { type: [String], default: [] },
  retrievalQuery: { type: String, default: null },
  rewritten: { type: Boolean, default: false },
  latencyMs: { type: Number, default: null },
  status: { type: String, enum: ['done', 'error'], required: true },
  error: { type: String, default: null },
  askedAt: { type: Date, required: true },
});

const conversationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    turns: { type: [turnSchema], default: [] },
  },
  { timestamps: true }
);

// One active conversation per user — there's no conversation list/switcher
// UI yet, so persistence just keeps "the" chat alive across reloads and
// navigation rather than modeling multiple threads.
conversationSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
