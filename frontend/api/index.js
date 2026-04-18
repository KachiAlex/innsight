const { VercelRequest, VercelResponse } = require('@vercel/node');
const { createApp } = require('./bundle.js');

const app = createApp();

module.exports = async (req, res) => {
  return app(req, res);
};
