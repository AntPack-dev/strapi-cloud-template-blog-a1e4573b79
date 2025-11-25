'use strict';

/**
 * global-check service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::global-check.global-check');
