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
  },

  // Método para eliminar una lista de favoritos completa
  async deleteFavoriteList(listId, userId) {
    try {
      // Verificar que la lista existe y pertenece al usuario
      const favoriteList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: {
          id: listId,
          user: { id: userId }
        }
      });

      if (!favoriteList) {
        throw new Error('Favorite list not found or does not belong to user');
      }

      // No permitir eliminar la lista por defecto
      if (favoriteList.isDefault) {
        throw new Error('Cannot delete default favorite list');
      }

      // Eliminar la lista (Strapi manejará automáticamente las relaciones)
      await strapi.db.query('api::favorite-list.favorite-list').delete({
        where: { id: listId }
      });

      return {
        success: true,
        message: 'Favorite list deleted successfully',
        deletedListId: listId
      };

    } catch (error) {
      strapi.log.error('Error deleting favorite list:', error);
      throw error;
    }
  }
}));
