'use strict';

module.exports = {
  async up(knex) {
    const hasTable = await knex.schema.hasTable('likes_types');
    
    if (hasTable) {
      console.log('Table likes_types already exists, skipping migration');
      return;
    }

    await knex.schema.createTable('likes_types', (table) => {
      table.increments('id').primary();
      table.string('code').notNullable().unique();
      table.string('name').notNullable();
      table.string('display_name').notNullable();
      table.string('icon').nullable();
      table.string('color').nullable();
      table.boolean('active').defaultTo(true);
      table.timestamps(true, true);
    });

    // Insertar tipos de interacción base
    await knex('likes_types').insert([
      {
        code: 'like',
        name: 'like',
        display_name: 'Me gusta',
        icon: '❤️',
        color: '#e74c3c',
        active: true
      },
      {
        code: 'interested',
        name: 'interested',
        display_name: 'Me interesa',
        icon: '⭐',
        color: '#f39c12',
        active: true
      }
    ]);

    console.log('Migration completed: Created likes_types table');
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable('likes_types');
    
    if (!hasTable) {
      console.log('Table likes_types does not exist, skipping rollback');
      return;
    }

    await knex.schema.dropTable('likes_types');
    console.log('Rollback completed: Dropped likes_types table');
  }
};
