'use strict';

module.exports = {
  async up(knex) {
    // Verificar si la tabla existe primero
    const hasTable = await knex.schema.hasTable('likes');
    
    if (!hasTable) {
      console.log('Table "likes" does not exist yet, skipping migration');
      return;
    }

    const hasTypeColumn = await knex.schema.hasColumn('likes', 'type');
    const hasTypeIdColumn = await knex.schema.hasColumn('likes', 'type_id');
    
    if (!hasTypeColumn || hasTypeIdColumn) {
      console.log('Migration not needed: type column does not exist or type_id already exists');
      return;
    }

    // Agregar columna type_id
    await knex.schema.alterTable('likes', (table) => {
      table.integer('type_id').unsigned().references('id').inTable('likes_types').defaultTo(1);
    });

    // Migrar datos existentes
    // 'me_gusta' -> type_id = 1 (like)
    // 'me_interesa' -> type_id = 2 (interested)
    await knex.raw(`
      UPDATE likes 
      SET type_id = CASE 
        WHEN type = 'me_gusta' THEN 1
        WHEN type = 'me_interesa' THEN 2
        ELSE 1
      END
    `);

    // Hacer type_id NOT NULL después de la migración
    await knex.schema.alterTable('likes', (table) => {
      table.integer('type_id').notNullable().alter();
    });

    // Eliminar columna type antigua
    await knex.schema.alterTable('likes', (table) => {
      table.dropColumn('type');
    });

    console.log('Migration completed: Updated likes table to use type_id');
  },

  async down(knex) {
    const hasTypeColumn = await knex.schema.hasColumn('likes', 'type');
    const hasTypeIdColumn = await knex.schema.hasColumn('likes', 'type_id');
    
    if (hasTypeColumn || !hasTypeIdColumn) {
      console.log('Rollback not needed: type column already exists or type_id does not exist');
      return;
    }

    // Agregar columna type temporal
    await knex.schema.alterTable('likes', (table) => {
      table.string('type').defaultTo('me_gusta');
    });

    // Migrar datos de vuelta
    await knex.raw(`
      UPDATE likes 
      SET type = CASE 
        WHEN type_id = 1 THEN 'me_gusta'
        WHEN type_id = 2 THEN 'me_interesa'
        ELSE 'me_gusta'
      END
    `);

    // Hacer type NOT NULL
    await knex.schema.alterTable('likes', (table) => {
      table.string('type').notNullable().alter();
    });

    // Eliminar type_id
    await knex.schema.alterTable('likes', (table) => {
      table.dropColumn('type_id');
    });

    console.log('Rollback completed: Reverted likes table to use type');
  }
};
