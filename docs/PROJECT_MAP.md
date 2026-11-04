# MEXA MOTION source map

This document is a handoff map for the next developer or coding agent. The application already follows Laravel's standard root layout. Public page templates are Blade files and there are no standalone HTML page templates.

## Main folders

| Path | Responsibility |
| --- | --- |
| `app/Http/Controllers/` | Public page rendering, admin authentication/content actions, image uploads, video library, team profile submissions |
| `app/Http/Middleware/` | Admin and owner authorization (`EnsureAdmin`, `EnsureOwner`) |
| `app/Support/` | Shared site data access, video catalog synchronization, and embed URL resolution |
| `bootstrap/`, `config/` | Laravel bootstrap and application configuration |
| `database/migrations/` | MySQL schema for users, site data, media, video catalog, roles, and approvals |
| `database/seeders/` | Initial data setup; `data/site-snapshot.json` is the bundled starter content |
| `public/css/`, `public/js/` | Browser-ready stylesheets and scripts; loaded directly by Blade templates |
| `resources/views/pages/` | Home, Service, Work, Reviews, Team, Booking, and team-profile Blade pages |
| `resources/views/pages/partials/` | Shared page assets, video assets, and mobile booking markup |
| `resources/views/admin/` | Setup, login, and admin dashboard Blade screens |
| `routes/web.php` | Named public routes, admin routes, and JSON endpoints under `/api/...` |
| `storage/` | Runtime logs, sessions, compiled Blade views, and temporary/cache files; keep generated contents out of source commits |

## Important entry points

### Public website

- `SitePageController` renders `resources/views/pages/{home,service,work,reviews,team,booking}.blade.php`.
- `SiteData` reads the shared `settings`, `services`, `packages`, `team`, `portfolio`, `reviews`, and `bookings` sections from MySQL and merges missing sections with bundled defaults.
- `VideoCatalog` keeps video records and placements aligned with the shared site content. `VideoEmbed` resolves supported providers and safe direct media URLs.
- `SiteApiController` exposes the public content endpoints and the admin save/approval actions.

### Admin and media

- `/admin/setup` is only for creating the first owner. `/admin` is the authenticated dashboard; login and logout are handled by `AdminController`.
- `EnsureAdmin` protects signed-in admin routes. `EnsureOwner` protects owner-only editing, uploads, video-library, and moderator management actions.
- `AdminManagementController` handles review/team approvals and moderator management.
- `ImageUploadController` sends admin images to ImgBB and saves returned URLs in `media_assets`.
- `VideoLibraryController` manages video records and page/service placements.
- `TeamProfileController` accepts profile proposals through the generated private profile link; proposals require approval before publication.

### Page and asset map

| Feature | Primary files |
| --- | --- |
| Home hero and sections | `resources/views/pages/home.blade.php`, `public/css/home-hero.css` |
| Shared public header and mobile menu styling | Page Blade header markup, `public/css/header-restoration.css`, `public/css/mobile-menu.css` |
| Global typography and shared theme | `public/css/site-typography.css`, other `public/css/site-*.css` stylesheets |
| Service and booking presentation | `resources/views/pages/service.blade.php`, `resources/views/pages/booking.blade.php`, `public/css/service-booking-theme.css` |
| Work/review video preview | `public/js/video-preview.js`, `public/css/video-preview.css`, `public/css/video-library.css` |
| Admin UI | `resources/views/admin/dashboard.blade.php`, `public/css/admin.css`, `public/css/admin-management.css`, `public/js/admin.js` |

Page-level Blade files currently contain legacy inline page markup/scripts as well as external asset references. When editing, prefer a small scoped change; move shared code into a partial only when every affected page is updated together.

## Local data and configuration

- Database connection is configured in the ignored `.env`; the starter template is `.env.example`.
- `IMGBB_API_KEY` is read server-side. Never expose it in Blade, JavaScript, page JSON, logs, or commits.
- Initial MySQL setup and deployment guidance are in `README.md`.
- `database/seeders/data/site-snapshot.json` supplies default site content. The seeder adds missing sections; it is not a substitute for a backup of an existing database.
- Preserve the current database when working locally. Avoid destructive reset commands and avoid replacing the local `.env` or `APP_KEY`.
