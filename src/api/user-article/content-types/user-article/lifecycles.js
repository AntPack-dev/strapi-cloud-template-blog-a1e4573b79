'use strict';

const UA_UID = 'api::user-article.user-article';
const EVENT_UID = 'api::user-article-event.user-article-event';

const _previousState = new Map();

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

    const tracks = [];
    if (data.currentStatus !== undefined) tracks.push('currentStatus');
    if (data.reviewer !== undefined)      tracks.push('reviewer');
    if (data.reviewComments !== undefined) tracks.push('reviewComments');
    if (tracks.length === 0) return;

    const select = ['id'];
    const populate = {};
    if (tracks.includes('currentStatus'))  select.push('currentStatus');
    if (tracks.includes('reviewComments')) select.push('reviewComments');
    if (tracks.includes('reviewer'))       populate.reviewer = { select: ['id'] };

    const current = await strapi.db.query(UA_UID).findOne({ where: { id: where.id }, select, populate });
    if (current) {
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
