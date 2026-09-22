# Put the dashboard online

Status: deployment files are prepared; no hosting, domain, remote database or HTTPS endpoint has been provisioned. Local MongoDB and the dashboard remain on your Mac.

## 1. Choose the hosting accounts

This package uses one Linux server with Docker Engine and the Docker Compose plugin, a domain/subdomain you control, and a hosted MongoDB replica set (for example MongoDB Atlas). The replica set is required because account recovery and executive changes use database transactions.

Create the hosting accounts in your own name, then provide the server provider and intended domain. Keep passwords, database credentials and recovery codes private. Hosting plans and costs should be checked with the selected provider before purchasing. Your database must allow connections from the server's outbound IP.

## 2. Prepare the server and database

Install Docker Engine and Compose using the [official Docker installation guide](https://docs.docker.com/engine/install/). Transfer the project source to the server, excluding node_modules, .local, .env files and spreadsheet exports. The Docker image builds the frontend and installs its own dependencies.

Before switching users to production, back up the local sales_operations database and restore it into an empty production sales_operations database using MongoDB Database Tools. Preserve IDs, indexes, sales, targets, mappings and accounts. Do not migrate loginsessions or passwordrecoveries: everyone should sign in again. Do not overwrite an existing production database. Keep the local source database until the remote totals and IDs have been checked. Migration is still pending and should be performed once the production database is selected.

Create a DNS A record for your dashboard domain pointing to the server IP. Configure the server firewall to allow HTTPS (443) and HTTP (80); keep the app's 3001 port and MongoDB private. Limit SSH to administrators. This Compose file publishes only the reverse proxy.

## 3. Configure and start

From the project directory on the server:

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
openssl rand -hex 24
```

Edit deploy/.env privately. Set DASHBOARD_DOMAIN without a protocol/path, MONGODB_URI for the remote database and ADMIN_SETUP_CODE to the generated random value. URI-encode special characters in database credentials. The setup code is only needed if the database has no accounts.

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml ps
```

Open https://YOUR_DOMAIN. Caddy requests and renews certificates automatically when DNS and network access are correct; see [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https). Certificate storage persists in Docker volumes. The app requires HTTPS configuration and secure session cookies in production.

If accounts were migrated, use your existing login. Otherwise enter the setup code and create your analyst account. Remove ADMIN_SETUP_CODE from deploy/.env after setup, then rerun the up command. In Manage access, create region-specific RBM accounts and a second trusted analyst account for recovery coverage.

## 4. Check before sharing access

- Confirm https://YOUR_DOMAIN/api/health reports connected.
- Check Lagos: 219 transactions / ₦5,716,850; North: 87 / ₦2,328,850; South West / South East: 245 / ₦4,860,850 for September 1–11, 2026 (current accepted baseline).
- Verify a North RBM can access North and cannot access other regions or account administration.
- Test sign out, password recovery and disabling a test account. Check mobile display.
- Enable database backups through your database provider and test restoration before relying on them.

## Account management

Manage access lets analysts create users, enable/disable accounts and issue recovery codes. Disabling immediately invalidates existing sessions. Re-enabling requires a fresh login. Self-disable and disabling the last active analyst are blocked.

For a forgotten password, an analyst issues a recovery code and shares it directly with the account owner through an approved private channel. The owner selects Forgot password on the login page, enters their email/code/new password and signs in again. Codes expire after 30 minutes, work once and are stored hashed. Recovery invalidates existing sessions. Email delivery is not configured.

Change password requires the current password and signs the user out on success. Passwords require at least 12 characters and at most 72 UTF-8 bytes.

If all analysts lose their passwords, a server administrator can issue a recovery code from the project container:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec app node server/scripts/issue-recovery.js analyst@example.com
```

The command prints a sensitive, one-use code only to that operator's terminal. Share it privately with the verified account owner. It cannot enable a disabled account.

## Updates

Back up the database, transfer reviewed source changes, then run the same up command with --build. Validate health and regional totals again. Keep the prior source version for rollback. Do not delete Caddy's persistent volumes. The container image has not been built locally because Docker is not installed on this Mac; validate the build on the chosen server before launch.
