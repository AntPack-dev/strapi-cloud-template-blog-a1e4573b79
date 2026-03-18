'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/multi-provider/providers',
      handler: 'multi-provider.getProviders',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      }
    },
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
    },
    {
      method: 'POST',
      path: '/multi-provider/update-profile-image',
      handler: 'multi-provider.updateProfileImage',
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
      path: '/multi-provider/user-info',
      handler: 'multi-provider.getUserInfo',
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
