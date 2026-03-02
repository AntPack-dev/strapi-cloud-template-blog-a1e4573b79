'use strict';

module.exports = {
  /**
   * Create default favorite list for a new user
   */
  async createDefaultFavoriteList(userId) {
    try {
      // Generate unique document_id
      const crypto = require('crypto');
      const documentId = crypto.randomBytes(13).toString('base64url').substring(0, 25);

      // Create the list with SQL raw
      const result = await strapi.db.connection.raw(`
        INSERT INTO favorite_lists (document_id, name, description, is_default, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())
        RETURNING id
      `, [documentId, 'Favorites', 'My favorite articles', true]);

      const listId = result.rows[0].id;

      // Insert user relationship directly in links table
      await strapi.db.connection.raw(`
        INSERT INTO favorite_lists_user_lnk (favorite_list_id, user_id)
        VALUES (?, ?)
      `, [listId, userId]);

      // Get the created list
      const newList = await strapi.db.query('api::favorite-list.favorite-list').findOne({
        where: { id: listId },
        populate: ['articles']
      });

      strapi.log.info(`Default favorite list created for user ${userId}`);
      return newList;

    } catch (error) {
      strapi.log.error('Error creating default favorite list:', error);
      throw error;
    }
  }
};
