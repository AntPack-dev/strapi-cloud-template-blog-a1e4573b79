'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::article-rating.article-rating');
