'use strict';

module.exports = ({ strapi }) => ({
  async validateImage(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido. Solo se permiten JPG, JPEG y PNG');
    }

    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo permitido es 5MB');
    }

    return true;
  },

  async uploadToS3(file, fileName) {
    const uploadService = strapi.plugin('upload').service('provider');
    
    return await uploadService.upload({
      name: fileName,
      buffer: file.buffer,
      type: file.type,
      size: file.size
    });
  },

  getFileUrl(key) {
    const baseUrl = strapi.config.get('plugin.upload.config.providerOptions.baseUrl') || '';
    return `${baseUrl}/${key}`;
  }
});
