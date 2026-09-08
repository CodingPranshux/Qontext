import { runRetrieval } from '../infra/cache/cachedRetrieval.js';

export async function postSearch(req, res, next) {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: { message: 'query is required' } });
    }

    const { results } = await runRetrieval({ tenantId: req.tenantId, query });

    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
}
