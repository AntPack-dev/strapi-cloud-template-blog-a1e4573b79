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
  strapi.log.info('[Bootstrap] ===== Iniciando bootstrap =====');
  strapi.log.info('[Bootstrap] Forzando uso de configuración desde config/plugins.js...');
  
  // Eliminar cualquier configuración de provider de la base de datos
  // para forzar que Strapi use la configuración de config/plugins.js
  try {
    strapi.log.info('[Bootstrap] Verificando configuración de upload en base de datos...');
    
    // Obtener la configuración actual de upload settings
    const uploadSettings = await strapi.store({ type: 'plugin', name: 'upload', key: 'settings' }).get();
    strapi.log.info(`[Bootstrap] Configuración actual de upload settings en BD: ${JSON.stringify(uploadSettings)}`);
    
    // Si hay un provider en la BD, eliminarlo para forzar uso de config/plugins.js
    if (uploadSettings && uploadSettings.provider) {
      strapi.log.info(`[Bootstrap] Eliminando provider '${uploadSettings.provider}' de la BD para usar config/plugins.js`);
      
      // Crear nueva configuración sin el provider
      const { provider, ...settingsWithoutProvider } = uploadSettings;
      
      // Guardar sin el provider
      await strapi.store({ type: 'plugin', name: 'upload', key: 'settings' }).set(settingsWithoutProvider);
      strapi.log.info('[Bootstrap] Provider eliminado de la base de datos');
    }
    
    // También verificar y limpiar directamente en la base de datos
    try {
      const dbCheck = await strapi.db.query('strapi::core-store').findOne({
        where: { key: 'plugin_upload_settings' },
      });
      
      if (dbCheck) {
        let dbValue = null;
        try {
          dbValue = typeof dbCheck.value === 'string' ? JSON.parse(dbCheck.value) : dbCheck.value;
        } catch (parseErr) {
          strapi.log.warn(`[Bootstrap] Error al parsear valor de BD: ${parseErr.message}`);
          dbValue = {};
        }
        
        // Si hay un provider en la BD, eliminarlo
        if (dbValue && dbValue.provider) {
          strapi.log.info(`[Bootstrap] Eliminando provider '${dbValue.provider}' directamente de la BD`);
          const { provider, ...settingsWithoutProvider } = dbValue;
          
          await strapi.db.query('strapi::core-store').update({
            where: { key: 'plugin_upload_settings' },
            data: {
              value: JSON.stringify(settingsWithoutProvider),
            },
          });
          strapi.log.info('[Bootstrap] Provider eliminado directamente de la base de datos');
        } else {
          strapi.log.info('[Bootstrap] No hay provider en la BD, se usará config/plugins.js');
        }
      }
    } catch (dbErr) {
      strapi.log.warn(`[Bootstrap] Error al verificar/limpiar BD: ${dbErr.message}`);
    }
    
    // Verificar que la configuración de config/plugins.js está disponible
    try {
      const uploadPlugin = strapi.plugin('upload');
      if (uploadPlugin) {
        const uploadPluginConfig = uploadPlugin.config;
        strapi.log.info(`[Bootstrap] Configuración completa del plugin upload: ${JSON.stringify(uploadPluginConfig, null, 2)}`);
        
        if (uploadPluginConfig?.config?.provider) {
          strapi.log.info(`[Bootstrap] Provider configurado en config/plugins.js: ${uploadPluginConfig.config.provider}`);
          strapi.log.info('[Bootstrap] Strapi usará esta configuración en lugar de la BD');
        } else {
          strapi.log.warn('[Bootstrap] No se encontró provider en config/plugins.js');
          strapi.log.warn('[Bootstrap] Verifica que config/plugins.js tenga: upload: { config: { provider: "aws-s3", ... } }');
        }
        
        // Verificar si hay un provider service activo y forzar AWS S3 si es necesario
        try {
          const providerService = uploadPlugin.service('provider');
          if (providerService) {
            strapi.log.info(`[Bootstrap] Provider service encontrado: ${JSON.stringify(!!providerService)}`);
            if (providerService.constructor && providerService.constructor.name) {
              strapi.log.info(`[Bootstrap] Provider service class name: ${providerService.constructor.name}`);
              
              // Si está usando Strapi Cloud, intentar forzar AWS S3
              if (providerService.constructor.name.includes('Cloud') || providerService.constructor.name.includes('cloud')) {
                strapi.log.warn('[Bootstrap] ⚠️ ADVERTENCIA: Strapi Cloud está activo para uploads.');
                strapi.log.warn('[Bootstrap] Intentando forzar AWS S3...');
                
                // Intentar reconfigurar el provider directamente
                try {
                  // Obtener la configuración de AWS S3 desde config/plugins.js
                  const awsS3Config = strapi.config.get('plugin.upload.config');
                  if (awsS3Config && awsS3Config.provider === 'aws-s3') {
                    strapi.log.info('[Bootstrap] Configuración de AWS S3 encontrada, intentando aplicar...');
                    
                    // Guardar la configuración en la base de datos para que se use
                    await strapi.store({ type: 'plugin', name: 'upload', key: 'settings' }).set({
                      provider: 'aws-s3',
                    });
                    
                    strapi.log.info('[Bootstrap] Configuración de AWS S3 guardada en BD');
                    strapi.log.warn('[Bootstrap] ⚠️ IMPORTANTE: También debes configurar el provider en el panel de administración:');
                    strapi.log.warn('[Bootstrap] Settings → Plugins → Upload → Provider: AWS S3');
                  }
                } catch (forceErr) {
                  strapi.log.error(`[Bootstrap] Error al forzar AWS S3: ${forceErr.message}`);
                }
              } else {
                strapi.log.info('[Bootstrap] ✅ Provider correcto detectado (no es Strapi Cloud)');
              }
            }
          }
        } catch (serviceErr) {
          strapi.log.warn(`[Bootstrap] No se pudo acceder al provider service: ${serviceErr.message}`);
        }
      } else {
        strapi.log.error('[Bootstrap] Plugin upload no encontrado');
      }
    } catch (pluginErr) {
      strapi.log.error(`[Bootstrap] Error al verificar plugin upload: ${pluginErr.message}`);
    }
  } catch (error) {
    strapi.log.error(`[Bootstrap] Error al limpiar configuración de provider: ${error.message}`);
    strapi.log.error(`[Bootstrap] Stack: ${error.stack}`);
  }

  // Interceptar el servicio de upload para agregar logs
  strapi.log.info('[Bootstrap] Interceptando servicio de upload...');
  try {
    const uploadService = strapi.plugin('upload').service('upload');
    strapi.log.info(`[Bootstrap] Servicio de upload encontrado: ${JSON.stringify(!!uploadService)}`);

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
          strapi.log.info(`[Upload Service] Plugin upload existe: ${JSON.stringify(!!uploadPlugin)}`);

          // Verificar si Strapi Cloud está activo
          try {
            const cloudPlugin = strapi.plugin('cloud');
            strapi.log.info(`[Upload Service] Plugin cloud existe: ${JSON.stringify(!!cloudPlugin)}`);
            if (cloudPlugin) {
              const cloudConfig = cloudPlugin.config;
              strapi.log.info(`[Upload Service] Cloud plugin config: ${JSON.stringify(cloudConfig, null, 2)}`);
            }
          } catch (err) {
            strapi.log.info(`[Upload Service] Cloud plugin no encontrado o deshabilitado: ${err.message}`);
          }

          let uploadConfig = null;
          if (uploadPlugin) {
            uploadConfig = uploadPlugin.config;
            strapi.log.info(`[Upload Service] Configuración completa del plugin: ${JSON.stringify(uploadConfig, null, 2)}`);

            // Verificar qué provider está configurado
            const configuredProvider = uploadConfig?.config?.provider;
            strapi.log.info(`[Upload Service] Provider configurado en config: ${configuredProvider || 'NO CONFIGURADO'}`);

            // Intentar acceder al provider directamente
            try {
              const providerService = uploadPlugin.service('provider');
              strapi.log.info(`[Upload Service] Provider service existe: ${JSON.stringify(!!providerService)}`);

              if (providerService) {
                strapi.log.info(`[Upload Service] Provider service keys: ${JSON.stringify(Object.keys(providerService))}`);

                // Intentar ver la configuración del provider
                if (providerService.getConfig) {
                  const providerConfig = providerService.getConfig();
                  strapi.log.info(`[Upload Service] Provider config: ${JSON.stringify(providerConfig, null, 2)}`);
                }

                // Verificar el nombre del provider que se está usando
                if (providerService.constructor && providerService.constructor.name) {
                  strapi.log.info(`[Upload Service] Provider class name: ${JSON.stringify(providerService.constructor.name)}`);
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

      strapi.log.info('[Bootstrap] Servicio de upload interceptado correctamente');
      strapi.log.info('[Upload Extension] Servicio de upload interceptado correctamente en bootstrap');
    } else {
      strapi.warn('[Bootstrap] No se pudo encontrar el servicio de upload');
      strapi.log.warn('[Upload Extension] No se pudo encontrar el servicio de upload en bootstrap');
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

      // Interceptar respuestas de la API para transformar URLs en archivos
      strapi.server.use(async (ctx, next) => {
        await next();
        
        if (ctx.response && ctx.response.body) {
          const transformUrlsInObject = (obj) => {
            if (Array.isArray(obj)) {
              return obj.map(transformUrlsInObject);
            } else if (obj && typeof obj === 'object') {
              const transformed = {};
              for (const key in obj) {
                if (key === 'url' && typeof obj[key] === 'string') {
                  transformed[key] = transformFileUrl(obj[key]);
                } else if (key === 'formats' && obj[key] && typeof obj[key] === 'object') {
                  // Transformar URLs en los diferentes formatos (thumbnail, small, medium, large)
                  transformed[key] = {};
                  for (const formatKey in obj[key]) {
                    if (obj[key][formatKey] && obj[key][formatKey].url) {
                      transformed[key][formatKey] = {
                        ...obj[key][formatKey],
                        url: transformFileUrl(obj[key][formatKey].url)
                      };
                    } else {
                      transformed[key][formatKey] = obj[key][formatKey];
                    }
                  }
                } else {
                  transformed[key] = transformUrlsInObject(obj[key]);
                }
              }
              return transformed;
            }
            return obj;
          };
          
          ctx.response.body = transformUrlsInObject(ctx.response.body);
        }
      });

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
  strapi.log.info('[Bootstrap] ===== Bootstrap completado =====');
};
