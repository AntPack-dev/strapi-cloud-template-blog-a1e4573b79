'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article-rating.article-rating', ({ strapi }) => ({

  async create(ctx) {
    const { data } = ctx.request.body;
    const ip = ctx.request.headers['x-forwarded-for']?.split(',')[0]?.trim() || ctx.request.ip;

    if (!data?.article) {
      return ctx.badRequest('Article is required');
    }

    if (!data?.rating) {
      return ctx.badRequest('Rating is required');
    }

    const validRatings = ['cinco_tildes', 'neutral', 'sin_tilde'];
    if (!validRatings.includes(data.rating)) {
      return ctx.badRequest('Invalid rating value');
    }

    const articleId = parseInt(data.article, 10);
    if (isNaN(articleId)) {
      return ctx.badRequest('Article ID must be a number');
    }

    try {
      const existing = await strapi.db.query('api::article-rating.article-rating').findOne({
        where: {
          article_id: articleId,
          ip_address: ip,
        },
      });

      if (existing) {
        return ctx.conflict('This IP has already rated this article');
      }

      const rating = await strapi.db.query('api::article-rating.article-rating').create({
        data: {
          article_id: articleId,
          ip_address: ip,
          rating: data.rating,
        },
      });

      return ctx.send({ data: rating });
    } catch (error) {
      if (error.code === '23505') {
        return ctx.conflict('This IP has already rated this article');
      }
      strapi.log.error('[article-rating] Error creating rating:', error);
      return ctx.badRequest('Error saving rating');
    }
  },

  async check(ctx) {
    const { article } = ctx.query;
    const ip = ctx.request.headers['x-forwarded-for']?.split(',')[0]?.trim() || ctx.request.ip;

    if (!article) {
      return ctx.badRequest('Article ID is required');
    }

    const articleId = parseInt(article, 10);
    if (isNaN(articleId)) {
      return ctx.badRequest('Article ID must be a number');
    }

    try {
      const existing = await strapi.db.query('api::article-rating.article-rating').findOne({
        where: {
          article_id: articleId,
          ip_address: ip,
        },
      });

      return ctx.send({
        hasRated: !!existing,
        rating: existing?.rating ?? null,
      });
    } catch (error) {
      strapi.log.error('[article-rating] Error checking rating:', error);
      return ctx.badRequest('Error checking rating');
    }
  },

}));
