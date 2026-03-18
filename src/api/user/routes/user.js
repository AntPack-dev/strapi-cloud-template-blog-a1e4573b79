'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'DELETE',
      path: '/users/remove-provider/:provider',
      handler: 'user.removeProvider',
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
