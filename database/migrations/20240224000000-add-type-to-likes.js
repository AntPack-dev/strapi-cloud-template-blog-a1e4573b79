'use strict';

module.exports = {
  async up(knex) {
    // Verificar si la tabla existe primero
    const hasTable = await knex.schema.hasTable('likes');
    
    if (!hasTable) {
      console.log('Table "likes" does not exist yet, skipping migration (will be created by Strapi)');
      return;
    }

    const hasColumn = await knex.schema.hasColumn('likes', 'type');
    
    if (hasColumn) {
      console.log('Column "type" already exists, skipping migration');
      return;
    }

    await knex.schema.alterTable('likes', (table) => {
      table.string('type').notNullable().defaultTo('me_gusta');
    });

    // Update existing records to have the default value
    await knex('likes').update({ type: 'me_gusta' });

    console.log('Migration completed: Added type field to likes table');
  },

  async down(knex) {
    const hasColumn = await knex.schema.hasColumn('likes', 'type');
    
    if (!hasColumn) {
      console.log('Column "type" does not exist, skipping rollback');
      return;
    }

    await knex.schema.alterTable('likes', (table) => {
      table.dropColumn('type');
    });

    console.log('Rollback completed: Removed type field from likes table');
  }
};
