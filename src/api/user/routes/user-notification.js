'use strict';

/**
 * user notification routes
 */

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/notifications/toggle',
      handler: 'user-notification.toggle',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      },
    },
    {
      method: 'GET',
      path: '/notifications/status',
      handler: 'user-notification.status',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: []
        }
      },
    },
    {
      method: 'POST',
      path: '/admin/notifications/:userId/toggle',
      handler: 'user-notification.adminToggle',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['admin'],
        },
      },
    },
    {
      method: 'GET',
      path: '/admin/notifications/:userId/status',
      handler: 'user-notification.adminStatus',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['admin'],
        },
      },
    },
  ],
};
