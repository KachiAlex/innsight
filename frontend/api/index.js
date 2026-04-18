const { VercelRequest, VercelResponse } = require('@vercel/node');
const { createApp } = require('./bundle.js');

const app = createApp();

module.exports = (req, res) => {
  // When Vercel rewrites /api/* -> /api/index.js?slug=..., reconstruct original path
  const query = req.query || {};
  const slug = query.slug;

  if (slug !== undefined) {
    // Remove slug from query params and rebuild search string
    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      if (key === 'slug') {
        return;
      }
      const value = query[key];
      if (Array.isArray(value)) {
        value.forEach((val) => params.append(key, val));
      } else if (value !== undefined) {
        params.append(key, value);
      }
    });

    const search = params.toString();
    req.url = `/api/${slug}${search ? `?${search}` : ''}`;
  }

  return app(req, res);
};
