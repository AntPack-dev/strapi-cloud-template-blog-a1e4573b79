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
          article: articleId,
          ip_address: ip,
        },
      });

      if (existing) {
        return ctx.conflict('This IP has already rated this article');
      }

      const crypto = require('crypto');
      const documentId = crypto.randomBytes(13).toString('base64url').substring(0, 25);

      const result = await strapi.db.connection.raw(`
        INSERT INTO article_ratings (document_id, ip_address, rating, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
        RETURNING id
      `, [documentId, ip, data.rating]);

      const ratingId = result.rows[0].id;

      await strapi.db.connection.raw(`
        INSERT INTO article_ratings_article_lnk (article_rating_id, article_id)
        VALUES (?, ?)
      `, [ratingId, articleId]);

      return ctx.send({
        data: {
          id: ratingId,
          documentId,
          ip_address: ip,
          rating: data.rating,
          article: articleId,
        },
      });
    } catch (error) {
      console.error('Error creating article rating:', error);
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
          article: articleId,
          ip_address: ip,
        },
      });

      return ctx.send({
        hasRated: !!existing,
        rating: existing?.rating ?? null,
      });
    } catch (error) {
      console.error('Error checking article rating:', error);
      return ctx.badRequest('Error checking rating');
    }
  },

}));
