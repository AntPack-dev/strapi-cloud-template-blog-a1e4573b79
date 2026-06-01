'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::parameter.parameter', () => ({
  async getAll(ctx) {
    const entries = await strapi.documents('api::parameter.parameter').findMany({
      fields: ['key', 'value'],
    });

    const data = entries.reduce((acc, entry) => {
      acc[entry.key] = entry.value;
      return acc;
    }, {});

    ctx.body = { data };
  },
}));
