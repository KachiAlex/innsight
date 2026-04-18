const { createApp } = require('./bundle.js');

const app = createApp();

module.exports = (req, res) => {
  return app(req, res);
};
