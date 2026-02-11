'use strict';

module.exports = {
  type: 'google',
  routes: [
    {
      method: 'GET',
      path: '/callback',
      handler: 'google.callback',
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
