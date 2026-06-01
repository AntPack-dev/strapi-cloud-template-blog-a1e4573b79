'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::interaction-types.interaction-type', ({ strapi }) => ({
  async find(ctx) {
    try {
      const entities = await strapi.db.query('api::interaction-types.interaction-type').findMany({
        where: { active: true },
        orderBy: { id: 'asc' }
      });

      return ctx.send({
        data: entities,
        meta: {
          total: entities.length,
        },
      });
    } catch (error) {
      console.error('Error fetching interaction types:', error);
      return ctx.badRequest('Error fetching interaction types');
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    try {
      const entity = await strapi.db.query('api::interaction-types.interaction-type').findOne({
        where: { id, active: true }
      });

      if (!entity) {
        return ctx.notFound('Interaction type not found');
      }

      return ctx.send({
        data: entity,
      });
    } catch (error) {
      console.error('Error fetching interaction type:', error);
      return ctx.badRequest('Error fetching interaction type');
    }
  },
}));
