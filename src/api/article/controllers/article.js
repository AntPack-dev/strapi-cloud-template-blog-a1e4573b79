'use strict';

/**
 *  article controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async randomizeFeatured(ctx) {
    try {
      console.log('=== INICIANDO RANDOMIZE FEATURED ===');

      const publishedArticles = await strapi.db.query('api::article.article').findMany({
        where: {
          publishedAt: { $notNull: true },
          currentStatus: 'approved',
        },
        populate: { main_category: true },
        select: ['id', 'documentId', 'locale', 'title', 'isFeatured'],
      });

      console.log(`Artículos publicados encontrados: ${publishedArticles.length}`);

      const byMainCategory = {};
      const seenDocumentIds = new Set();

      for (const article of publishedArticles) {
        if (!article.main_category) continue;
        const catId = article.main_category.id;
        const docId = article.documentId;

        if (seenDocumentIds.has(docId)) continue;
        seenDocumentIds.add(docId);

        if (!byMainCategory[catId]) byMainCategory[catId] = [];
        byMainCategory[catId].push(docId);
      }

      console.log(`Categorías encontradas: ${Object.keys(byMainCategory).length}`);

      const selectedDocumentIds = new Set();
      for (const docIds of Object.values(byMainCategory)) {
        const shuffled = [...docIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        shuffled.slice(0, 3).forEach(id => selectedDocumentIds.add(id));
      }

      console.log(`DocumentIds seleccionados: ${[...selectedDocumentIds]}`);

      const allLocales = await strapi.plugins.i18n.services.locales.find();
      console.log(`Locales encontrados: ${allLocales.map(l => l.code)}`);

      for (const locale of allLocales) {
        await strapi.db.query('api::article.article').updateMany({
          where: { locale: locale.code },
          data: { isFeatured: false },
        });
      }

      if (selectedDocumentIds.size > 0) {
        for (const locale of allLocales) {
          await strapi.db.query('api::article.article').updateMany({
            where: {
              documentId: { $in: [...selectedDocumentIds] },
              locale: locale.code,
            },
            data: { isFeatured: true },
          });
        }
      }

      const finalCheck = await strapi.db.query('api::article.article').findMany({
        where: {
          isFeatured: true,
          publishedAt: { $notNull: true },
        },
        select: ['id', 'documentId', 'locale', 'title', 'isFeatured'],
      });

      return ctx.send({
        success: true,
        message: 'Featured articles randomized successfully',
        data: {
          totalFeatured: selectedDocumentIds.size,
          categoriesProcessed: Object.keys(byMainCategory).length,
          featuredDocumentIds: [...selectedDocumentIds],
          localesProcessed: allLocales.length,
          debugInfo: {
            totalArticles: publishedArticles.length,
            finalFeaturedCount: finalCheck.length,
            featuredArticles: finalCheck.map(a => ({id: a.id, docId: a.documentId, locale: a.locale, title: a.title}))
          }
        },
      });
    } catch (error) {
      console.error('Error randomizing featured articles:', error);
      return ctx.internalServerError('Error randomizing featured articles');
    }
  },
}));
