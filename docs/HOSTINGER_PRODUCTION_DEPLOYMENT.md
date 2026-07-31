# Hostinger Production Deployment Guide

This guide prepares the Phase 0 production deployment for The EduMall Career Intelligence Platform on a Hostinger VPS running Ubuntu 24.04.

This is a deployment configuration guide only. It does not approve a public product launch, real student data collection, real assessment delivery, psychiatric diagnosis, automated adverse employment decisions, or changes to psychometric/business logic.

## Target

- Repository: `piyushin/edumall-career-intelligence`
- Deployment branch: `phase-0/hostinger-staging-deployment`
- Production domain: `career.theedumall.com`
- Host reverse proxy: existing host-level Nginx
- Docker Compose project: `edumall-career-production`
- Compose file: `infrastructure/docker/docker-compose.production.yml`
- Environment file on VPS: `/opt/edumall-career/repo/.env.production`
- Public host ports: `80` and `443`, owned by Nginx
- Web binding: `127.0.0.1:3100 -> web container port 3000`
- API binding: `127.0.0.1:3101 -> api container port 3001`
- PostgreSQL: Docker internal network only
- Redis: Docker internal network only
- Worker: Docker internal network only, no published port

Do not bind Docker to host ports `80`, `443`, or `3000`. Do not edit or replace the existing `club.theedumall.com` Nginx configuration.

## Architecture

```text
Internet
  |
  | HTTPS :443 / HTTP :80
  v
Host Nginx
  |-- /api/* -> http://127.0.0.1:3101/ with /api stripped
  |-- /*     -> http://127.0.0.1:3100

Docker private network
  |-- web    -> localhost bind 127.0.0.1:3100 only
  |-- api    -> localhost bind 127.0.0.1:3101 only
  |-- worker -> postgres, redis
  |-- postgres volume
  |-- redis volume
```

## Production Safety Defaults

The initial production configuration must keep these controls enabled until explicit CTO approval:

- `PILOT_MODE=true`
- `PUBLIC_REGISTRATION_ENABLED=false`
- `ASSESSMENT_DELIVERY_ENABLED=false`
- `REPORT_WORKER_CONCURRENCY=1`
- Approved admin/test accounts only
- No real student data
- PostgreSQL backup before every schema migration
- Rollback tested before public launch

## 1. Identify the VPS IP

In Hostinger hPanel:

1. Open **VPS**.
2. Select the target server.
3. Copy the displayed IPv4 address from the VPS overview.
4. Confirm `career.theedumall.com` has an `A` record pointing to this IP.

Verify DNS:

```bash
dig +short career.theedumall.com
```

## 2. Use Hostinger Browser Terminal

Use Browser Terminal only for bootstrap or break-glass access:

1. Open hPanel.
2. Open **VPS**.
3. Select the server.
4. Click **Browser terminal**.
5. Log in with the SSH credentials shown by Hostinger.

Prefer SSH-key login for regular operations.

## 3. Connect by SSH

For initial bootstrap:

```bash
ssh root@<vps-ip>
```

If Hostinger uses a custom SSH port:

```bash
ssh -p <ssh-port> root@<vps-ip>
```

Use root only for bootstrap. Deployments should run as a non-root deployment user.

## 4. Create a Non-Root Deployment User

Run as root:

```bash
adduser deploy
usermod -aG sudo deploy
```

Use a strong temporary password. The user should later authenticate by SSH key.

## 5. Install an SSH Public Key

Run as root:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Paste only the public key. Never paste a private key onto the server.

## 6. Verify SSH-Key Login

Before changing SSH security settings, open a new local terminal:

```bash
ssh -i ~/.ssh/edumall-production deploy@<vps-ip>
```

Verify:

```bash
whoami
sudo -v
```

Proceed only after key login succeeds.

## 7. Disable Direct Root-Password Login

Only after key login is verified:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date -u +%Y%m%dT%H%M%SZ)
sudo nano /etc/ssh/sshd_config
```

Set or confirm:

```text
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
```

Validate and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

Keep the current session open until a new SSH-key session succeeds.

## 8. Configure UFW

Allow SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

If SSH uses a custom port:

```bash
sudo ufw allow <ssh-port>/tcp
```

Do not expose PostgreSQL, Redis, API, worker, web, port `3000`, port `3100`, or port `3101` through UFW.

## 9. Verify Docker and Docker Compose

Verify the installed versions:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

The target facts for this VPS are Docker `29.1.3`, Docker Compose `2.40.3`, Git `2.43.0`, and Ubuntu `24.04.2 LTS`.

## 10. Grant Docker Access Safely

Docker group membership grants root-equivalent control over containers. Add only trusted deployment users:

```bash
sudo usermod -aG docker deploy
```

Log out and back in, then verify:

```bash
docker ps
```

If Docker access is not granted, use a documented `sudo docker` operational model instead.

## 11. Clone the Private GitHub Repository

Use a GitHub deploy key or approved machine user. Do not embed a token in shell history.

```bash
sudo mkdir -p /opt/edumall-career
sudo chown deploy:deploy /opt/edumall-career
cd /opt/edumall-career
git clone git@github.com:piyushin/edumall-career-intelligence.git repo
cd repo
git fetch origin
git switch phase-0/hostinger-staging-deployment
```

## 12. Create `/opt/edumall-career`

Recommended layout:

```text
/opt/edumall-career/
  repo/                  Git checkout
  backups/postgres/      Restricted PostgreSQL backups
```

Permissions:

```bash
sudo mkdir -p /opt/edumall-career/backups/postgres
sudo chown -R deploy:deploy /opt/edumall-career
chmod 750 /opt/edumall-career
chmod 700 /opt/edumall-career/backups/postgres
```

## 13. Create the Production `.env` File Securely

Copy the template:

```bash
cd /opt/edumall-career/repo
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Replace every placeholder. Never commit `.env.production`.

Generate `SESSION_SECRET` on the server or an approved secret workstation:

```bash
openssl rand -hex 32
```

Keep `DATABASE_URL` aligned with `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.

Required initial safety values:

```text
NODE_ENV=production
APP_ENV=production
PUBLIC_WEB_URL=https://career.theedumall.com
PUBLIC_API_URL=https://career.theedumall.com/api
CORS_ALLOWED_ORIGINS=https://career.theedumall.com
PILOT_MODE=true
PUBLIC_REGISTRATION_ENABLED=false
ASSESSMENT_DELIVERY_ENABLED=false
REPORT_WORKER_CONCURRENCY=1
```

## 14. Recommended File Permissions

```bash
chmod 600 /opt/edumall-career/repo/.env.production
chmod 700 /opt/edumall-career/backups/postgres
find /opt/edumall-career/repo/scripts -type f -name "*.sh" -exec chmod 750 {} \;
```

Only the deployment user and approved administrators should read secrets.

## 15. Install the Nginx Bootstrap Configuration

The bootstrap config serves HTTP and the ACME challenge before the certificate exists.

```bash
sudo install -d -m 755 /var/www/certbot
sudo cp infrastructure/nginx/career.bootstrap.conf /etc/nginx/sites-available/career.theedumall.com
sudo ln -sfn /etc/nginx/sites-available/career.theedumall.com /etc/nginx/sites-enabled/career.theedumall.com
sudo nginx -t
sudo systemctl reload nginx
```

This creates or updates only the `career.theedumall.com` site file. Do not edit `club.theedumall.com`.

## 16. Issue the Certbot Certificate

Install Certbot if needed:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

Issue the certificate using the webroot challenge:

```bash
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d career.theedumall.com \
  --email <operations-email> \
  --agree-tos \
  --no-eff-email
```

Expected certificate paths:

```text
/etc/letsencrypt/live/career.theedumall.com/fullchain.pem
/etc/letsencrypt/live/career.theedumall.com/privkey.pem
```

## 17. Install the Final HTTPS Nginx Configuration

After the certificate exists:

```bash
sudo cp infrastructure/nginx/career.theedumall.com.conf /etc/nginx/sites-available/career.theedumall.com
sudo nginx -t
sudo systemctl reload nginx
```

The final config redirects HTTP to HTTPS, proxies `/api/` to `127.0.0.1:3101`, proxies all other requests to `127.0.0.1:3100`, sets secure headers, enables gzip, and keeps directory browsing off.

## 18. Start the Production Stack

Run a backup first if a database already exists:

```bash
BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
```

Deploy only an explicit approved commit SHA:

```bash
cd /opt/edumall-career/repo
./scripts/deploy-production.sh <approved-40-character-commit-sha>
```

The script:

- Fetches origin safely.
- Verifies the commit exists.
- Checks out the exact commit in detached-head mode.
- Validates `.env.production`.
- Validates Docker Compose configuration.
- Builds app images.
- Starts `postgres`, `redis`, `web`, `api`, and `worker`.
- Waits for health checks.
- Verifies local and public health endpoints.
- Prints the deployed commit and service status.

## 19. Verify Containers

```bash
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml ps
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected host bindings:

- `127.0.0.1:3100->3000/tcp` for web
- `127.0.0.1:3101->3001/tcp` for API
- No PostgreSQL host port
- No Redis host port
- No worker host port
- No Docker binding to host ports `80`, `443`, or `3000`

## 20. Inspect Logs

```bash
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml logs --tail=100 api
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml logs --tail=100 web
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml logs --tail=100 worker
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml logs --tail=100 postgres
docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml logs --tail=100 redis
sudo journalctl -u nginx --since "30 minutes ago"
```

Do not paste secrets from logs into tickets or chat.

## 21. Verify `/health`

Local API:

```bash
curl -fsS http://127.0.0.1:3101/health
```

Public API through Nginx:

```bash
curl -fsS https://career.theedumall.com/api/health
```

Expected result: JSON with service `api`, status `ok`, environment `production`, and the deployed commit as version.

## 22. Verify `/ready`

Local API:

```bash
curl -fsS http://127.0.0.1:3101/ready
```

Public API through Nginx:

```bash
curl -fsS https://career.theedumall.com/api/ready
```

Expected result: HTTP `200` when PostgreSQL and Redis are reachable from the API container.

## 23. Verify HTTPS

```bash
curl -I https://career.theedumall.com
curl -I https://career.theedumall.com/api/health
```

Check:

- Valid certificate for `career.theedumall.com`.
- HTTP redirects to HTTPS.
- `Strict-Transport-Security` header.
- `X-Content-Type-Options` header.
- No internal Docker service ports exposed publicly.

## 24. Deploy an Approved Commit

Use only a reviewed full SHA:

```bash
./scripts/deploy-production.sh <approved-commit-sha>
```

Do not deploy a moving branch name. The script intentionally deploys a detached exact commit.

## 25. Roll Back to a Specific Commit

Use a previously deployed known-good commit:

```bash
./scripts/rollback-production.sh <previous-commit-sha>
```

Rollback preserves PostgreSQL and Redis volumes and rebuilds/restarts only application services where possible.

## 26. Back Up PostgreSQL

```bash
BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
```

Backups are timestamped compressed PostgreSQL custom-format dumps with restricted permissions.

## 27. Restore PostgreSQL

Restoration is destructive for current database objects and requires downtime:

```bash
./scripts/restore-postgres.sh /opt/edumall-career/backups/postgres/<backup-file>.dump.gz
```

The script validates the backup and requires typed confirmation before restoring. Never run restore automatically from CI.

## 28. Stop and Restart Services

Set a temporary helper:

```bash
alias edumall-compose='docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml'
```

Stop application services:

```bash
edumall-compose stop web api worker
```

Restart application services:

```bash
edumall-compose up -d web api worker
```

Stop the full stack without deleting volumes:

```bash
edumall-compose stop
```

## 29. Rotate Secrets

1. Schedule a maintenance window.
2. Back up PostgreSQL if database credentials change.
3. Edit `.env.production` on the VPS only.
4. Restart affected services.
5. Verify `/api/ready`.
6. Record the rotation in the operations log.

Do not pass secrets as command-line arguments. For PostgreSQL password rotation, schedule downtime unless a tested dual-password procedure exists.

## 30. Renew or Troubleshoot HTTPS

Certbot renews certificates through host Nginx.

Verify renewal:

```bash
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot
```

Troubleshooting checklist:

- DNS points to the VPS IP.
- UFW allows `80/tcp` and `443/tcp`.
- Host Nginx owns ports `80` and `443`.
- The bootstrap config is installed for first issuance.
- Certificate files exist under `/etc/letsencrypt/live/career.theedumall.com/`.
- `sudo nginx -t` succeeds before reload.

Reload safely:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 31. Monitor Disk Usage

```bash
df -h
du -sh /opt/edumall-career
du -sh /opt/edumall-career/backups/postgres
docker system df
```

Watch Docker images, container logs, PostgreSQL volume growth, Redis volume growth, and backups.

## 32. Monitor Memory

```bash
free -h
docker stats --no-stream
```

The 4 GB VPS should keep report generation concurrency at `1`.

## 33. Prune Unused Docker Images Safely

After confirming rollback targets can still be rebuilt:

```bash
docker image prune
```

Avoid broad prune commands during incidents. Do not remove named volumes unless a restore plan is approved and tested.

## 34. Enable Registration Later

Only after CTO/business-owner approval:

1. Confirm privacy, consent, and support readiness.
2. Back up PostgreSQL.
3. Update `.env.production`:

   ```text
   PUBLIC_REGISTRATION_ENABLED=true
   ```

4. Commit any required application support separately.
5. Restart affected services.
6. Verify the registration journey with test accounts.

The current deploy script enforces registration disabled. Changing that control requires an explicit reviewed commit.

## 35. Enable Assessments Later

Only after CTO/business-owner approval and psychometric review:

1. Confirm approved assessment content and scoring-model versions.
2. Confirm parent consent controls for minors.
3. Back up PostgreSQL.
4. Update `.env.production`:

   ```text
   ASSESSMENT_DELIVERY_ENABLED=true
   ```

5. Run readiness and audit checks.
6. Monitor attempts, audit events, and support queues.

The current deploy script enforces assessment delivery disabled. Changing that control requires an explicit reviewed commit.

## 36. Incident and Recovery Steps

1. Identify impact: web down, API down, database unavailable, TLS issue, disk full, memory pressure, or suspected compromise.
2. Preserve evidence: do not delete logs, containers, or volumes until triage is complete.
3. Run:

   ```bash
   ./scripts/health-check-production.sh
   ```

4. Inspect Nginx and service logs.
5. Verify disk and memory.
6. If the issue followed a deployment, roll back to the last known-good commit.
7. If data loss is suspected, stop app services and consult CTO/security before restore.
8. Record timeline, commands run, commit SHA, symptoms, impact, and recovery result.
9. Complete a post-incident review before opening production to broader users.

## GitHub Actions Manual Deployment

The workflow `.github/workflows/deploy-production.yml` is manual only.

Required repository secrets:

- `HOSTINGER_VPS_HOST`
- `HOSTINGER_VPS_USER`
- `HOSTINGER_VPS_SSH_PORT`
- `HOSTINGER_VPS_SSH_KEY`

Required GitHub environment:

- `production`, configured with required reviewers before execution.

Required input:

- `commit_sha`: full 40-character approved commit SHA.

The workflow SSHes to `/opt/edumall-career/repo` and runs `./scripts/deploy-production.sh <commit_sha>`.

Do not add automatic deployment on push until the CTO approves the release process.

## Remaining VPS Information Required

Collect before first production deployment:

- VPS IP address.
- SSH port.
- Deployment username.
- Deployment SSH key ownership and rotation plan.
- DNS status for `career.theedumall.com`.
- Operations email for Certbot.
- Confirmation of existing Nginx site files, including `club.theedumall.com`.
- Final `.env.production` secret values.
- Approved initial admin/test account list.
- Backup retention window.
- Named owners for deployment, incident response, privacy review, and security review.
