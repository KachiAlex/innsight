import { VercelRequest, VercelResponse } from '@vercel/node';

import { createApp } from './bundle.js';

const app = createApp();

export default async (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
