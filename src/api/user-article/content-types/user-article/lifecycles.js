'use strict';

module.exports = {
  async beforeUpdate(event) {
    const { data, where } = event.params;
    if (!where?.id) return;

    const current = await strapi.db.query('api::user-article.user-article').findOne({
      where: { id: where.id },
      select: ['currentStatus', 'reviewer'],
    });

    if (!current) return;

    const now = new Date().toISOString();

    // Auto-set assignedAt the first time a reviewer is assigned
    if (data.reviewer !== undefined && data.reviewer !== null && !current.reviewer) {
      data.assignedAt = now;
    }

    // Auto-update reviewUpdatedAt on any change while in-review
    // (captures "Revisión en curso — Actualización hace X" in the UI)
    if (current.currentStatus === 'in-review' && !data.currentStatus) {
      data.reviewUpdatedAt = now;
    }

    // If admin manually sets in-review without going through the submit endpoint
    if (data.currentStatus === 'in-review' && current.currentStatus !== 'in-review') {
      if (!data.submittedAt) data.submittedAt = now;
    }
  },
};
