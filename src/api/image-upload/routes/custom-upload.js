'use strict';

module.exports = {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/image-uploads/user-upload',
      handler: 'image-upload.uploadUserImage',
      config: { policies: [], middlewares: [] },
    },
  ],
};
