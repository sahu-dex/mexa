# MEXA MOTION — unfinished platform implementation

**Do not deploy this application for production or handle real money or personal information yet.** This is a partially implemented application and has not been tested against MySQL, a real payment gateway, or a browser. It has not undergone a security audit. The original video-agency demo is preserved in `../static-site`; it has not been integrated into the new platform.

## Implemented code (not yet integration-tested)

A PHP/PDO catalogue, registration and login, customer dashboard, manual orders, wallet/ledger, manual payment requests and admin approval, support tickets, plain-text blog, basic user status management, catalogue management and homepage settings. Orders are handled manually; there is no provider connection. Payment approval must be based on independent verification, not the customer's reference alone. No automatic gateway is connected.

Wallet amounts are integer BDT poisha. Order debits, approved deposits, and cancellation refunds use database transactions, row locks and unique ledger references; order and deposit forms use one-time session tokens. These safeguards still need real-database concurrency testing and independent security review before any production use. Services with a zero rate are not orderable. User/admin lists currently show only the latest 100 records (catalogue 200); pagination is not implemented.

## Deployment preparation (not verified on target hosting)

- Requires 64-bit PHP 8.1+ with PDO MySQL and mbstring; MySQL 8 or MariaDB 10.4+ with InnoDB, Apache and mod_rewrite. Actual cPanel capabilities remain unknown.
- Create an empty database and import `database/schema.sql` once through phpMyAdmin. This is a fresh installation schema, not a migration; it will not upgrade any previous installation.
- Copy `app/config.example.php` to `app/config.php` and set database credentials and the actual HTTPS origin. Never commit or expose this file. Configure the domain document root to `platform/public`, **not** `platform`. Keep `app`, `bin`, and `database` outside the public document root.
- If the document root cannot be changed, keep the application outside `public_html`, copy only `platform/public` contents to the document root, and adjust the `require` paths in `index.php` to the private application location. Verify that private paths are not reachable before proceeding. Never expose the whole project in `public_html`.
- Create an administrator via `php bin/create-admin.php` on a secure terminal. No default password exists. Without CLI access, this initialization process is not currently available; arrange a trusted CLI-capable environment rather than exposing the script through the web.
- Configure HTTPS, file permissions, server-side logs, backup and recovery. Prune old `login_attempts` records with a scheduled task. No web-accessible setup script is provided.

## Known gaps and limitations

- Provider API, service synchronization, status sync, provider balance, API logs and automatic bKash/Nagad payment integration are not implemented. Credentials alone will not enable them.
- Affiliate/referral system, notifications, email verification/reset/templates, SEO management, a complete CMS, navigation/media upload management, RBAC beyond admin/user, pagination, backup tooling and many requested public pages are not implemented.
- Manual payments are disabled until an administrator enters payment instructions in settings. They have no gateway verification and are not ready for real payments. No protection against compromised admin accounts or multi-admin approval is implemented. No dispute/reconciliation workflow exists.
- The per-IP login counter is basic and not an atomic distributed limiter; public forms need stronger abuse controls. Password recovery, MFA, email verification, session revocation and complete audit coverage are absent. Security review, threat modelling and integration/concurrency testing are required.
- Hosting compatibility, browser layout, accessibility, existing content migration and original reference desktop/mobile comparison have not been verified. Original MEXA assets have not been migrated to this separate application.

## Tests available

`php tests/commerce_test.php` checks amount parsing and form key generation. Run PHP lint on all PHP files. These unit checks do not test transactions, authentication, database operations, security, or deployment.
