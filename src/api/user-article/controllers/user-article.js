'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-article.user-article', ({ strapi }) => ({

  async createArticle(ctx) {
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to create articles');
    }

    const {
      title,
      description,
      slug,
      imageCard,
      cover,
      readingTime,
      author,
      category,
      main_category,
      sub_categories,
      countries,
      blocks,
      seo,
      creationDate,
      Corrections,
    } = ctx.request.body?.data ?? ctx.request.body ?? {};

    if (!title || !cover || !imageCard || !readingTime) {
      return ctx.badRequest('Missing required fields: title, cover, imageCard, readingTime');
    }

    try {
      const article = await strapi.db.query('api::article.article').create({
        data: {
          title,
          description,
          slug,
          imageCard,
          cover,
          readingTime,
          author,
          category,
          main_category,
          sub_categories,
          countries,
          blocks,
          seo,
          creationDate,
          Corrections,
          currentStatus: 'draft',
          publishedAt: null,
        },
        populate: ['imageCard', 'cover', 'author', 'category', 'main_category'],
      });

      const ownership = await strapi.db.query('api::user-article.user-article').create({
        data: {
          user: userId,
          article: article.id,
        },
      });

      return ctx.created({
        data: {
          article,
          ownership: {
            id: ownership.id,
            userId,
            articleId: article.id,
          },
        },
      });
    } catch (error) {
      console.error('Error creating user article:', error);
      return ctx.badRequest('Error creating article: ' + error.message);
    }
  },

  async getMyArticles(ctx) {
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to view your articles');
    }

    const page = parseInt(ctx.query.page ?? 1, 10);
    const pageSize = parseInt(ctx.query.pageSize ?? 10, 10);
    const currentStatusFilter = ctx.query.currentStatus;

    const validStatuses = ['draft', 'in-review', 'rejected', 'approved'];
    if (currentStatusFilter && !validStatuses.includes(currentStatusFilter)) {
      return ctx.badRequest('Invalid currentStatus value');
    }

    try {
      const records = await strapi.db.query('api::user-article.user-article').findMany({
        where: { user: userId },
        populate: {
          article: {
            populate: {
              imageCard: true,
              cover: true,
              author: { select: ['id', 'name'] },
              category: { select: ['id', 'name', 'slug'] },
              main_category: { select: ['id', 'name', 'slug'] },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      let articles = records
        .filter((r) => r.article !== null)
        .map((r) => r.article);

      if (currentStatusFilter) {
        articles = articles.filter((a) => a.currentStatus === currentStatusFilter);
      }

      const total = await strapi.db.query('api::user-article.user-article').count({
        where: { user: userId },
      });

      return ctx.send({
        data: articles,
        meta: {
          pagination: {
            page,
            pageSize,
            total,
            pageCount: Math.ceil(total / pageSize),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching user articles:', error);
      return ctx.badRequest('Error fetching articles: ' + error.message);
    }
  },
}));
