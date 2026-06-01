'use strict';

module.exports = {
  type: 'users-permissions',
  routes: [
    {
      method: 'POST',
      path: '/auth/local',
      handler: 'auth.callback',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['users-permissions']
        }
      }
    },
    {
      method: 'POST',
      path: '/auth/local/register',
      handler: 'auth.register',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['users-permissions']
        }
      }
    }
  ]
};
