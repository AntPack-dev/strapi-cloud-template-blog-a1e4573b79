'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/articles-enhanced',
      handler: 'article-enhanced.findEnhanced',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: [] // Optional authentication
        }
      }
    },
    {
      method: 'GET',
      path: '/articles-enhanced/:id',
      handler: 'article-enhanced.findOneEnhanced',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: [] // Optional authentication
        }
      }
    }
  ]
};
