import { VercelRequest, VercelResponse } from '@vercel/node';

import { createApp } from '../backend/src/app';

const app = createApp();

export default (req: VercelRequest, res: VercelResponse) => app(req, res);
