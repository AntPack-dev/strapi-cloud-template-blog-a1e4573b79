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
    }
  }
  return Math.max(1, Math.ceil(words / 200));
}

// Full populate for single-article views (edit / preview)
const FULL_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName', 'imageUrl'] },
  reviewer: { fields: ['id', 'firstName', 'lastName', 'username'] },
  users_main_category: { fields: ['id', 'name', 'slug', 'backgroundColor'] },
  category: { fields: ['id', 'name', 'slug'] },
  sub_categories: { fields: ['id', 'name', 'slug'] },
  countries: { fields: ['id', 'name', 'code'] },
  blocks: {
    on: {
      'shared.media': { populate: { file: true } },
    },
  },
  seo: true,
};

// Light populate for list views (no blocks)
const LIST_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName'] },
  users_main_category: { fields: ['id', 'name', 'slug'] },
  category: { fields: ['id', 'name', 'slug'] },
};

const EDITABLE_STATUSES = ['draft', 'requires-changes'];
const DELETABLE_STATUSES = ['draft', 'requires-changes'];

module.exports = createCoreController('api::user-article.user-article', ({ strapi }) => ({

  async createArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión para crear artículos');

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const {
      title, description, cover,
      users_main_category, category, sub_categories,
      countries, blocks, seo, creationDate,
    } = body;

    if (!title) return ctx.badRequest('El campo title es requerido');
    if (!cover)  return ctx.badRequest('El campo cover es requerido');

    try {
      const createData = {
        title,
        slug: slugify(title),
        cover,
        imageCard: cover,
        readingTime: calcReadingTime(blocks),
        userAuthor: userId,
        currentStatus: 'draft',
      };
      if (description !== undefined)         createData.description = description;
      if (users_main_category !== undefined)  createData.users_main_category = users_main_category;
      if (category !== undefined)             createData.category = category;
      if (sub_categories !== undefined)       createData.sub_categories = sub_categories;
      if (countries !== undefined)            createData.countries = countries;
      if (blocks !== undefined)               { createData.blocks = blocks; createData.readingTime = calcReadingTime(blocks); }
      if (seo !== undefined)                  createData.seo = seo;
      if (creationDate !== undefined)         createData.creationDate = creationDate;

      const article = await strapi.documents('api::user-article.user-article').create({
        data: createData,
        populate: FULL_POPULATE,
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

    const existing = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id, userAuthor: userId },
      select: ['id', 'documentId', 'currentStatus'],
    });

    if (!existing) return ctx.forbidden('No tenés permiso para editar este artículo');
    if (!EDITABLE_STATUSES.includes(existing.currentStatus)) {
      return ctx.forbidden(`No se puede editar un artículo en estado "${existing.currentStatus}"`);
    }

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const {
      title, description, cover,
      users_main_category, category, sub_categories,
      countries, blocks, seo, creationDate,
    } = body;

    const updateData = {};
    if (title !== undefined)                { updateData.title = title; updateData.slug = slugify(title); }
    if (description !== undefined)          updateData.description = description;
    if (cover !== undefined)                { updateData.cover = cover; updateData.imageCard = cover; }
    if (users_main_category !== undefined)  updateData.users_main_category = users_main_category;
    if (category !== undefined)             updateData.category = category;
    if (sub_categories !== undefined)       updateData.sub_categories = sub_categories;
    if (countries !== undefined)            updateData.countries = countries;
    if (seo !== undefined)                  updateData.seo = seo;
    if (creationDate !== undefined)         updateData.creationDate = creationDate;
    if (blocks !== undefined)               { updateData.blocks = blocks; updateData.readingTime = calcReadingTime(blocks); }

    try {
      const updated = await strapi.documents('api::user-article.user-article').update({
        documentId: existing.documentId,
        data: updateData,
        populate: FULL_POPULATE,
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

    const existing = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id, userAuthor: userId },
      select: ['id', 'documentId', 'currentStatus', 'title'],
      populate: { cover: true },
    });

    if (!existing) return ctx.forbidden('No tenés permiso para enviar este artículo');
    if (!EDITABLE_STATUSES.includes(existing.currentStatus)) {
      return ctx.forbidden(`El artículo ya está en estado "${existing.currentStatus}"`);
    }
    if (!existing.title || !existing.cover) {
      return ctx.badRequest('El artículo necesita título y portada antes de enviarse a revisión');
    }

    try {
      const updated = await strapi.documents('api::user-article.user-article').update({
        documentId: existing.documentId,
        data: {
          currentStatus: 'in-review',
          submittedAt: new Date().toISOString(),
        },
        populate: LIST_POPULATE,
      });

      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] submitForReview error:', error);
      return ctx.badRequest('Error al enviar a revisión: ' + error.message);
    }
  },

  async withdrawFromReview(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const existing = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id, userAuthor: userId },
      select: ['id', 'documentId', 'currentStatus'],
    });

    if (!existing) return ctx.forbidden('No tenés permiso sobre este artículo');
    if (existing.currentStatus !== 'in-review') {
      return ctx.badRequest('Solo se puede retirar un artículo que está en revisión');
    }

    try {
      const updated = await strapi.documents('api::user-article.user-article').update({
        documentId: existing.documentId,
        data: { currentStatus: 'draft' },
        populate: LIST_POPULATE,
      });

      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] withdrawFromReview error:', error);
      return ctx.badRequest('Error al retirar la revisión: ' + error.message);
    }
  },

  async deleteArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const existing = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id, userAuthor: userId },
      select: ['id', 'documentId', 'currentStatus'],
    });

    if (!existing) return ctx.forbidden('No tenés permiso sobre este artículo');
    if (!DELETABLE_STATUSES.includes(existing.currentStatus)) {
      return ctx.forbidden(`No se puede eliminar un artículo en estado "${existing.currentStatus}"`);
    }

    try {
      await strapi.documents('api::user-article.user-article').delete({
        documentId: existing.documentId,
      });

      return ctx.send({ data: { message: 'Historia eliminada correctamente' } });
    } catch (error) {
      strapi.log.error('[user-article] deleteArticle error:', error);
      return ctx.badRequest('Error al eliminar el artículo: ' + error.message);
    }
  },

  async getMyArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { id } = ctx.params;

    const check = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id, userAuthor: userId },
      select: ['id', 'documentId'],
    });

    if (!check) return ctx.forbidden('No tenés permiso para ver este artículo');

    try {
      const article = await strapi.documents('api::user-article.user-article').findOne({
        documentId: check.documentId,
        populate: FULL_POPULATE,
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

    const validStatuses = ['draft', 'in-review', 'requires-changes', 'approved'];
    if (currentStatusFilter && !validStatuses.includes(currentStatusFilter)) {
      return ctx.badRequest('Valor de currentStatus inválido');
    }

    const where = {
      userAuthor: userId,
      ...(currentStatusFilter ? { currentStatus: currentStatusFilter } : {}),
    };

    try {
      const [records, total] = await Promise.all([
        strapi.db.query('api::user-article.user-article').findMany({
          where,
          populate: LIST_POPULATE,
          orderBy: { createdAt: 'desc' },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        strapi.db.query('api::user-article.user-article').count({ where }),
      ]);

      return ctx.send({
        data: records,
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
