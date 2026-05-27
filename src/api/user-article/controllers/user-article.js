'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function calcReadingTime(blocks = []) {
  let words = 0;
  for (const block of blocks) {
    const type = block.__component;
    if (type === 'shared.rich-text' && block.body) {
      words += block.body.split(/\s+/).filter(Boolean).length;
    } else if (type === 'shared.subtitle' && block.text) {
      words += block.text.split(/\s+/).filter(Boolean).length;
    } else if (type === 'shared.user-quote' && block.body) {
      words += block.body.split(/\s+/).filter(Boolean).length;
    } else if (type === 'shared.quote') {
      if (block.title) words += block.title.split(/\s+/).filter(Boolean).length;
      if (block.body) words += block.body.split(/\s+/).filter(Boolean).length;
    }
  }
  return Math.max(1, Math.ceil(words / 200));
}

const ARTICLE_POPULATE = {
  cover: true,
  imageCard: true,
  author: { select: ['id', 'name'] },
  userAuthor: { select: ['id', 'firstName', 'lastName', 'imageUrl'] },
  category: { select: ['id', 'name', 'slug'] },
  main_category: { select: ['id', 'name', 'slug'] },
  sub_categories: { select: ['id', 'name', 'slug'] },
  blocks: { populate: { file: true } },
};

// Document Service (strapi.documents) uses 'fields' instead of 'select' for nested populate
// and 'on' fragments for dynamic zone component-specific populate
const ARTICLE_POPULATE_DOCS = {
  cover: true,
  imageCard: true,
  author: { fields: ['id', 'name'] },
  userAuthor: { fields: ['id', 'firstName', 'lastName', 'imageUrl'] },
  category: { fields: ['id', 'name', 'slug'] },
  main_category: { fields: ['id', 'name', 'slug'] },
  sub_categories: { fields: ['id', 'name', 'slug'] },
  blocks: {
    on: {
      'shared.media': { populate: { file: true } },
    },
  },
};

const EDITABLE_STATUSES = ['draft', 'rejected'];

module.exports = createCoreController('api::user-article.user-article', ({ strapi }) => ({

  async createArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión para crear artículos');

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const { title, description, cover, category, main_category, sub_categories, countries, blocks, seo, creationDate } = body;

    if (!title) return ctx.badRequest('El campo title es requerido');
    if (!cover)  return ctx.badRequest('El campo cover es requerido');

    try {
      const slug = slugify(title);
      const readingTime = calcReadingTime(blocks);

      const article = await strapi.documents('api::article.article').create({
        data: {
          title,
          description,
          slug,
          cover,
          imageCard: cover,
          readingTime,
          category,
          main_category,
          sub_categories,
          countries,
          blocks,
          seo,
          creationDate,
          userAuthor: userId,
          currentStatus: 'draft',
          publishedAt: null,
        },
        populate: ARTICLE_POPULATE_DOCS,
      });

      await strapi.db.query('api::user-article.user-article').create({
        data: { user: userId, article: article.id },
      });

      return ctx.created({ data: article });
    } catch (error) {
      strapi.log.error('[user-article] createArticle error:', error);
      return ctx.badRequest('Error al crear el artículo: ' + error.message);
    }
  },

  async updateArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const ownership = await strapi.db.query('api::user-article.user-article').findOne({
      where: { article: id, user: userId },
      populate: { article: { select: ['id', 'documentId', 'currentStatus'] } },
    });

    if (!ownership) return ctx.forbidden('No tenés permiso para editar este artículo');

    const status = ownership.article?.currentStatus;
    if (!EDITABLE_STATUSES.includes(status)) {
      return ctx.forbidden(`No se puede editar un artículo en estado "${status}"`);
    }

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const { title, description, cover, category, main_category, sub_categories, countries, blocks, seo, creationDate } = body;

    const updateData = {};
    if (title !== undefined)          { updateData.title = title; updateData.slug = slugify(title); }
    if (description !== undefined)    updateData.description = description;
    if (cover !== undefined)          { updateData.cover = cover; updateData.imageCard = cover; }
    if (category !== undefined)       updateData.category = category;
    if (main_category !== undefined)  updateData.main_category = main_category;
    if (sub_categories !== undefined) updateData.sub_categories = sub_categories;
    if (countries !== undefined)      updateData.countries = countries;
    if (seo !== undefined)            updateData.seo = seo;
    if (creationDate !== undefined)   updateData.creationDate = creationDate;
    if (blocks !== undefined)         { updateData.blocks = blocks; updateData.readingTime = calcReadingTime(blocks); }

    try {
      const updated = await strapi.documents('api::article.article').update({
        documentId: ownership.article.documentId,
        data: updateData,
        populate: ARTICLE_POPULATE_DOCS,
      });

      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] updateArticle error:', error);
      return ctx.badRequest('Error al actualizar el artículo: ' + error.message);
    }
  },

  async submitForReview(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const ownership = await strapi.db.query('api::user-article.user-article').findOne({
      where: { article: id, user: userId },
      populate: {
        article: {
          select: ['id', 'currentStatus', 'title'],
          populate: { cover: true },
        },
      },
    });

    if (!ownership) return ctx.forbidden('No tenés permiso para enviar este artículo');

    const article = ownership.article;
    if (!EDITABLE_STATUSES.includes(article?.currentStatus)) {
      return ctx.forbidden(`El artículo ya está en estado "${article?.currentStatus}"`);
    }

    if (!article.title || !article.cover) {
      return ctx.badRequest('El artículo necesita título y portada antes de enviarse a revisión');
    }

    try {
      const updated = await strapi.db.query('api::article.article').update({
        where: { id },
        data: { currentStatus: 'in-review' },
        populate: { cover: true, category: { select: ['id', 'name'] } },
      });

      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] submitForReview error:', error);
      return ctx.badRequest('Error al enviar a revisión: ' + error.message);
    }
  },

  async getMyArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const ownership = await strapi.db.query('api::user-article.user-article').findOne({
      where: { article: id, user: userId },
    });

    if (!ownership) return ctx.forbidden('No tenés permiso para ver este artículo');

    try {
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: ARTICLE_POPULATE,
      });

      if (!article) return ctx.notFound('Artículo no encontrado');

      return ctx.send({ data: article });
    } catch (error) {
      strapi.log.error('[user-article] getMyArticle error:', error);
      return ctx.badRequest('Error al obtener el artículo: ' + error.message);
    }
  },

  async getMyArticles(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión para ver tus artículos');

    const page     = Math.max(1, parseInt(ctx.query.page ?? 1, 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(ctx.query.pageSize ?? 10, 10)));
    const currentStatusFilter = ctx.query.currentStatus;

    const validStatuses = ['draft', 'in-review', 'rejected', 'approved'];
    if (currentStatusFilter && !validStatuses.includes(currentStatusFilter)) {
      return ctx.badRequest('Valor de currentStatus inválido');
    }

    try {
      const baseWhere = {
        user: userId,
        ...(currentStatusFilter ? { article: { currentStatus: currentStatusFilter } } : {}),
      };

      const [records, total] = await Promise.all([
        strapi.db.query('api::user-article.user-article').findMany({
          where: baseWhere,
          populate: {
            article: {
              populate: {
                cover: true,
                imageCard: true,
                category: { select: ['id', 'name', 'slug'] },
                main_category: { select: ['id', 'name', 'slug'] },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        strapi.db.query('api::user-article.user-article').count({
          where: baseWhere,
        }),
      ]);

      const articles = records.filter((r) => r.article !== null).map((r) => r.article);

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
      strapi.log.error('[user-article] getMyArticles error:', error);
      return ctx.badRequest('Error al obtener los artículos: ' + error.message);
    }
  },
}));
