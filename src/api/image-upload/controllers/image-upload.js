'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Cached folder id — resolved once per process lifetime
let _userArticlesFolderId = null;

async function getOrCreateUserArticlesFolder() {
  if (_userArticlesFolderId) return _userArticlesFolderId;

  const existing = await strapi.db.query('plugin::upload.folder').findOne({
    where: { name: 'user-articles', parent: null },
    select: ['id'],
  });

  if (existing) {
    _userArticlesFolderId = existing.id;
    return _userArticlesFolderId;
  }

  const created = await strapi.plugin('upload').service('folder').create({
    name: 'user-articles',
    parent: null,
  });

  _userArticlesFolderId = created.id;
  return _userArticlesFolderId;
}

module.exports = createCoreController('api::image-upload.image-upload', ({ strapi }) => ({
  // Métodos por defecto requeridos por Strapi
  async find(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  },

  async findOne(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  },

  async create(ctx) {
    // Verificar autenticación
    if (!ctx.state.user) {
      return ctx.unauthorized('Usuario no autenticado');
    }
    
    try {
      // Verificar si hay archivos en la petición
      if (!ctx.request.files || !ctx.request.files.file) {
        return ctx.badRequest('No se encontró ningún archivo para subir');
      }

      const file = ctx.request.files.file;
      
      // Validar tipos de archivo permitidos
      const allowedTypes = ['image/jpeg', 'image/png'];
      
      // Obtener el nombre del archivo de diferentes formas posibles
      let fileName = file.name || file.originalFilename || file.filename;
      
      if (!fileName) {
        return ctx.badRequest('No se pudo determinar el nombre del archivo');
      }
      
      const allowedExtensions = ['.jpg', '.jpeg', '.png'];
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        return ctx.badRequest('Tipo de archivo no permitido. Solo se permiten JPG, JPEG y PNG');
      }

      // Validar tamaño máximo (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return ctx.badRequest('El archivo es demasiado grande. El tamaño máximo permitido es 5MB');
      }

      // Usar el método correcto para Strapi v5
      const uploadedFile = await strapi
        .plugin('upload')
        .service('upload')
        .upload({
          files: file,
          data: {
            fileInfo: {
              name: fileName,
              caption: null,
              alternativeText: null,
            },
          },
        });

      // Construir la URL completa del archivo
      const baseUrl = strapi.config.get('plugin.upload.config.providerOptions.baseUrl') || '';
      const fileUrl = uploadedFile[0]?.url || `${baseUrl}/${uploadedFile[0]?.key}`;

      return {
        success: true,
        url: fileUrl,
        fileName: uploadedFile[0]?.name,
        size: uploadedFile[0]?.size,
        type: uploadedFile[0]?.mime
      };

    } catch (error) {
      console.error('Error al subir imagen:', error);
      return ctx.badRequest('Error al subir la imagen: ' + error.message);
    }
  },

  async uploadUserImage(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('Debes iniciar sesión para subir imágenes');
    }

    try {
      if (!ctx.request.files || !ctx.request.files.file) {
        return ctx.badRequest('No se encontró ningún archivo. Envía el archivo en el campo "file"');
      }

      const file = ctx.request.files.file;
      const fileName = file.name || file.originalFilename || file.filename;

      if (!fileName) {
        return ctx.badRequest('No se pudo determinar el nombre del archivo');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const fileExtension = path.extname(fileName).toLowerCase();

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        return ctx.badRequest('Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WEBP');
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return ctx.badRequest('El archivo supera el tamaño máximo permitido de 5MB');
      }

      const folderId = await getOrCreateUserArticlesFolder();

      const uploaded = await strapi.plugin('upload').service('upload').upload({
        files: file,
        data: {
          fileInfo: {
            name: fileName,
            caption: null,
            alternativeText: null,
            folder: folderId,
          },
        },
      });

      const media = uploaded[0];

      return ctx.created({
        data: {
          id:   media.id,
          name: media.name,
          url:  media.url,
          mime: media.mime,
          size: media.size,
        },
      });
    } catch (error) {
      console.error('Error al subir imagen:', error);
      return ctx.badRequest('Error al subir la imagen: ' + error.message);
    }
  },

  async update(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  },

  async delete(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  }
}));
