'use strict';

/**
 * fqa service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::fqa.fqa');
