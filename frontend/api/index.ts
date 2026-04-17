import { VercelRequest, VercelResponse } from '@vercel/node';

import { createApp } from '../../backend/dist/app.js';

const app = createApp();

export default (req: VercelRequest, res: VercelResponse) => app(req, res);
