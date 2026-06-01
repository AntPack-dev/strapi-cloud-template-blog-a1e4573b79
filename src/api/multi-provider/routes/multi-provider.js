'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'DELETE',
      path: '/multi-provider/providers/:provider',
      handler: 'multi-provider.removeProvider',
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
