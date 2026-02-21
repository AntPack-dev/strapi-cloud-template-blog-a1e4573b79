'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/password/forgot',
      handler: 'password.forgot',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/password/reset',
      handler: 'password.reset',
      config: {
        policies: [],
        middlewares: [],
        auth: false,
      },
    },
  ],
};
