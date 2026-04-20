'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/articles/randomize-featured',
      handler: 'article.randomizeFeatured',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
