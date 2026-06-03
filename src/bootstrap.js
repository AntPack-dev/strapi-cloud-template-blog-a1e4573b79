'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global, about } = require('../data/data.json');

async function seedExampleApp() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      strapi.log.info('Setting up the template...');
      await importSeedData();
      strapi.log.info('Ready to go');
    } catch (error) {
      strapi.log.info('Could not import seed data');
      strapi.error(error);
    }
  } else {
    strapi.log.info(
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
    strapi.error({ model, entry, error });
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
    const marketingPermissions = [
      'api::marketing.marketing.sendNewsletter',
      'api::marketing.marketing.contact',
      'api::marketing.marketing.interest',
    ];

    for (const action of marketingPermissions) {
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action, role: publicRole.id },
      });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
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

async function ensureRolePermissions(roleType, actions) {
  const role = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
  });
  if (!role) return;

  for (const action of actions) {
    const existing = await strapi.query('plugin::users-permissions.permission').findOne({
      where: { action, role: role.id },
    });
    if (!existing) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: role.id },
      });
      strapi.log.info(`[Bootstrap] Permiso registrado (${roleType}): ${action}`);
    }
  }
}

async function ensurePublicPermissions() {
  await ensureRolePermissions('public', [
    'api::parameter.parameter.getAll',
    'api::article.article-enhanced.findEnhanced',
    'api::article.article-enhanced.findOneEnhanced',
    'api::article.article.findOneWithUserInteraction',
    'api::comment.comment.getCommentsByArticle',
    'api::interaction-types.interaction-type.find',
    'api::interaction-types.interaction-type.findOne',
    'api::main-category.main-category.find',
    'api::main-category.main-category.findOne',
    'api::category.category.find',
    'api::category.category.findOne',
    'api::sub-category.sub-category.find',
    'api::sub-category.sub-category.findOne',
    'api::user-sub-category.user-sub-category.find',
    'api::user-sub-category.user-sub-category.findOne',
    'api::country.country.find',
    'api::country.country.findOne',
    // User articles approved — for the public "User Stories" feed
    'api::user-article.user-article.findApproved',
    'api::user-article.user-article.getMyArticle',
  ]);
}

async function ensureAuthenticatedPermissions() {
  await ensureRolePermissions('authenticated', [
    // Read-only endpoints accessible to any user (logged in or not)
    'api::parameter.parameter.getAll',
    'api::article.article-enhanced.findEnhanced',
    'api::article.article-enhanced.findOneEnhanced',
    'api::article.article.findOneWithUserInteraction',
    'api::comment.comment.getCommentsByArticle',
    'api::interaction-types.interaction-type.find',
    'api::interaction-types.interaction-type.findOne',
    'api::user-article.user-article.findApproved',
    'api::main-category.main-category.find',
    'api::main-category.main-category.findOne',
    'api::category.category.find',
    'api::category.category.findOne',
    'api::sub-category.sub-category.find',
    'api::sub-category.sub-category.findOne',
    'api::user-sub-category.user-sub-category.find',
    'api::user-sub-category.user-sub-category.findOne',
    'api::country.country.find',
    'api::country.country.findOne',
    'api::user-article.user-article.createArticle',
    'api::user-article.user-article.updateArticle',
    'api::user-article.user-article.submitForReview',
    'api::user-article.user-article.withdrawFromReview',
    'api::user-article.user-article.deleteArticle',
    'api::user-article.user-article.unpublishArticle',
    'api::user-article-event.user-article-event.find',
    'api::user-article-event.user-article-event.findOne',
    'api::user-article.user-article.getMyArticles',
    'api::user-article.user-article.getMyArticle',
    'api::user-article.user-article.getMyArticleEvents',
    'api::image-upload.image-upload.uploadUserImage',
    // Comments
    'api::comment.comment.create',
    'api::comment.comment.update',
    'api::comment.comment.delete',
    'api::comment.comment.getMyComments',
    // Like interactions
    'api::like.like.toggleInteraction',
    'api::like.like.getMyInteractions',
    // Favorite lists
    'api::favorite-list.favorite-list.getUserLists',
    'api::favorite-list.favorite-list.createOrGetDefault',
    'api::favorite-list.favorite-list.addArticle',
    'api::favorite-list.favorite-list.removeArticle',
    'api::favorite-list.favorite-list.removeMultipleArticles',
    'api::favorite-list.favorite-list.clearList',
    'api::favorite-list.favorite-list.getListById',
    'api::favorite-list.favorite-list.checkArticleFavorite',
    'api::favorite-list.favorite-list.deleteFavoriteList',
    'api::favorite-list.favorite-list.create',
  ]);
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
  strapi.log.info('[Bootstrap] Interceptando servicio de upload...');
  try {
    const uploadService = strapi.plugin('upload').service('upload');
    strapi.log.info(`[Bootstrap] Servicio de upload encontrado: ${JSON.stringify(!!uploadService)}`);

    if (uploadService && uploadService.upload) {
      const originalUpload = uploadService.upload.bind(uploadService);

      uploadService.upload = async function (config) {
        const startTime = Date.now();

        try {
          strapi.log.info(`[Upload Service] Config recibido: ${JSON.stringify({
            hasData: !!config.data,
            hasFileInfo: !!config.data?.fileInfo,
            fileInfoKeys: config.data?.fileInfo ? Object.keys(config.data.fileInfo) : [],
            folderInfo: config.data?.fileInfo?.folder,
            actionOptions: config.actionOptions,
          }, null, 2)}`);

          let folderPath = null;
          let folderId = null;

          if (config?.data?.fileInfo?.folder) {
            folderId = typeof config.data.fileInfo.folder === 'object'
              ? config.data.fileInfo.folder.id || config.data.fileInfo.folder
              : config.data.fileInfo.folder;
          } else if (config?.data?.folder) {
            folderId = typeof config.data.folder === 'object'
              ? config.data.folder.id || config.data.folder
              : config.data.folder;
          }

          strapi.log.info(`[Upload Service] Folder ID detectado: ${folderId}`);

          if (folderId) {
            try {
              const folder = await strapi.query('plugin::upload.folder').findOne({
                where: { id: folderId },
                populate: ['parent'],
              });

              strapi.log.info(`[Upload Service] Folder encontrado: ${JSON.stringify({
                id: folder?.id,
                name: folder?.name,
                path: folder?.path,
                pathId: folder?.pathId,
              }, null, 2)}`);

              if (folder && folder.path) {
                folderPath = folder.path;
                strapi.log.info(`[Upload Service] Folder path detectado: ${folderPath}`);
              }
            } catch (error) {
              strapi.log.warn(`[Upload Service] Error al obtener folder: ${error.message}`);
              strapi.log.warn(`[Upload Service] Stack: ${error.stack}`);
            }
          }

          if (folderPath) {
            const normalizedPath = folderPath.startsWith('/')
              ? folderPath.substring(1)
              : folderPath;
            const s3Path = normalizedPath.endsWith('/')
              ? normalizedPath
              : `${normalizedPath}/`;

            if (!config.actionOptions) config.actionOptions = {};
            if (!config.actionOptions.upload) config.actionOptions.upload = {};

            config.actionOptions.upload.path = s3Path;
            config._folderPath = s3Path;

            if (config.files && Array.isArray(config.files)) {
              config.files.forEach(file => { if (file) file._folderPath = s3Path; });
            } else if (config.files) {
              config.files._folderPath = s3Path;
            }

            strapi.log.info(`[Upload Service] Archivo se guardará en S3 con path: ${s3Path}`);
          } else {
            strapi.log.info(`[Upload Service] No se detectó folder, archivo se guardará en la raíz de S3`);
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

      strapi.log.info('[Bootstrap] Servicio de upload interceptado correctamente');
      strapi.log.info('[Upload Extension] Servicio de upload interceptado correctamente en bootstrap');
    } else {
      strapi.warn('[Bootstrap] No se pudo encontrar el servicio de upload');
      strapi.log.warn('[Upload Extension] No se pudo encontrar el servicio de upload en bootstrap');
    }

    // Interceptar el provider de S3 para modificar la Key según el folder
    try {
      const uploadPlugin = strapi.plugin('upload');
      if (uploadPlugin) {
        const providerService = uploadPlugin.service('provider');

        if (providerService && providerService.upload) {
          const originalProviderUpload = providerService.upload.bind(providerService);

          providerService.upload = async function(file, customParams = {}) {
            strapi.log.info(`[S3 Provider] Upload llamado con customParams: ${JSON.stringify({
              hasPath: !!customParams.path,
              path: customParams.path,
              hasKey: !!customParams.Key,
              Key: customParams.Key,
              fileHash: file?.hash,
              fileName: file?.name,
            }, null, 2)}`);

            let folderPath = customParams.path;

            if (!folderPath && file && file._folderPath) {
              folderPath = file._folderPath;
            }

            if (folderPath) {
              const pathPrefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

              let originalKey = customParams.Key;
              if (!originalKey) {
                originalKey = file.hash || file.name;
                if (file.ext) {
                  originalKey = `${originalKey}${file.ext.startsWith('.') ? '' : '.'}${file.ext}`;
                }
              }

              const newKey = `${pathPrefix}${originalKey}`;
              strapi.log.info(`[S3 Provider] Key original: ${originalKey}`);
              strapi.log.info(`[S3 Provider] Key con folder: ${newKey}`);

              customParams = { ...customParams, Key: newKey, path: pathPrefix };
            } else {
              strapi.log.info(`[S3 Provider] No hay folder path, usando Key original: ${customParams.Key || file.hash || file.name}`);
            }

            return originalProviderUpload(file, customParams);
          };

          strapi.log.info('[Bootstrap] Provider de S3 interceptado correctamente para soportar folders');
        } else {
          strapi.log.warn('[Bootstrap] No se encontró el método upload en el provider service');
        }
      }
    } catch (error) {
      strapi.log.warn(`[Bootstrap] No se pudo interceptar el provider de S3: ${error.message}`);
      strapi.log.warn(`[Bootstrap] Stack: ${error.stack}`);
    }
  } catch (error) {
    strapi.error(`[Bootstrap] Error al interceptar servicio: ${error.message}`);
    strapi.error(`[Bootstrap] Stack: ${error.stack}`);
    strapi.log.error(`[Upload Extension] Error al interceptar servicio en bootstrap: ${error.message}`);
    strapi.log.error(`[Upload Extension] Stack: ${error.stack}`);
  }

  // Transformar URLs de archivos para que apunten directamente al CDN
  strapi.log.info('[Bootstrap] Configurando transformación de URLs de archivos...');
  try {
    const resourcesCdn = process.env.RESOURCES_CDN;
    if (resourcesCdn) {
      // Asegurar que el CDN sea una URL absoluta
      const cdnUrl = resourcesCdn.startsWith('http')
        ? resourcesCdn
        : `https://${resourcesCdn}`;

      // Obtener el dominio de la API para detectar URLs mal formadas
      const apiUrl = process.env.API_URL || process.env.PUBLIC_URL || '';
      strapi.log.info(`[Bootstrap] CDN URL configurado: ${cdnUrl}`);
      strapi.log.info(`[Bootstrap] API URL: ${apiUrl}`);

      // Función para transformar URLs de archivos
      const transformFileUrl = (url) => {
        if (!url || typeof url !== 'string') return url;

        // Si la URL ya es del CDN correcto, devolverla tal cual
        if (url.startsWith(cdnUrl)) {
          return url;
        }
        // Si la URL contiene el dominio de la API seguido del CDN (caso del error)
        if (apiUrl && url.includes(apiUrl) && url.includes(resourcesCdn.replace(/^https?:\/\//, ''))) {
          // Extraer la ruta del archivo después del CDN
          const cdnDomain = resourcesCdn.replace(/^https?:\/\//, '');
          const cdnIndex = url.indexOf(cdnDomain);
          if (cdnIndex !== -1) {
            const filePath = url.substring(cdnIndex + cdnDomain.length);
            return `${cdnUrl}${filePath}`;
          }
        }

        // Si la URL es relativa o contiene solo la ruta del archivo
        if (url.startsWith('/') || (!url.startsWith('http') && !url.startsWith('//'))) {
          // Si la URL comienza con el dominio del CDN sin protocolo
          const cdnDomain = resourcesCdn.replace(/^https?:\/\//, '');
          if (url.includes(cdnDomain)) {
            const cdnIndex = url.indexOf(cdnDomain);
            const filePath = url.substring(cdnIndex + cdnDomain.length);
            return `${cdnUrl}${filePath}`;
          }
          // Si es una ruta relativa, construir la URL completa con el CDN
          return `${cdnUrl}${url.startsWith('/') ? url : '/' + url}`;
        }

        return url;
      };

      // Interceptar el servicio de archivos para transformar URLs
      const fileService = strapi.plugin('upload').service('file');
      if (fileService) {
        const originalFormatFileInfo = fileService.formatFileInfo?.bind(fileService);
        if (originalFormatFileInfo) {
          fileService.formatFileInfo = function(file) {
            const formatted = originalFormatFileInfo(file);
            if (formatted && formatted.url) {
              formatted.url = transformFileUrl(formatted.url);
            }
            return formatted;
          };
        }
      }

      strapi.log.info('[Bootstrap] Transformación de URLs de archivos configurada correctamente');
    } else {
      strapi.log.warn('[Bootstrap] RESOURCES_CDN no está configurado, omitiendo transformación de URLs');
    }
  } catch (error) {
    strapi.log.error(`[Bootstrap] Error al configurar transformación de URLs: ${error.message}`);
    strapi.log.error(`[Bootstrap] Stack: ${error.stack}`);
  }

  strapi.log.info('[Bootstrap] Ejecutando seedExampleApp...');
  await seedExampleApp();

  await ensurePublicPermissions();
  await ensureAuthenticatedPermissions();

  strapi.log.info('[Bootstrap] ===== Bootstrap completado =====');
};
