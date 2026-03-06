'use strict';

/**
 * article-enhanced controller
 */

const { createController } = require('@strapi/strapi').factories;

module.exports = createController('api::article.article', ({ strapi }) => ({
  // Enhanced find method with stats, user interaction, search, filters and random
  async findEnhanced(ctx) {
    const userId = ctx.state.user?.id;
    const { 
      search, 
      category, 
      main_category, 
      sub_category, 
      random, 
      page = 1, 
      pageSize = 10,
      featured,
      featuredMain
    } = ctx.query;

    try {
      // Build where clause
      const whereClause = {};

      // Add filters
      if (category) {
        whereClause.category = category;
      }

      if (main_category) {
        whereClause.main_category = main_category;
      }

      if (sub_category) {
        whereClause.sub_categories = sub_category;
      }

      if (featured !== undefined) {
        whereClause.isFeatured = featured === 'true';
      }

      if (featuredMain !== undefined) {
        whereClause.isFeaturedMain = featuredMain === 'true';
      }

      // Only published articles
      whereClause.publishedAt = { $notNull: true };

      // Build query options
      const queryOptions = {
        where: whereClause,
        populate: {
          cover: true,
          category: {
            select: ['id', 'name', 'slug']
          },
          main_category: {
            select: ['id', 'name', 'slug']
          },
          sub_categories: {
            select: ['id', 'name', 'slug']
          },
          author: {
            select: ['id', 'name', 'slug']
          }
        },
        orderBy: { publishedAt: 'desc' }
      };

      // Add pagination
      if (random !== 'true') {
        queryOptions.limit = parseInt(pageSize);
        queryOptions.offset = (parseInt(page) - 1) * parseInt(pageSize);
      }

      // Get articles
      let articles = await strapi.db.query('api::article.article').findMany(queryOptions);

      // Apply random ordering if requested
      if (random === 'true') {
        articles = articles.sort(() => Math.random() - 0.5);
        // Limit after randomization
        articles = articles.slice(0, parseInt(pageSize));
      }

      // Apply search filter if provided
      if (search) {
        const normalizeText = (text) => {
          return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[¡!¿?]/g, '') // Remove punctuation
            .replace(/[^\w\s]/g, '') // Remove special characters
            .trim();
        };
        
        const normalizedSearchTerm = normalizeText(search);
        
        articles = articles.filter(article => {
          // Search in article title
          const titleMatch = article.title && 
            normalizeText(article.title).includes(normalizedSearchTerm);
          
          // Search in category name
          const categoryMatch = article.category && 
            article.category.name && 
            normalizeText(article.category.name).includes(normalizedSearchTerm);
          
          // Search in main category name
          const mainCategoryMatch = article.main_category && 
            article.main_category.name && 
            normalizeText(article.main_category.name).includes(normalizedSearchTerm);
          
          // Search in sub categories
          const subCategoriesMatch = article.sub_categories && 
            article.sub_categories.some(subCat => 
              subCat.name && 
              normalizeText(subCat.name).includes(normalizedSearchTerm)
            );
          
          return titleMatch || categoryMatch || mainCategoryMatch || subCategoriesMatch;
        });
      }

      // Enrich articles with stats and user interaction
      const enrichedArticles = await Promise.all(
        articles.map(async (article) => {
          // Get stats for all articles (counts)
          const [likesCount, commentsCount] = await Promise.all([
            strapi.db.query('api::like.like').count({
              where: { article: article.id }
            }),
            strapi.db.query('api::comment.comment').count({
              where: { article: article.id }
            })
          ]);

          // Base enriched article
          const enrichedArticle = {
            ...article,
            stats: {
              likesCount,
              commentsCount
            },
            userInteraction: null // Default for non-authenticated users
          };

          // Add user interaction info if authenticated
          if (userId) {
            const [userLike, userComment] = await Promise.all([
              strapi.db.query('api::like.like').findOne({
                where: { 
                  article: article.id,
                  user: userId 
                },
                populate: ['type']
              }),
              strapi.db.query('api::comment.comment').findOne({
                where: { 
                  article: article.id,
                  author: userId 
                }
              })
            ]);

            enrichedArticle.userInteraction = {
              liked: !!userLike,
              commented: !!userComment,
              likedTypes: userLike ? [{
                id: userLike.type?.id,
                code: userLike.type?.code,
                displayName: userLike.type?.display_name,
                icon: userLike.type?.icon,
                color: userLike.type?.color
              }] : []
            };
          }

          return enrichedArticle;
        })
      );

      // Get total count for pagination (before applying random limit)
      const totalCount = await strapi.db.query('api::article.article').count({
        where: whereClause
      });

      return ctx.send({
        data: enrichedArticles,
        meta: {
          total: random === 'true' ? enrichedArticles.length : totalCount,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: random === 'true' ? 1 : Math.ceil(totalCount / parseInt(pageSize)),
          filters: {
            search,
            category,
            main_category,
            sub_category,
            random: random === 'true',
            featured,
            featuredMain
          },
          hasUserInteraction: !!userId
        }
      });

    } catch (error) {
      console.error('Error in findEnhanced:', error);
      return ctx.badRequest('Error fetching enhanced articles: ' + error.message);
    }
  },

  // Enhanced findOne method
  async findOneEnhanced(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id;

    try {
      // Get article with basic relations
      const article = await strapi.db.query('api::article.article').findOne({
        where: { id },
        populate: {
          cover: true,
          category: {
            select: ['id', 'name', 'slug']
          },
          main_category: {
            select: ['id', 'name', 'slug']
          },
          sub_categories: {
            select: ['id', 'name', 'slug']
          },
          author: {
            select: ['id', 'name', 'slug']
          }
        }
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Get stats
      const [likesCount, commentsCount] = await Promise.all([
        strapi.db.query('api::like.like').count({
          where: { article: article.id }
        }),
        strapi.db.query('api::comment.comment').count({
          where: { article: article.id }
        })
      ]);

      // Base enriched article
      const enrichedArticle = {
        ...article,
        stats: {
          likesCount,
          commentsCount
        },
        userInteraction: null
      };

      // Add user interaction if authenticated
      if (userId) {
        const [userLike, userComment] = await Promise.all([
          strapi.db.query('api::like.like').findOne({
            where: { 
              article: article.id,
              user: userId 
            },
            populate: ['type']
          }),
          strapi.db.query('api::comment.comment').findOne({
            where: { 
              article: article.id,
              author: userId 
            }
          })
        ]);

        enrichedArticle.userInteraction = {
          liked: !!userLike,
          commented: !!userComment,
          likedTypes: userLike ? [{
            id: userLike.type?.id,
            code: userLike.type?.code,
            displayName: userLike.type?.display_name,
            icon: userLike.type?.icon,
            color: userLike.type?.color
          }] : []
        };
      }

      return ctx.send({
        data: enrichedArticle
      });

    } catch (error) {
      console.error('Error in findOneEnhanced:', error);
      return ctx.badRequest('Error fetching enhanced article: ' + error.message);
    }
  }
}));
