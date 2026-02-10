'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::favorite-list.favorite-list', ({ strapi }) => ({
  // Método para verificar si un artículo está en favoritos de un usuario
  async isArticleInUserFavorites(userId, articleId) {
    const favoriteLists = await strapi.db.query('api::favorite-list.favorite-list').findMany({
      where: {
        user: { id: userId },
        articles: { id: articleId }
      }
    });

    return favoriteLists.length > 0;
  },

  // Método para obtener todas las listas de un usuario con conteo de artículos
  async getUserListsWithCount(userId) {
    const lists = await strapi.db.query('api::favorite-list.favorite-list').findMany({
      where: {
        user: { id: userId }
      },
      populate: {
        articles: {
          select: ['id']
        }
      },
      orderBy: { isDefault: 'desc', createdAt: 'desc' }
    });

    return lists.map(list => ({
      ...list,
      articlesCount: list.articles ? list.articles.length : 0
    }));
  },

  // Método para añadir artículo a lista específica
  async addArticleToList(listId, articleId) {
    return await strapi.db.query('api::favorite-list.favorite-list').update({
      where: { id: listId },
      data: {
        articles: {
          connect: [articleId]
        }
      },
      populate: ['articles']
    });
  },

  // Método para remover artículo de lista específica
  async removeArticleFromList(listId, articleId) {
    return await strapi.db.query('api::favorite-list.favorite-list').update({
      where: { id: listId },
      data: {
        articles: {
          disconnect: [articleId]
        }
      },
      populate: ['articles']
    });
  }
}));
