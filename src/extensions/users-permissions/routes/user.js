'use strict';

module.exports = {
  type: 'users-permissions',
  routes: [
    {
      method: 'POST',
      path: '/users/deactivate-account',
      handler: 'user.deactivateAccount',
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
