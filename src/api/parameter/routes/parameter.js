'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/parameters',
      handler: 'parameter.getAll',
      config: { policies: [], middlewares: [] },
    },
  ],
};
