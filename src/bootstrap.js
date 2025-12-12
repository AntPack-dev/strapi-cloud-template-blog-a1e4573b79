'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global, about } = require('../data/data.json');

async function seedExampleApp() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('Setting up the template...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
    }
  } else {
    console.log(
      'Seed data has already been imported. We cannot reimport unless you clear your database first.'
    );
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  // Create the new permissions and link them to the public role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  // Parse the file metadata
  const size = getFileSizeInBytes(filePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size,
    mimetype: mimeType,
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

// Create an entry and attach files if there are any
async function createEntry({ model, entry }) {
  try {
    // Actually create the entry in Strapi
    await strapi.documents(`api::${model}.${model}`).create({
      data: entry,
    });
  } catch (error) {
    console.error({ model, entry, error });
  }
}

async function checkFileExistsBeforeUpload(files) {
  const existingFiles = [];
  const uploadedFiles = [];
  const filesCopy = [...files];

  for (const fileName of filesCopy) {
    // Check if the file already exists in Strapi
    const fileWhereName = await strapi.query('plugin::upload.file').findOne({
      where: {
        name: fileName.replace(/\..*$/, ''),
      },
    });

    if (fileWhereName) {
      // File exists, don't upload it
      existingFiles.push(fileWhereName);
    } else {
      // File doesn't exist, upload it
      const fileData = getFileData(fileName);
      const fileNameNoExtension = fileName.split('.').shift();
      const [file] = await uploadFile(fileData, fileNameNoExtension);
      uploadedFiles.push(file);
    }
  }
  const allFiles = [...existingFiles, ...uploadedFiles];
  // If only one file then return only that file
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

async function updateBlocks(blocks) {
  const updatedBlocks = [];
  for (const block of blocks) {
    if (block.__component === 'shared.media') {
      const uploadedFiles = await checkFileExistsBeforeUpload([block.file]);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file name on the block with the actual file
      blockCopy.file = uploadedFiles;
      updatedBlocks.push(blockCopy);
    } else if (block.__component === 'shared.slider') {
      // Get files already uploaded to Strapi or upload new files
      const existingAndUploadedFiles = await checkFileExistsBeforeUpload(block.files);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file names on the block with the actual files
      blockCopy.files = existingAndUploadedFiles;
      // Push the updated block
      updatedBlocks.push(blockCopy);
    } else {
      // Just push the block as is
      updatedBlocks.push(block);
    }
  }

  return updatedBlocks;
}

async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        blocks: updatedBlocks,
        // Make sure it's not a draft
        publishedAt: Date.now(),
      },
    });
  }
}

async function importGlobal() {
  const favicon = await checkFileExistsBeforeUpload(['favicon.png']);
  const shareImage = await checkFileExistsBeforeUpload(['default-image.png']);
  return createEntry({
    model: 'global',
    entry: {
      ...global,
      favicon,
      // Make sure it's not a draft
      publishedAt: Date.now(),
      defaultSeo: {
        ...global.defaultSeo,
        shareImage,
      },
    },
  });
}

async function importAbout() {
  const updatedBlocks = await updateBlocks(about.blocks);

  await createEntry({
    model: 'about',
    entry: {
      ...about,
      blocks: updatedBlocks,
      // Make sure it's not a draft
      publishedAt: Date.now(),
    },
  });
}

async function importCategories() {
  for (const category of categories) {
    await createEntry({ model: 'category', entry: category });
  }
}

async function importAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);

    await createEntry({
      model: 'author',
      entry: {
        ...author,
        avatar,
      },
    });
  }
}

async function importSeedData() {
  // Allow read of application content types
  await setPublicPermissions({
    article: ['find', 'findOne'],
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    global: ['find', 'findOne'],
    about: ['find', 'findOne'],
  });

  // Allow access to marketing endpoint
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  if (publicRole) {
    // Permisos para marketing
    const marketingPermissions = [
      'api::marketing.marketing.sendNewsletter',
      'api::marketing.marketing.contact',
      'api::marketing.marketing.interest',
    ];

    for (const action of marketingPermissions) {
      const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action: action,
          role: publicRole.id,
        },
      });

      if (!existingPermission) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            action: action,
            role: publicRole.id,
          },
        });
      }
    }
  }

  // Create all entries
  await importCategories();
  await importAuthors();
  await importArticles();
  await importGlobal();
  await importAbout();
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedExampleApp();
  await app.destroy();

  process.exit(0);
}

module.exports = async () => {
  try {
    const uploadService = strapi.plugin('upload').service('upload');

    if (uploadService && uploadService.upload) {
      const originalUpload = uploadService.upload.bind(uploadService);

      uploadService.upload = async function (config) {
        const startTime = Date.now();

        try {
          strapi.log.info('[Upload Service] ===== Iniciando servicio de upload =====');
          strapi.log.info(`[Upload Service] Configuración: ${JSON.stringify(config)}`);

          // Verificar variables de entorno directamente
          strapi.log.info(`[Upload Service] Variables de entorno AWS: ${JSON.stringify({
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 4)}...${process.env.AWS_ACCESS_KEY_ID.slice(-4)}` : 'NO CONFIGURADO',
            AWS_ACCESS_SECRET: process.env.AWS_ACCESS_SECRET ? `${process.env.AWS_ACCESS_SECRET.slice(0, 4)}...${process.env.AWS_ACCESS_SECRET.slice(-4)}` : 'NO CONFIGURADO',
            AWS_REGION: process.env.AWS_REGION || 'NO CONFIGURADO',
            AWS_BUCKET: process.env.AWS_BUCKET || 'NO CONFIGURADO',
            RESOURCES_CDN: process.env.RESOURCES_CDN || 'NO CONFIGURADO',
          }, null, 2)}`);

          // Verificar configuración de S3 desde el plugin
          const uploadPlugin = strapi.plugin('upload');
          strapi.log.info(`[Upload Service] Plugin upload existe: ${!!uploadPlugin}`);
          
          let uploadConfig = null;
          if (uploadPlugin) {
            uploadConfig = uploadPlugin.config;
            strapi.log.info(`[Upload Service] Configuración completa del plugin: ${JSON.stringify(uploadConfig, null, 2)}`);
            
            // Intentar acceder al provider directamente
            try {
              const providerService = uploadPlugin.service('provider');
              strapi.log.info(`[Upload Service] Provider service existe: ${!!providerService}`);
              
              if (providerService) {
                strapi.log.info(`[Upload Service] Provider service keys: ${JSON.stringify(Object.keys(providerService))}`);
                
                // Intentar ver la configuración del provider
                if (providerService.getConfig) {
                  const providerConfig = providerService.getConfig();
                  strapi.log.info(`[Upload Service] Provider config: ${JSON.stringify(providerConfig, null, 2)}`);
                }
              }
            } catch (err) {
              strapi.log.warn(`[Upload Service] No se pudo acceder al provider service: ${err.message}`);
            }
          }

          // Llamar al método original
          strapi.log.info('[Upload Service] Ejecutando upload al provider S3...');
          const result = await originalUpload(config);

          const duration = Date.now() - startTime;
          strapi.log.info('[Upload Service] ===== Servicio de upload completado =====');
          strapi.log.info(`[Upload Service] Resultado: ${JSON.stringify({
            duration: `${duration}ms`,
            resultCount: Array.isArray(result) ? result.length : 1,
            results: Array.isArray(result)
              ? result.map(r => ({
                id: r.id,
                name: r.name,
                url: r.url,
                provider: r.provider,
                size: r.size,
              }))
              : {
                id: result.id,
                name: result.name,
                url: result.url,
                provider: result.provider,
                size: result.size,
              },
          })}`);

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          strapi.log.error('[Upload Service] ===== Error en servicio de upload =====');
          strapi.log.error(`[Upload Service] Error detallado: ${JSON.stringify({
            duration: `${duration}ms`,
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            statusCode: error.statusCode,
            requestId: error.requestId,
            region: error.region,
          }, null, 2)}`);

          // Log específico para errores de AWS S3
          if (error.code) {
            strapi.log.error(`[Upload Service] Error de AWS S3: ${JSON.stringify({
              code: error.code,
              message: error.message,
              requestId: error.requestId,
              region: error.region,
            }, null, 2)}`);
          }

          throw error;
        }
      };

      strapi.log.info('[Upload Extension] Servicio de upload interceptado correctamente en bootstrap');
    } else {
      strapi.log.warn('[Upload Extension] No se pudo encontrar el servicio de upload en bootstrap');
    }
  } catch (error) {
    strapi.log.error(`[Upload Extension] Error al interceptar servicio en bootstrap: ${error.message}`);
    strapi.log.error(`[Upload Extension] Stack: ${error.stack}`);
  }

  await seedExampleApp();
};
