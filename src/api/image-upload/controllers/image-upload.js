'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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

  async update(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  },

  async delete(ctx) {
    return ctx.send({ message: 'Image upload service - use POST /upload to upload images' });
  }
}));
