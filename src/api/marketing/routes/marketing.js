'use strict';

/**
 * marketing router
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/marketing/send-newsletter',
      handler: 'marketing.sendNewsletter',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/marketing/contact',
      handler: 'marketing.contact',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/marketing/interest',
      handler: 'marketing.interest',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

