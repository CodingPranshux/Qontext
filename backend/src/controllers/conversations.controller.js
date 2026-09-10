import { Conversation } from '../models/Conversation.js';

const MAX_TEXT_LENGTH = 20000;
const MAX_ARRAY_LENGTH = 50;
// Bounds how large one user's conversation document can grow — this is
// display scrollback, not what gets sent to the LLM (chat.controller.js
// already caps that separately), so it can hold much more than a prompt.
const MAX_STORED_TURNS = 200;

function sanitizeSource(source) {
  if (!source || typeof source !== 'object') return null;
  return {
    chunkId: typeof source.chunkId === 'string' ? source.chunkId : '',
    text: typeof source.text === 'string' ? source.text.slice(0, MAX_TEXT_LENGTH) : '',
    documentId: typeof source.documentId === 'string' ? source.documentId : '',
    sourceFilename: typeof source.sourceFilename === 'string' ? source.sourceFilename : '',
    chunkIndex: typeof source.chunkIndex === 'number' ? source.chunkIndex : null,
    startOffset: typeof source.startOffset === 'number' ? source.startOffset : null,
    endOffset: typeof source.endOffset === 'number' ? source.endOffset : null,
    rerankScore: typeof source.rerankScore === 'number' ? source.rerankScore : null,
  };
}

/**
 * Trusts only a known shape from the client, same pattern as
 * chat.controller.js's sanitizeHistory — this is stored data, not just a
 * prompt input, so it's worth being just as defensive.
 */
function sanitizeTurn(body) {
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    const err = new Error('question is required');
    err.status = 400;
    throw err;
  }

  const status = body.status === 'error' ? 'error' : 'done';
  const askedAt = body.askedAt && !Number.isNaN(Date.parse(body.askedAt)) ? new Date(body.askedAt) : new Date();

  return {
    question: body.question.slice(0, MAX_TEXT_LENGTH),
    answer: typeof body.answer === 'string' ? body.answer.slice(0, MAX_TEXT_LENGTH) : '',
    sources: Array.isArray(body.sources) ? body.sources.slice(0, MAX_ARRAY_LENGTH).map(sanitizeSource).filter(Boolean) : [],
    citedChunkIds: Array.isArray(body.citedChunkIds)
      ? body.citedChunkIds.filter((c) => typeof c === 'string').slice(0, MAX_ARRAY_LENGTH)
      : [],
    retrievalQuery: typeof body.retrievalQuery === 'string' ? body.retrievalQuery.slice(0, MAX_TEXT_LENGTH) : null,
    rewritten: Boolean(body.rewritten),
    latencyMs: typeof body.latencyMs === 'number' ? body.latencyMs : null,
    status,
    error: status === 'error' && typeof body.error === 'string' ? body.error.slice(0, MAX_TEXT_LENGTH) : null,
    askedAt,
  };
}

function serializeTurn(turn) {
  return {
    id: turn._id.toString(),
    question: turn.question,
    answer: turn.answer,
    sources: turn.sources,
    citedChunkIds: turn.citedChunkIds,
    retrievalQuery: turn.retrievalQuery,
    rewritten: turn.rewritten,
    latencyMs: turn.latencyMs,
    status: turn.status,
    error: turn.error,
    askedAt: turn.askedAt,
  };
}

export async function getActiveConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ tenantId: req.tenantId, userId: req.userId }).lean();
    const turns = (conversation?.turns || []).map(serializeTurn);
    res.status(200).json({ turns });
  } catch (err) {
    next(err);
  }
}

export async function postTurn(req, res, next) {
  try {
    const turn = sanitizeTurn(req.body);

    const conversation = await Conversation.findOneAndUpdate(
      { tenantId: req.tenantId, userId: req.userId },
      { $push: { turns: { $each: [turn], $slice: -MAX_STORED_TURNS } } },
      { upsert: true, new: true }
    );

    res.status(201).json({ turn: serializeTurn(conversation.turns[conversation.turns.length - 1]) });
  } catch (err) {
    next(err);
  }
}

export async function deleteActiveConversation(req, res, next) {
  try {
    await Conversation.deleteOne({ tenantId: req.tenantId, userId: req.userId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
