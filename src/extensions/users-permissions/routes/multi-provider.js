'use strict';

module.exports = {
  type: 'users-permissions',
  routes: [
    {
      method: 'GET',
      path: '/multi-provider/providers',
      handler: 'multi-provider-auth.getProviders',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['users-permissions']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/multi-provider/providers/:provider',
      handler: 'multi-provider-auth.removeProvider',
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
      path: '/multi-provider/callback/:provider',
      handler: 'multi-provider-auth.callback',
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
      path: '/multi-provider/update-profile-image',
      handler: 'multi-provider-auth.updateProfileImage',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['users-permissions']
        }
      }
    },
    {
      method: 'GET',
      path: '/multi-provider/user-info',
      handler: 'multi-provider-auth.getUserInfo',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['users-permissions']
        }
      }
    },
    {
      method: 'GET',
      path: '/connect/google',
      handler: 'multi-provider-auth.redirectToProvider',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
    {
      method: 'GET',
      path: '/connect/facebook',
      handler: 'multi-provider-auth.redirectToProvider',
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
