# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Strapi v5 CMS blog template** designed for deployment on Strapi Cloud. It's a headless CMS backend powering a blog platform with rich content modeling, OAuth authentication, media management, and engagement features.

## Commands

```bash
# Development (with auto-reload)
npm run develop

# Build admin panel, then start dev mode
npm run start:dev

# Build admin panel only
npm run build

# Production start
npm run start

# Seed the database with example data
npm run seed:example

# Deploy to Strapi Cloud
npm run deploy
```

No test suite is configured in this project.

## Architecture

### Content API (`src/api/`)
Content types organized around:
- **Blog content**: `article`, `author`, `category`, `main-category`, `sub-category`, `users-main-category`
- **Engagement**: `comment`, `like`, `interaction-types`, `favorite-list`, `article-rating`
- **Layout/CMS pages**: `banner`, `video-banner`, `footer`, `about-us`, `about-section`
- **Features**: `contact`, `faq`, `subscription-section`, `country`, `metadata-page`
- **Services**: `image-upload`, `multi-provider`, `password`, `global-check`
- **Ownership**: `user-article` — tracks which user created which article
- **Marketing**: `marketing` — Mailchimp integration (no content-type; only controller/service/routes)

Each content type follows the standard Strapi pattern: `schema.json` (data model) + `controllers/`, `services/`, `routes/` directories.

### Configuration (`config/`)
- `database.js` — Supports PostgreSQL (production), MySQL, and SQLite (local dev fallback)
- `plugins.js` — AWS S3 uploads (512MB limit), Resend email, Google/Facebook OAuth strategies, extended user registration fields
- `middlewares.js` — CORS for ports 3000/1337/8080, CSP for S3/CDN, 512MB body limit, custom `auth-transform` and `oauth-callback` middlewares
- `admin.js` — 7-day JWT expiry, OAuth integration disabled (custom implementation used instead)
- `email-templates.js` — Email template definitions

### Custom Middlewares (`src/middlewares/`)
- `auth-transform.js` — Transforms JWT tokens for downstream consumption
- `oauth-callback.js` — Handles OAuth2 provider callbacks (Google, Facebook)

### Authentication
OAuth2 is implemented via Passport.js strategies defined in `src/extensions/users-permissions/`. The admin panel OAuth toggle is **disabled** (`config/admin.js`) — all OAuth logic runs through custom middleware and extension code.

### Shared Components (`src/components/shared/`)
Reusable content blocks used in dynamic zones: `seo`, `media`, `rich-text`, `quote`, `link`, `link-file`, `slider`, `social-media-link`, `input`, `question`.

### Article Content Model
Articles use a **dynamic zone** for body content, allowing mixed blocks of: rich text, media embeds, quotes, and links. Articles support draft/publish workflow with status tracking: `draft → in-review → rejected → approved`.

**Article schema additions (recent):**
- `isFeatured` / `isFeaturedMain` — flags for featured placement; `isFeaturedMain` only visible when `isFeatured = true`
- `users_main_category` — oneToOne relation to `users-main-category` (content from user-generated flow, distinct from editorial `main_category`)
- `global_checks` — manyToMany relation to `global-check`

**Article controller custom endpoints** (`src/api/article/controllers/article.js`):
- `GET /articles?includeLikesCount=true&includeInteractionsCount=true&includeCommentsCount=true` — adds real-time counts to the standard list response
- `POST /articles/:id/toggle-interaction` — toggles `me_gusta` or `me_interesa` for the authenticated user
- `POST /articles/randomize-featured` — Fisher-Yates shuffle: picks up to 3 articles per `main_category` from published+approved articles (excluding those with `users_main_category`) and sets `isFeatured=true` across all locales
- `GET /articles/:id/with-user-interaction` — returns article + current user's interaction state

### Auto Banner Sync (`src/index.js`)
A Document Service middleware registered in `register()` intercepts every `publish` action on `api::article.article`. When an article published today (by `createdAt`) has no `users_main_category`, it is automatically inserted at position 0 of the `mainArticles.articles` slot in every banner matching the article's countries. Uses `strapi.documents()` API (not `strapi.db`) to correctly handle Strapi v5 component updates.

### User-Article Ownership (`src/api/user-article/`)
Tracks which authenticated user created which article. Custom routes (auth required):
- `POST /user-articles/create-article` — creates the article in `draft` status and records ownership
- `GET /user-articles/my-articles?page=&pageSize=&currentStatus=` — paginated list of the current user's articles (filterable by status)

### Users Main Category (`src/api/users-main-category/`)
A localized content type distinct from `main-category`. Fields: `name`, `slug`, `backgroundColor`, `countries` (manyToMany). Used to classify user-generated articles separately from editorial content. When an article has this set, it is excluded from banner auto-sync and `randomize-featured`.

### Article Rating (`src/api/article-rating/`)
IP-based quality rating (no auth required). Schema stores `article_id` (integer), `ip_address` (string), `rating` enum (`cinco_tildes | neutral | sin_tilde`). A **unique DB index** on `(ip_address, article_id)` prevents duplicate ratings — this is enforced at the database level, not in application code (Strapi v5 relation filtering is unreliable for this pattern).

### Marketing (`src/api/marketing/`)
Mailchimp integration with no Strapi content-type. Public routes:
- `POST /marketing/send-newsletter` — subscribes email to a campaign's list (`MAILCHIMP_CAMPAIGN_ID`)
- `POST /marketing/contact` — submits contact form to Mailchimp via form POST
- `POST /marketing/interest` — submits interest form with country + description, tagged `133`

### Database
- **Local dev**: SQLite (auto-configured, no setup needed)
- **Production**: PostgreSQL via `DATABASE_*` environment variables
- Docker Compose file is available for running PostgreSQL locally

### Media Storage
AWS S3 via `@strapi/provider-upload-aws-s3`. All uploads go to S3 in production; a CDN URL (`CDN_BASE_URL`) can be configured separately. Local dev falls back to local filesystem.

`RESOURCES_CDN` (env var) enables URL rewriting in `src/bootstrap.js`: intercepts `upload.service.formatFileInfo` to normalize file URLs to the CDN domain. Also patches `upload.service.upload` to log full AWS S3 diagnostics (provider config, env vars, response) — useful when debugging Strapi Cloud vs S3 provider conflicts.

### Email
Primary: Resend (`strapi-provider-email-resend`). Secondary fallback: Nodemailer. Templates are in `config/email-templates.js`.

### Seed Data
`scripts/seed.js` + `data/data.json` populate the database with example categories, articles, authors, and global config. Media seed files live in `data/uploads/`.

## Environment Variables

Copy `.env.example` to `.env`. Key groups:
- **App secrets**: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`
- **Database**: `DATABASE_CLIENT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_SSL`
- **S3**: `AWS_ACCESS_KEY_ID`, `AWS_ACCESS_SECRET`, `AWS_REGION`, `AWS_BUCKET`, `CDN_BASE_URL`, `RESOURCES_CDN`
- **OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `OAUTH_REDIRECT_URL`
- **Email**: `RESEND_API_KEY`, `EMAIL_FROM`
- **Mailchimp**: `MAILCHIMP_API_KEY`, `MAILCHIMP_CAMPAIGN_ID`

## Documentation

The `/docs/` directory contains detailed integration guides:
- `FRONTEND_INTEGRATION.md` — API usage patterns for frontend consumers
- `OAUTH_SETUP_SUMMARY.md` / `OAUTH_TROUBLESHOOTING.md` — OAuth provider setup
- `LIKE_INTERACTION_API.md` — Engagement API details
- `PASSWORD_RESET_API.md` — Custom password reset flow
- `USER_PROFILE_SERVICE.md` — Extended user profile API
- `IMAGE_UPLOAD_SERVICE.md` — Media upload service docs
