'use strict';

module.exports = {
  type: 'routes-debug',
  routes: [
    {
      method: 'GET',
      path: '/routes',
      handler: 'routes-debug.getRoutes',
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
