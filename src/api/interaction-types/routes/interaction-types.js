'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/interaction-types',
      handler: 'interaction-type.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/interaction-types/:id',
      handler: 'interaction-type.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
