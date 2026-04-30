'use strict';
const bootstrap = require("./bootstrap");

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function syncBannerForPublishedArticle(strapi, articleDocumentId) {
  const today = getTodayUTC();
  strapi.log.info(`[banner-sync] Article published: documentId=${articleDocumentId}, today=${today}`);

  const article = await strapi.documents('api::article.article').findOne({
    documentId: articleDocumentId,
    status: 'published',
    populate: { countries: true },
  });

  if (!article) {
    strapi.log.warn(`[banner-sync] Published article not found: ${articleDocumentId}`);
    return;
  }

  const articleDate = new Date(article.createdAt).toISOString().slice(0, 10);
  strapi.log.info(`[banner-sync] createdAt=${articleDate}, countries=${(article.countries || []).map(c => c.documentId).join(',')}`);

  if (articleDate !== today) {
    strapi.log.info(`[banner-sync] Date mismatch (${articleDate} != ${today}) — skipping`);
    return;
  }

  const countries = article.countries || [];
  if (countries.length === 0) {
    strapi.log.info('[banner-sync] No countries assigned — skipping');
    return;
  }

  for (const country of countries) {
    strapi.log.info(`[banner-sync] Querying banners for country.id=${country.id}`);

    let banners;
    try {
      banners = await strapi.db.query('api::banner.banner').findMany({
        where: { country: country.id },
        populate: { mainArticles: { populate: { articles: true } } },
      });
    } catch (err) {
      strapi.log.error(`[banner-sync] Error querying banners for country ${country.id}:`, err);
      continue;
    }

    strapi.log.info(`[banner-sync] Found ${banners.length} banner(s): ${banners.map(b => `id=${b.id} documentId=${b.documentId}`).join(', ')}`);

    for (const banner of banners) {
      try {
        await updateBannerMainArticles(strapi, banner, articleDocumentId);
      } catch (err) {
        strapi.log.error(`[banner-sync] Error updating banner ${banner.id}:`, err);
      }
    }
  }
}

async function updateBannerMainArticles(strapi, banner, articleDocumentId) {
  const existing = banner.mainArticles?.articles || [];
  const existingDocIds = existing.map(a => a.documentId).filter(Boolean);

  strapi.log.info(`[banner-sync] Banner ${banner.id} (docId=${banner.documentId}): existing=[${existingDocIds.join(', ')}]`);

  if (existingDocIds[0] === articleDocumentId) {
    strapi.log.info('[banner-sync] Article already at position 0 — skipping');
    return;
  }

  const filtered = existingDocIds.filter(id => id !== articleDocumentId);
  const newDocIds = [articleDocumentId, ...filtered].slice(0, 2);

  strapi.log.info(`[banner-sync] Updating via documents API: [${newDocIds.join(', ')}]`);

  // Use strapi.documents() so Strapi v5 correctly handles component creation/update
  await strapi.documents('api::banner.banner').update({
    documentId: banner.documentId,
    data: {
      mainArticles: {
        articles: newDocIds,
      },
    },
  });

  // Verify persistence
  const verify = await strapi.db.query('api::banner.banner').findOne({
    where: { id: banner.id },
    populate: { mainArticles: { populate: { articles: true } } },
  });
  const saved = (verify?.mainArticles?.articles || []).map(a => a.id);
  strapi.log.info(`[banner-sync] Verification — Banner ${banner.id} mainArticles.articles=[${saved.join(', ')}]`);
}

module.exports = {
  register({ strapi }) {
    strapi.documents.use(async (context, next) => {
      const result = await next();

      if (
        context.uid === 'api::article.article' &&
        context.action === 'publish'
      ) {
        const documentId = context.params?.documentId ?? result?.documentId;
        strapi.log.info(`[banner-sync] Publish intercepted — documentId=${documentId}`);
        if (documentId) {
          try {
            await syncBannerForPublishedArticle(strapi, documentId);
          } catch (err) {
            strapi.log.error('[banner-sync] Middleware error:', err);
          }
        }
      }

      return result;
    });
  },
  bootstrap,
};
