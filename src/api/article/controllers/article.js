'use strict';

/**
 *  article controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    // Verificar si se solicita incluir likesCount, interactionsCount y/o commentsCount
    const { includeLikesCount, includeInteractionsCount, includeCommentsCount } = ctx.query;
    
    if (includeLikesCount === 'true' || includeInteractionsCount === 'true' || includeCommentsCount === 'true') {
      try {
        // Usar el método estándar primero para obtener los artículos
        const response = await super.find(ctx);
        
        // Para cada artículo, contar las interacciones y/o comments
        const articlesWithCount = await Promise.all(
          response.data.map(async (article) => {
            let likesCount = 0;
            let meGustaCount = 0;
            let meInteresaCount = 0;
            let commentsCount = 0;

            // Contar likes si se solicita (mantiene compatibilidad)
            if (includeLikesCount === 'true') {
              likesCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id },
              });
            }

            // Contar interacciones si se solicita
            if (includeInteractionsCount === 'true') {
              meGustaCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id, type: 'me_gusta' },
              });
              meInteresaCount = await strapi.db.query('api::like.like').count({
                where: { article: article.id, type: 'me_interesa' },
              });
            }

            // Contar comments si se solicita
            if (includeCommentsCount === 'true') {
              commentsCount = await strapi.db.query('api::comment.comment').count({
                where: { article: article.id },
              });
            }

            const result = { ...article };
            if (includeLikesCount === 'true') {
              result.likesCount = likesCount;
            }
            if (includeInteractionsCount === 'true') {
              result.meGustaCount = meGustaCount;
              result.meInteresaCount = meInteresaCount;
              result.totalInteractionsCount = meGustaCount + meInteresaCount;
            }
            if (includeCommentsCount === 'true') {
              result.commentsCount = commentsCount;
            }

            return result;
          })
        );

        return ctx.send({
          data: articlesWithCount,
          meta: response.meta,
        });
      } catch (error) {
        console.error('Error fetching articles with counts:', error);
        return ctx.badRequest('Error fetching articles');
      }
    } else {
      // Usar el método estándar si no se solicita counts
      return super.find(ctx);
    }
  },

  async toggleInteraction(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;
    const { type = 'me_gusta' } = ctx.request.body;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to interact with articles');
    }

    // Validar que el tipo de interacción sea válido
    if (!['me_gusta', 'me_interesa'].includes(type)) {
      return ctx.badRequest('Invalid interaction type. Must be "me_gusta" or "me_interesa"');
    }

    try {
      const existingInteraction = await strapi.db.query('api::like.like').findOne({
        where: {
          article: id,
          user: userId,
          type: type,
        },
      });

      if (existingInteraction) {
        await strapi.db.query('api::like.like').delete({
          where: { id: existingInteraction.id },
        });

        return ctx.send({
          message: `${type.replace('_', ' ')} removed`,
          interacted: false,
          type: type,
        });
      } else {
        await strapi.db.query('api::like.like').create({
          data: {
            article: id,
            user: userId,
            type: type,
          },
        });

        return ctx.send({
          message: `Article ${type.replace('_', ' ')}d`,
          interacted: true,
          type: type,
        });
      }
    } catch (error) {
      console.error('Error toggling interaction:', error);
      return ctx.badRequest('An error occurred while toggling interaction');
    }
  },

  // Mantener el método antiguo para compatibilidad
  async toggleLike(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized('You must be logged in to like articles');
    }

    try {
      const existingLike = await strapi.db.query('api::like.like').findOne({
        where: {
          article: id,
          user: userId,
          type: 'me_gusta',
        },
      });

      if (existingLike) {
        await strapi.db.query('api::like.like').delete({
          where: { id: existingLike.id },
        });

        return ctx.send({
          message: 'Like removed',
          liked: false,
        });
      } else {
        await strapi.db.query('api::like.like').create({
          data: {
            article: id,
            user: userId,
            type: 'me_gusta',
          },
        });

        return ctx.send({
          message: 'Article liked',
          liked: true,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return ctx.badRequest('An error occurred while toggling like');
    }
  },

  // Métodos adicionales para interacciones count
  async findWithInteractionsCount(ctx) {
    const { includeCommentsCount, includeLikesCount } = ctx.query;
    
    try {
      // Versión simplificada para debug
      const articles = await strapi.db.query('api::article.article').findMany();

      // Para cada artículo, contar las interacciones y/o comments
      const articlesWithCount = await Promise.all(
        articles.map(async (article) => {
          let meGustaCount = 0;
          let meInteresaCount = 0;
          let likesCount = 0;

          // Contar interacciones
          meGustaCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id, type: 'me_gusta' },
          });
          meInteresaCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id, type: 'me_interesa' },
          });

          // Contar likes totales si se solicita (compatibilidad)
          if (includeLikesCount === 'true') {
            likesCount = await strapi.db.query('api::like.like').count({
              where: { article: article.id },
            });
          }

          const result = {
            ...article,
            meGustaCount: meGustaCount,
            meInteresaCount: meInteresaCount,
            totalInteractionsCount: meGustaCount + meInteresaCount,
          };

          // Agregar likesCount si se solicita (compatibilidad)
          if (includeLikesCount === 'true') {
            result.likesCount = likesCount;
          }

          // Agregar commentsCount si se solicita
          if (includeCommentsCount === 'true') {
            const commentsCount = await strapi.db.query('api::comment.comment').count({
              where: { article: article.id },
            });
            result.commentsCount = commentsCount;
          }

          return result;
        })
      );

      return ctx.send({
        data: articlesWithCount,
        meta: {
          total: articlesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Error fetching articles with counts:', error);
      return ctx.badRequest('Error fetching articles');
    }
  },

  // Mantener compatibilidad con el método antiguo
  async findWithLikesCount(ctx) {
    const { includeCommentsCount } = ctx.query;
    
    try {
      // Versión simplificada para debug
      const articles = await strapi.db.query('api::article.article').findMany();

      // Para cada artículo, contar los likes y/o comments
      const articlesWithCount = await Promise.all(
        articles.map(async (article) => {
          const likesCount = await strapi.db.query('api::like.like').count({
            where: { article: article.id },
          });

          const result = {
            ...article,
            likesCount: likesCount,
          };

          // Agregar commentsCount si se solicita
          if (includeCommentsCount === 'true') {
            const commentsCount = await strapi.db.query('api::comment.comment').count({
              where: { article: article.id },
            });
            result.commentsCount = commentsCount;
          }

          return result;
        })
      );

      return ctx.send({
        data: articlesWithCount,
        meta: {
          total: articlesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Error fetching articles with counts:', error);
      return ctx.badRequest('Error fetching articles');
    }
  },

  async findOneWithInteractionsCount(ctx) {
    const { id } = ctx.params;
    const { populate, includeCommentsCount, includeLikesCount } = ctx.query;

    try {
      // Construir parámetros de populate
      const populateParams = {};
      if (populate) {
        if (typeof populate === 'string') {
          populateParams.populate = populate;
        } else if (Array.isArray(populate)) {
          populateParams.populate = populate.join(',');
        }
      }

      // Obtener el artículo con populate dinámico
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: populateParams.populate || '*',
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Contar las interacciones para este artículo
      const meGustaCount = await strapi.db.query('api::like.like').count({
        where: { article: id, type: 'me_gusta' },
      });
      const meInteresaCount = await strapi.db.query('api::like.like').count({
        where: { article: id, type: 'me_interesa' },
      });

      // Devolver el artículo con los conteos
      const articleWithCount = {
        ...article,
        meGustaCount: meGustaCount,
        meInteresaCount: meInteresaCount,
        totalInteractionsCount: meGustaCount + meInteresaCount,
      };

      // Agregar likesCount si se solicita (compatibilidad)
      if (includeLikesCount === 'true') {
        const likesCount = await strapi.db.query('api::like.like').count({
          where: { article: id },
        });
        articleWithCount.likesCount = likesCount;
      }

      // Agregar commentsCount si se solicita
      if (includeCommentsCount === 'true') {
        const commentsCount = await strapi.db.query('api::comment.comment').count({
          where: { article: id },
        });
        articleWithCount.commentsCount = commentsCount;
      }

      return ctx.send({
        data: articleWithCount,
      });
    } catch (error) {
      console.error('Error fetching article with counts:', error);
      return ctx.badRequest('Error fetching article');
    }
  },

  // Mantener compatibilidad con el método antiguo
  async findOneWithLikesCount(ctx) {
    const { id } = ctx.params;
    const { populate, includeCommentsCount } = ctx.query;

    try {
      // Construir parámetros de populate
      const populateParams = {};
      if (populate) {
        if (typeof populate === 'string') {
          populateParams.populate = populate;
        } else if (Array.isArray(populate)) {
          populateParams.populate = populate.join(',');
        }
      }

      // Obtener el artículo con populate dinámico
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: populateParams.populate || '*',
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Contar los likes para este artículo
      const likesCount = await strapi.db.query('api::like.like').count({
        where: { article: id },
      });

      // Devolver el artículo con el conteo
      const articleWithCount = {
        ...article,
        likesCount: likesCount,
      };

      // Agregar commentsCount si se solicita
      if (includeCommentsCount === 'true') {
        const commentsCount = await strapi.db.query('api::comment.comment').count({
          where: { article: id },
        });
        articleWithCount.commentsCount = commentsCount;
      }

      return ctx.send({
        data: articleWithCount,
      });
    } catch (error) {
      console.error('Error fetching article with counts:', error);
      return ctx.badRequest('Error fetching article');
    }
  },

  async randomizeFeatured(ctx) {
    try {
      console.log('=== INICIANDO RANDOMIZE FEATURED ===');
      
      // 1. Obtener todos los artículos publicados y aprobados con main_category
      //    main_category NO es localizado -> es el mismo para todos los locales del artículo
      const publishedArticles = await strapi.db.query('api::article.article').findMany({
        where: {
          publishedAt: { $notNull: true },
          currentStatus: 'approved',
        },
        populate: { main_category: true },
        select: ['id', 'documentId', 'locale', 'title', 'isFeatured'],
      });

      console.log(`Artículos publicados encontrados: ${publishedArticles.length}`);
      console.log('Primeros 5 artículos:', publishedArticles.slice(0, 5).map(a => ({id: a.id, docId: a.documentId, locale: a.locale, title: a.title, isFeatured: a.isFeatured})));

      // 2. Agrupar documentIds únicos por main_category (deduplicar locales)
      const byMainCategory = {};
      const seenDocumentIds = new Set();

      for (const article of publishedArticles) {
        if (!article.main_category) continue;
        const catId = article.main_category.id;
        const docId = article.documentId;

        if (seenDocumentIds.has(docId)) continue;
        seenDocumentIds.add(docId);

        if (!byMainCategory[catId]) byMainCategory[catId] = [];
        byMainCategory[catId].push(docId);
      }

      console.log(`Categorías encontradas: ${Object.keys(byMainCategory).length}`);
      console.log('DocumentIds por categoría:', byMainCategory);

      // 3. Seleccionar aleatoriamente hasta 3 documentIds por mainCategory (Fisher-Yates)
      const selectedDocumentIds = new Set();
      for (const docIds of Object.values(byMainCategory)) {
        const shuffled = [...docIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        shuffled.slice(0, 3).forEach(id => selectedDocumentIds.add(id));
      }

      console.log(`DocumentIds seleccionados: ${[...selectedDocumentIds]}`);

      // 4. Reset: poner isFeatured = false en todos los artículos publicados y aprobados (todos los locales)
      // Como isFeatured es localizado, debemos actualizar cada locale individualmente
      const allLocales = await strapi.plugins.i18n.services.locales.find();
      console.log(`Locales encontrados: ${allLocales.map(l => l.code)}`);
      
      for (const locale of allLocales) {
        console.log(`Reseteando isFeatured=false para locale: ${locale.code}`);
        const resetResult = await strapi.db.query('api::article.article').updateMany({
          where: { locale: locale.code },
          data: { isFeatured: false },
        });
        console.log(`Reset result para ${locale.code}:`, resetResult);
      }

      // 5. Marcar los seleccionados: isFeatured = true (draft y published)
      if (selectedDocumentIds.size > 0) {
        for (const locale of allLocales) {
          console.log(`Marcando isFeatured=true para ${selectedDocumentIds.size} artículos en locale: ${locale.code}`);
          const featuredResult = await strapi.db.query('api::article.article').updateMany({
            where: {
              documentId: { $in: [...selectedDocumentIds] },
              locale: locale.code,
            },
            data: { isFeatured: true },
          });
          console.log(`Featured result para ${locale.code}:`, featuredResult);
        }
      }

      // Verificar resultados finales
      const finalCheck = await strapi.db.query('api::article.article').findMany({
        where: {
          isFeatured: true,
          publishedAt: { $notNull: true },
        },
        select: ['id', 'documentId', 'locale', 'title', 'isFeatured'],
      });
      
      console.log(`=== VERIFICACIÓN FINAL: ${finalCheck.length} artículos con isFeatured=true ===`);
      console.log('Artículos destacados:', finalCheck.map(a => ({id: a.id, docId: a.documentId, locale: a.locale, title: a.title})));

      return ctx.send({
        success: true,
        message: 'Featured articles randomized successfully',
        data: {
          totalFeatured: selectedDocumentIds.size,
          categoriesProcessed: Object.keys(byMainCategory).length,
          featuredDocumentIds: [...selectedDocumentIds],
          localesProcessed: allLocales.length,
          debugInfo: {
            totalArticles: publishedArticles.length,
            finalFeaturedCount: finalCheck.length,
            featuredArticles: finalCheck.map(a => ({id: a.id, docId: a.documentId, locale: a.locale, title: a.title}))
          }
        },
      });
    } catch (error) {
      console.error('Error randomizing featured articles:', error);
      return ctx.internalServerError('Error randomizing featured articles');
    }
  },

  // Obtener artículo con información de interacción del usuario
  async findOneWithUserInteraction(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    try {
      // Obtener el artículo solo con campos básicos (sin relaciones pesadas)
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        select: [
          'id', 
          'title', 
          'slug', 
          'description', 
          'isFeatured',
          'isFeaturedMain',
          'currentStatus',
          'readingTime',
          'creationDate',
          'publishedAt', 
          'createdAt', 
          'updatedAt'
        ]
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Inicializar objeto de respuesta
      const articleWithInteraction = {
        ...article,
        userInteraction: {
          hasLiked: false,
          hasCommented: false,
          likedTypes: []
        }
      };

      // Si el usuario está autenticado, verificar sus interacciones
      if (userId) {
        // Verificar si el usuario ha dado like a este artículo (cualquier tipo)
        const userLikes = await strapi.db.query('api::like.like').findMany({
          where: {
            article: id,
            user: userId
          },
          populate: ['type']
        });

        // Verificar si el usuario ha comentado en este artículo
        const userComment = await strapi.db.query('api::comment.comment').findOne({
          where: {
            article: id,
            author: userId
          }
        });

        // Actualizar información de interacción
        articleWithInteraction.userInteraction = {
          hasLiked: userLikes.length > 0,
          hasCommented: !!userComment,
          likedTypes: userLikes.map(like => ({
            id: like.type?.id,
            code: like.type?.code,
            displayName: like.type?.display_name,
            icon: like.type?.icon,
            color: like.type?.color
          }))
        };
      }

      return ctx.send({
        data: articleWithInteraction,
      });
    } catch (error) {
      console.error('Error fetching article with user interaction:', error);
      return ctx.badRequest('Error fetching article');
    }
  },
}));
