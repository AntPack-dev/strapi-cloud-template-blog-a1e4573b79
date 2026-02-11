'use strict';

module.exports = {
  type: 'oauth-token',
  routes: [
    {
      method: 'GET',
      path: '/google/callback',
      handler: 'oauth-token.googleCallback',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    }
  ]
};
