# Agent Guide

Read `README.md` for setup and `docs/PROJECT_MAP.md` before changing application code.

## Project rules

- This is a Laravel 12 / PHP 8.2+ application backed by MySQL. Public pages are Laravel Blade views; do not add standalone `.html` templates.
- Preserve the MEXA MOTION blue visual identity, existing routes, content, responsive behavior, and working interactions unless the task explicitly asks to change them.
- Keep credentials in the local `.env` or deployment secret store. Never print, commit, or copy `.env` values. ImgBB credentials belong in `IMGBB_API_KEY` on the server.
- Treat `site_data` and the related media/video tables as the canonical content stores. Check existing data before adding a new store or duplicating a section.
- Do not run `migrate:fresh`, truncate tables, reseed a populated database, or replace a database file. Back up user data before any authorized schema/data migration.
- Keep public and owner-only admin actions behind their existing middleware. Preserve review and team-profile approval flows.
- CSS and JavaScript are served directly from `public/`; update the Blade references when adding or relocating an asset. There is no frontend build step configured in Composer.
- Keep changes scoped to the requested page/feature. Extract shared Blade partials gradually and verify all pages that use them.
- Do not push, deploy, or make external changes unless the user specifically asks.

## Local development

1. Start XAMPP MySQL (and Apache if using the XAMPP document root).
2. For the Laravel development server, from the repository root run:

   ```powershell
   C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8000
   ```

3. Open `http://127.0.0.1:8000/`. Use the existing local `.env`; do not regenerate its `APP_KEY` on an established database.
4. For a new database only, follow the setup section in `README.md`, then create the first admin at `/admin/setup`.
