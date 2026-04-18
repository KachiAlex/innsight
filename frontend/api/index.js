const { createApp } = require('./bundle.js');

const app = createApp();

module.exports = (req, res) => {
  const query = req.query || {};
  const slugValue = query.slug;

  if (slugValue !== undefined) {
    const slugPath = Array.isArray(slugValue) ? slugValue.join('/') : slugValue;

    // Remove slug from the query map so Express doesn't see it
    delete query.slug;

    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((val) => params.append(key, val));
      } else if (value !== undefined) {
        params.append(key, value);
      }
    });

    const search = params.toString();
    req.url = `/api/${slugPath}${search ? `?${search}` : ''}`;
  }

  return app(req, res);
};
