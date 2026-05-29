'use strict';

const { errors } = require('@strapi/utils');

const UA_UID = 'api::user-article.user-article';
const EVENT_UID = 'api::user-article-event.user-article-event';

const _previousState = new Map();

function isEmptyRichText(value) {
  if (value == null) return true;
  if (typeof value !== 'string') return false;
  const stripped = value.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
  return stripped.length === 0;
}

// Resolves a relation field that may come as { connect, disconnect } (Content Manager)
// or as a direct { id } / number (programmatic API).
function resolveRelationId(relation, currentId) {
  if (relation === null || relation === undefined) return null;
  if (typeof relation === 'number') return relation;
  if (typeof relation === 'object') {
    if ('connect' in relation) {
      if (relation.disconnect?.length > 0) return null;
      if (relation.connect?.length > 0) return relation.connect[0]?.id ?? null;
      return currentId ?? null; // empty connect + empty disconnect = no change
    }
    return relation.id ?? null;
  }
  return null;
}

async function createEvent(strapi, data) {
  try {
    await strapi.db.query(EVENT_UID).create({ data });
  } catch (err) {
    strapi.log.error('[user-article] failed to create event:', err.message);
  }
}

module.exports = {
  async beforeUpdate(event) {
    const { data, where } = event.params;
    if (!where?.id || !data) return;

    const current = await strapi.db.query(UA_UID).findOne({
      where: { id: where.id },
      select: ['id', 'currentStatus', 'reviewComments'],
      populate: { reviewer: { select: ['id'] } },
    });
    if (!current) return;

    if (data.currentStatus === 'requires-changes' && current.currentStatus !== 'requires-changes') {
      const finalReviewerId = data.reviewer !== undefined
        ? resolveRelationId(data.reviewer, current.reviewer?.id)
        : current.reviewer?.id ?? null;
      const finalComments = data.reviewComments !== undefined
        ? data.reviewComments
        : current.reviewComments;

      if (!finalReviewerId) {
        throw new errors.ApplicationError('Para pasar a "Requiere ajustes" se debe asignar un reviewer.');
      }
      if (isEmptyRichText(finalComments)) {
        throw new errors.ApplicationError('Para pasar a "Requiere ajustes" se deben escribir los comentarios de la revisión.');
      }
    }

    if (data.currentStatus !== undefined
        || data.reviewer !== undefined
        || data.reviewComments !== undefined) {
      _previousState.set(where.id, {
        currentStatus:   current.currentStatus,
        reviewComments:  current.reviewComments,
        reviewerId:      current.reviewer?.id ?? null,
      });
    }
  },

  async afterUpdate(event) {
    const { data, where } = event.params;
    if (!where?.id) return;

    const prev = _previousState.get(where.id);
    _previousState.delete(where.id);
    if (!prev || !data) return;

    const updated = await strapi.db.query(UA_UID).findOne({
      where: { id: where.id },
      select: ['id', 'locale', 'currentStatus', 'reviewComments'],
      populate: { reviewer: { select: ['id'] } },
    });
    if (!updated) return;

    const actorAdminId = strapi.requestContext?.get()?.state?.user?.id ?? null;

    if (data.reviewer !== undefined
        && updated.reviewer?.id
        && updated.reviewer.id !== prev.reviewerId) {
      await createEvent(strapi, {
        type: 'assigned',
        user_article: updated.id,
        actorAdmin: actorAdminId,
        locale: updated.locale,
      });
    }

    if (data.reviewComments !== undefined
        && updated.reviewComments
        && updated.reviewComments !== prev.reviewComments) {
      await createEvent(strapi, {
        type: 'comments-added',
        user_article: updated.id,
        actorAdmin: actorAdminId,
        comment: typeof updated.reviewComments === 'string'
          ? updated.reviewComments.slice(0, 500)
          : null,
        locale: updated.locale,
      });
    }

    if (data.currentStatus !== undefined
        && updated.currentStatus !== prev.currentStatus
        && !(prev.currentStatus === 'draft' && updated.currentStatus === 'in-review')
        && !(prev.currentStatus === 'in-review' && updated.currentStatus === 'draft')) {
      await createEvent(strapi, {
        type: 'status-changed',
        user_article: updated.id,
        actorAdmin: actorAdminId,
        fromStatus: prev.currentStatus,
        toStatus: updated.currentStatus,
        locale: updated.locale,
      });
    }
  },

  async beforeDelete(event) {
    const { where } = event.params;
    if (!where?.id) return;

    await strapi.db.query(EVENT_UID).deleteMany({
      where: { user_article: where.id },
    });
  },
};
