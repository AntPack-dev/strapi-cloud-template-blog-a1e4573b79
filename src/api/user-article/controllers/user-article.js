'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const UA_UID = 'api::user-article.user-article';
const EVENT_UID = 'api::user-article-event.user-article-event';

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

// Strapi v5 bug: manyToOne relations (joinColumn) are skipped by the Document
// Service's traverseEntityRelations (see node_modules/@strapi/core/dist/
// services/document-service/transform/relations/utils/map-relation.js line 119).
// Even with i18n on both sides, manyToOne needs the numeric entry id, not the
// documentId, because the documentId -> id resolution never runs for it.
async function resolveEntryId(uid, id, locale) {
  if (id == null) return null;
  const numericId = typeof id === 'number' ? id : (/^\d+$/.test(String(id)) ? Number(id) : null);
  if (numericId != null) {
    const e = await strapi.db.query(uid).findOne({ where: { id: numericId }, select: ['id'] });
    return e?.id ?? null;
  }
  const where = { documentId: String(id) };
  if (locale) where.locale = locale;
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

function getLocale(ctx) {
  return ctx.query.locale || ctx.request.body?.locale || undefined;
}

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

// Same as FULL_POPULATE but without reviewer (admin::user manyToOne — Document Service bug)
const PUBLIC_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName', 'imageUrl'] },
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

const LIST_POPULATE = {
  cover: true,
  imageCard: true,
  userAuthor: { fields: ['id', 'firstName', 'lastName'] },
  main_category: { fields: ['id', 'name', 'slug'] },
};

const EDITABLE_STATUSES = ['draft', 'requires-changes'];
const DELETABLE_STATUSES = ['draft', 'requires-changes', 'in-review', 'approved'];

async function findOwnedEntry(documentId, userId, locale, select = ['id', 'documentId', 'currentStatus', 'locale']) {
  const where = { documentId, userAuthor: userId };
  if (locale) where.locale = locale;
  return strapi.db.query(UA_UID).findOne({ where, select });
}

module.exports = createCoreController(UA_UID, ({ strapi }) => ({

  async createArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión para crear artículos');

    const locale = getLocale(ctx);
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
      if (sub_categories !== undefined)       createData.sub_categories = sub_categories;
      if (countries !== undefined)            createData.countries = countries;
      if (blocks !== undefined)               {
        const content = calcContent(blocks);
        createData.blocks = blocks;
        createData.readingTime = content.readingTime;
        createData.wordCount = content.wordCount;
      }
      if (seo !== undefined)                  createData.seo = seo;
      if (creationDate !== undefined)         createData.creationDate = creationDate;

      const article = await strapi.documents(UA_UID).create({
        data: createData,
        locale,
        populate: FULL_POPULATE,
      });

      if (main_category !== undefined) {
        const mcEntryId = await resolveEntryId('api::main-category.main-category', main_category, article.locale);
        if (mcEntryId) {
          await strapi.db.query(UA_UID).update({
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

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const existing = await findOwnedEntry(documentId, userId, locale);
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
    if (sub_categories !== undefined)       updateData.sub_categories = sub_categories;
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
      const updated = await strapi.documents(UA_UID).update({
        documentId,
        locale,
        data: updateData,
        populate: FULL_POPULATE,
      });

      if (main_category !== undefined) {
        const mcEntryId = await resolveEntryId('api::main-category.main-category', main_category, existing.locale);
        await strapi.db.query(UA_UID).update({
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

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const existing = await findOwnedEntry(
      documentId, userId, locale,
      ['id', 'documentId', 'currentStatus', 'title', 'locale'],
    );
    if (!existing) return ctx.forbidden('No tenés permiso para enviar este artículo');
    if (!EDITABLE_STATUSES.includes(existing.currentStatus)) {
      return ctx.forbidden(`El artículo ya está en estado "${existing.currentStatus}"`);
    }
    if (!existing.title) {
      return ctx.badRequest('El artículo necesita título antes de enviarse a revisión');
    }

    try {
      const updated = await strapi.documents(UA_UID).update({
        documentId,
        locale,
        data: { currentStatus: 'in-review' },
        populate: LIST_POPULATE,
      });

      await strapi.db.query(EVENT_UID).create({
        data: {
          type: 'submitted',
          user_article: existing.id,
          actorUser: userId,
          fromStatus: existing.currentStatus,
          toStatus: 'in-review',
          locale: existing.locale,
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

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const existing = await findOwnedEntry(
      documentId, userId, locale,
      ['id', 'documentId', 'currentStatus', 'locale'],
    );
    if (!existing) return ctx.forbidden('No tenés permiso sobre este artículo');
    if (existing.currentStatus !== 'in-review') {
      return ctx.badRequest('Solo se puede retirar un artículo que está en revisión');
    }

    try {
      const updated = await strapi.documents(UA_UID).update({
        documentId,
        locale,
        data: { currentStatus: 'draft' },
        populate: LIST_POPULATE,
      });

      await strapi.db.query(EVENT_UID).create({
        data: {
          type: 'withdrawn',
          user_article: existing.id,
          actorUser: userId,
          fromStatus: 'in-review',
          toStatus: 'draft',
          locale: existing.locale,
        },
      });

      await attachMainCategory(updated);
      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] withdrawFromReview error:', error);
      return ctx.badRequest('Error al retirar la revisión: ' + error.message);
    }
  },

  async unpublishArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const existing = await findOwnedEntry(documentId, userId, locale);
    if (!existing) return ctx.forbidden('No tenés permiso sobre este artículo');
    if (existing.currentStatus !== 'approved') {
      return ctx.badRequest('Solo se puede despublicar un artículo en estado "approved"');
    }

    try {
      const updated = await strapi.documents(UA_UID).update({
        documentId,
        locale,
        data: { currentStatus: 'draft' },
        populate: LIST_POPULATE,
      });

      await strapi.db.query(EVENT_UID).create({
        data: {
          type: 'status-changed',
          user_article: existing.id,
          actorUser: userId,
          fromStatus: 'approved',
          toStatus: 'draft',
          locale: existing.locale,
        },
      });

      await attachMainCategory(updated);
      return ctx.send({ data: updated });
    } catch (error) {
      strapi.log.error('[user-article] unpublishArticle error:', error);
      return ctx.badRequest('Error al despublicar el artículo: ' + error.message);
    }
  },

  async deleteArticle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const existing = await findOwnedEntry(documentId, userId, locale);
    if (!existing) return ctx.forbidden('No tenés permiso sobre este artículo');
    if (!DELETABLE_STATUSES.includes(existing.currentStatus)) {
      return ctx.forbidden(`No se puede eliminar un artículo en estado "${existing.currentStatus}"`);
    }

    try {
      await strapi.documents(UA_UID).delete({
        documentId,
        locale,
      });

      return ctx.send({ data: { message: 'Historia eliminada correctamente' } });
    } catch (error) {
      strapi.log.error('[user-article] deleteArticle error:', error);
      return ctx.badRequest('Error al eliminar el artículo: ' + error.message);
    }
  },

  async getMyArticle(ctx) {
    const userId = ctx.state.user?.id;
    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    // Public access: only approved articles are visible without auth
    if (!userId) {
      try {
        const article = await strapi.documents(UA_UID).findOne({
          documentId,
          locale,
          populate: PUBLIC_POPULATE,
        });
        if (!article || article.currentStatus !== 'approved') {
          return ctx.notFound('Artículo no encontrado');
        }
        await attachMainCategory(article);
        return ctx.send({ data: article });
      } catch (error) {
        strapi.log.error('[user-article] getMyArticle (public) error:', error);
        return ctx.badRequest('Error al obtener el artículo: ' + error.message);
      }
    }

    const check = await findOwnedEntry(documentId, userId, locale, ['id', 'documentId']);
    if (!check) return ctx.forbidden('No tenés permiso para ver este artículo');

    try {
      const article = await strapi.documents(UA_UID).findOne({
        documentId,
        locale,
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

  async getMyArticleEvents(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión');

    const { documentId } = ctx.params;
    const locale = getLocale(ctx);

    const check = await findOwnedEntry(documentId, userId, locale, ['id', 'documentId', 'locale']);
    if (!check) return ctx.forbidden('No tenés permiso para ver este historial');

    try {
      const events = await strapi.db.query(EVENT_UID).findMany({
        where: { user_article: check.id },
        orderBy: { createdAt: 'asc' },
        populate: {
          actorAdmin: { select: ['id', 'firstname', 'lastname'] },
          actorUser:  { select: ['id', 'firstName', 'lastName'] },
        },
      });

      return ctx.send({ data: events });
    } catch (error) {
      strapi.log.error('[user-article] getMyArticleEvents error:', error);
      return ctx.badRequest('Error al obtener el historial: ' + error.message);
    }
  },

  async findApproved(ctx) {
    const locale = getLocale(ctx);
    const page     = Math.max(1, parseInt(ctx.query.page     ?? 1,  10));
    const pageSize = Math.min(50, Math.max(1, parseInt(ctx.query.pageSize ?? 10, 10)));
    const mainCategorySlug = ctx.query.filters?.main_category?.slug?.$eq;

    const where = {
      currentStatus: 'approved',
      ...(locale ? { locale } : {}),
      ...(mainCategorySlug ? { main_category: { slug: mainCategorySlug } } : {}),
    };

    try {
      const [records, total] = await Promise.all([
        strapi.db.query(UA_UID).findMany({
          where,
          populate: {
            cover: true,
            imageCard: true,
            userAuthor: { select: ['id', 'firstName', 'lastName', 'imageUrl'] },
            main_category: { select: ['id', 'documentId', 'name', 'slug', 'backgroundColor'] },
            countries: { select: ['id', 'name', 'slug'] },
          },
          orderBy: { createdAt: 'desc' },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        strapi.db.query(UA_UID).count({ where }),
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
      strapi.log.error('[user-article] findApproved error:', error);
      return ctx.badRequest('Error al obtener los artículos: ' + error.message);
    }
  },

  async getMyArticles(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Debes iniciar sesión para ver tus artículos');

    const locale = getLocale(ctx);
    const page     = Math.max(1, parseInt(ctx.query.page ?? 1, 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(ctx.query.pageSize ?? 10, 10)));
    const currentStatusFilter = ctx.query.currentStatus;

    const validStatuses = ['draft', 'in-review', 'requires-changes', 'approved'];
    if (currentStatusFilter && !validStatuses.includes(currentStatusFilter)) {
      return ctx.badRequest('Valor de currentStatus inválido');
    }

    const where = {
      userAuthor: userId,
      ...(locale ? { locale } : {}),
      ...(currentStatusFilter ? { currentStatus: currentStatusFilter } : {}),
    };

    try {
      const [records, total] = await Promise.all([
        strapi.db.query(UA_UID).findMany({
          where,
          populate: {
            cover: true,
            imageCard: true,
            userAuthor: { select: ['id', 'firstName', 'lastName', 'imageUrl'] },
            main_category: { select: ['id', 'documentId', 'name', 'slug', 'backgroundColor'] },
            countries: { select: ['id', 'name', 'slug'] },
          },
          orderBy: { createdAt: 'desc' },
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
        strapi.db.query(UA_UID).count({ where }),
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
