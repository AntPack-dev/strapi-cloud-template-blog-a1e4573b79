'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const UA_UID = 'api::user-article.user-article';
const EVENT_UID = 'api::user-article-event.user-article-event';

function parseSortToOrderBy(sort) {
  if (!sort) return [{ createdAt: 'asc' }];
  const str = Array.isArray(sort) ? sort[0] : sort;
  const [field, dir = 'asc'] = str.split(':');
  return [{ [field]: dir.toLowerCase() }];
}

function buildDbPopulate(populate) {
  if (!populate || typeof populate !== 'object') return {};
  const result = {};
  if (populate.actorAdmin) {
    const fields = populate.actorAdmin.fields;
    result.actorAdmin = fields?.length ? { select: fields } : true;
  }
  if (populate.actorUser) {
    const fields = populate.actorUser.fields;
    result.actorUser = fields?.length ? { select: fields } : true;
  }
  return result;
}

module.exports = createCoreController(EVENT_UID, ({ strapi }) => ({
  async find(ctx) {
    const { filters = {}, sort, populate } = ctx.query;

    const articleDocumentId = filters?.user_article?.documentId?.$eq;
    if (!articleDocumentId) {
      return super.find(ctx);
    }

    // Resolve documentId → numeric ids (Document Service manyToOne is broken in Strapi v5)
    const articles = await strapi.db.query(UA_UID).findMany({
      where: { documentId: articleDocumentId },
      select: ['id'],
    });

    if (articles.length === 0) {
      return ctx.send({ data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } });
    }

    const articleIds = articles.map((a) => a.id);

    const events = await strapi.db.query(EVENT_UID).findMany({
      where: { user_article: { $in: articleIds } },
      orderBy: parseSortToOrderBy(sort),
      populate: buildDbPopulate(populate),
    });

    const data = events.map((e) => ({
      id: e.id,
      documentId: e.documentId,
      type: e.type,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      comment: e.comment ?? null,
      locale: e.locale ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      actorAdmin: e.actorAdmin ?? null,
      actorUser: e.actorUser ?? null,
    }));

    return ctx.send({
      data,
      meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
    });
  },
}));
