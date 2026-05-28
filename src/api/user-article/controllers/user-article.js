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

async function toRelation(uid, id) {
  if (id == null) return id;
  const numericId = typeof id === 'number' ? id : (/^\d+$/.test(String(id)) ? Number(id) : null);
  const where = numericId != null ? { id: numericId } : { documentId: String(id) };
  const e = await strapi.db.query(uid).findOne({ where, select: ['documentId', 'locale'] });
  if (!e) return id;
  return e.locale ? { documentId: e.documentId, locale: e.locale } : e.documentId;
}

async function toRelations(uid, ids) {
  if (!Array.isArray(ids)) return ids;
  return Promise.all(ids.map(id => toRelation(uid, id)));
}

// Strapi v5 has a bug: manyToOne relations across non-i18n -> i18n content types
// can't be written OR populated via Document Service (traverseEntityRelations skips
// joinColumn relations — see node_modules/@strapi/core/dist/services/document-service/
// transform/relations/utils/map-relation.js line 119). We bypass it with db.query.
async function resolveEntryId(uid, id) {
  if (id == null) return null;
  const numericId = typeof id === 'number' ? id : (/^\d+$/.test(String(id)) ? Number(id) : null);
  const where = numericId != null ? { id: numericId } : { documentId: String(id) };
  const e = await strapi.db.query(uid).findOne({ where, select: ['id'] });
  return e?.id ?? null;
}

async function attachMainCategory(article) {
  if (!article?.id) return article;
  const row = await strapi.db.query('api::user-article.user-article').findOne({
    where: { id: article.id },
    populate: {
      main_category: { select: ['id', 'documentId', 'name', 'slug', 'backgroundColor'] },
    },
  });
  article.main_category = row?.main_category ?? null;
  return article;
}

async function attachMainCategoryList(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return articles;
  const ids = articles.map(a => a.id).filter(Boolean);
  const rows = await strapi.db.query('api::user-article.user-article').findMany({
    where: { id: { $in: ids } },
    select: ['id'],
    populate: {
      main_category: { select: ['id', 'documentId', 'name', 'slug', 'backgroundColor'] },
    },
  });
  const map = new Map(rows.map(r => [r.id, r.main_category ?? null]));
  for (const a of articles) a.main_category = map.get(a.id) ?? null;
  return articles;
}

function calcContent(blocks = []) {
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
  return { wordCount: words, readingTime: Math.max(1, Math.ceil(words / 200)) };
}

// Full populate for single-article views (edit / preview)
const FULL_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName', 'imageUrl'] },
  reviewer: { fields: ['id', 'firstname', 'lastname'] },
  main_category: { fields: ['id', 'name', 'slug', 'backgroundColor'] },
  sub_categories: { fields: ['id', 'name', 'slug', 'description'] },
  countries: { fields: ['id', 'name', 'slug'] },
  blocks: {
    on: {
      'shared.rich-text': true,
      'shared.subtitle': true,
      'shared.media': { populate: { file: true } },
      'shared.user-quote': true,
    },
  },
  seo: true,
};

// Light populate for list views (no blocks)
const LIST_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName'] },
  main_category: { fields: ['id', 'name', 'slug'] },
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
      main_category, sub_categories,
      countries, blocks, seo, creationDate,
    } = body;

    if (!title) return ctx.badRequest('El campo title es requerido');
    if (!cover)  return ctx.badRequest('El campo cover es requerido');

    try {
      const { wordCount, readingTime } = calcContent(blocks);
      const createData = {
        title,
        slug: slugify(title),
        cover,
        imageCard: cover,
        readingTime,
        wordCount,
        userAuthor: userId,
        currentStatus: 'draft',
      };
      if (description !== undefined)         createData.description = description;
      if (sub_categories !== undefined)       createData.sub_categories = await toRelations('api::user-sub-category.user-sub-category', sub_categories);
      if (countries !== undefined)            createData.countries = countries;
      if (blocks !== undefined)               {
        const content = calcContent(blocks);
        createData.blocks = blocks;
        createData.readingTime = content.readingTime;
        createData.wordCount = content.wordCount;
      }
      if (seo !== undefined)                  createData.seo = seo;
      if (creationDate !== undefined)         createData.creationDate = creationDate;

      const article = await strapi.documents('api::user-article.user-article').create({
        data: createData,
        populate: FULL_POPULATE,
      });

      if (main_category !== undefined) {
        const mcEntryId = await resolveEntryId('api::main-category.main-category', main_category);
        if (mcEntryId) {
          await strapi.db.query('api::user-article.user-article').update({
            where: { id: article.id },
            data: { main_category: mcEntryId },
          });
        }
      }

      await attachMainCategory(article);
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
      main_category, sub_categories,
      countries, blocks, seo, creationDate,
    } = body;

    const updateData = {};
    if (title !== undefined)                { updateData.title = title; updateData.slug = slugify(title); }
    if (description !== undefined)          updateData.description = description;
    if (cover !== undefined)                { updateData.cover = cover; updateData.imageCard = cover; }
    if (sub_categories !== undefined)       updateData.sub_categories = await toRelations('api::user-sub-category.user-sub-category', sub_categories);
    if (countries !== undefined)            updateData.countries = countries;
    if (seo !== undefined)                  updateData.seo = seo;
    if (creationDate !== undefined)         updateData.creationDate = creationDate;
    if (blocks !== undefined)               {
      const content = calcContent(blocks);
      updateData.blocks = blocks;
      updateData.readingTime = content.readingTime;
      updateData.wordCount = content.wordCount;
    }

    try {
      const updated = await strapi.documents('api::user-article.user-article').update({
        documentId: existing.documentId,
        data: updateData,
        populate: FULL_POPULATE,
      });

      if (main_category !== undefined) {
        const mcEntryId = await resolveEntryId('api::main-category.main-category', main_category);
        await strapi.db.query('api::user-article.user-article').update({
          where: { id: existing.id },
          data: { main_category: mcEntryId },
        });
      }

      await attachMainCategory(updated);
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
        data: { currentStatus: 'in-review' },
        populate: LIST_POPULATE,
      });

      await strapi.db.query('api::user-article-event.user-article-event').create({
        data: {
          type: 'submitted',
          user_article: existing.id,
          actorUser: userId,
          fromStatus: existing.currentStatus,
          toStatus: 'in-review',
        },
      });

      await attachMainCategory(updated);
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

      await strapi.db.query('api::user-article-event.user-article-event').create({
        data: {
          type: 'withdrawn',
          user_article: existing.id,
          actorUser: userId,
          fromStatus: 'in-review',
          toStatus: 'draft',
        },
      });

      await attachMainCategory(updated);
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
      await attachMainCategory(article);
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
