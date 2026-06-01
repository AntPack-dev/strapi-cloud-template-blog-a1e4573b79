'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::interaction-types.interaction-type');
