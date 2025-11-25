'use strict';

/**
 * global-check router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::global-check.global-check');
