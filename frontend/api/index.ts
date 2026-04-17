import { VercelRequest, VercelResponse } from '@vercel/node';

import { createApp } from '../../backend/src/app';

const app = createApp();

export default async (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
