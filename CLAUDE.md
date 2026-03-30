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
28 content types organized around:
- **Blog content**: `article`, `author`, `category`, `main-category`, `sub-category`
- **Engagement**: `comment`, `like`, `interaction-types`, `favorite-list`
- **Layout/CMS pages**: `banner`, `video-banner`, `footer`, `about-us`, `about-section`
- **Features**: `contact`, `faq`, `subscription-section`, `country`, `metadata-page`
- **Services**: `image-upload`, `multi-provider`, `password`, `global-check`

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

### Database
- **Local dev**: SQLite (auto-configured, no setup needed)
- **Production**: PostgreSQL via `DATABASE_*` environment variables
- Docker Compose file is available for running PostgreSQL locally

### Media Storage
AWS S3 via `@strapi/provider-upload-aws-s3`. All uploads go to S3 in production; a CDN URL (`CDN_BASE_URL`) can be configured separately. Local dev falls back to local filesystem.

### Email
Primary: Resend (`strapi-provider-email-resend`). Secondary fallback: Nodemailer. Templates are in `config/email-templates.js`.

### Seed Data
`scripts/seed.js` + `data/data.json` populate the database with example categories, articles, authors, and global config. Media seed files live in `data/uploads/`.

## Environment Variables

Copy `.env.example` to `.env`. Key groups:
- **App secrets**: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`
- **Database**: `DATABASE_CLIENT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_SSL`
- **S3**: `AWS_ACCESS_KEY_ID`, `AWS_ACCESS_SECRET`, `AWS_REGION`, `AWS_BUCKET`, `CDN_BASE_URL`
- **OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `OAUTH_REDIRECT_URL`
- **Email**: `RESEND_API_KEY`, `EMAIL_FROM`

## Documentation

The `/docs/` directory contains detailed integration guides:
- `FRONTEND_INTEGRATION.md` — API usage patterns for frontend consumers
- `OAUTH_SETUP_SUMMARY.md` / `OAUTH_TROUBLESHOOTING.md` — OAuth provider setup
- `LIKE_INTERACTION_API.md` — Engagement API details
- `PASSWORD_RESET_API.md` — Custom password reset flow
- `USER_PROFILE_SERVICE.md` — Extended user profile API
- `IMAGE_UPLOAD_SERVICE.md` — Media upload service docs
