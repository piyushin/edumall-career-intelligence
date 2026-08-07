# Hostinger Production Operations Runbook

This runbook covers day-to-day operations for the Hostinger VPS production stack at `career.theedumall.com`.

It is not a product launch approval. Phase 0 production must stay in pilot mode until CTO/business-owner approval.

## Operating Principles

- Deploy only explicit approved commit SHAs.
- Keep `.env.production` only on the VPS with `600` permissions.
- Keep PostgreSQL and Redis private on the Docker network.
- Publish only `127.0.0.1:3100` for web and `127.0.0.1:3101` for API.
- Let host-level Nginx own ports `80` and `443`.
- Do not bind Docker to host port `3000`.
- Do not modify `club.theedumall.com` while operating this stack.
- Preserve named volumes during deployment and rollback.
- Back up PostgreSQL before every schema migration or risky maintenance.
- Do not run database-destructive commands from deploy or rollback scripts.
- Keep registration and assessment delivery disabled until CTO approval.
- Record every manual operation with timestamp, operator, commit SHA, and result.

## Standard Paths

```text
/opt/edumall-career/repo
/opt/edumall-career/repo/.env.production
/opt/edumall-career/backups/postgres
/etc/nginx/sites-available/career.theedumall.com
/etc/nginx/sites-enabled/career.theedumall.com
```

## Environment File

Required variables:

```text
NODE_ENV
APP_ENV
APP_VERSION
PUBLIC_WEB_URL
PUBLIC_API_URL
CORS_ALLOWED_ORIGINS
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
REDIS_URL
SESSION_SECRET
LOG_LEVEL
PILOT_MODE
PUBLIC_REGISTRATION_ENABLED
ASSESSMENT_DELIVERY_ENABLED
REPORT_WORKER_CONCURRENCY
```

Initial values must include:

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

Use `APP_VERSION` as the deployed commit SHA. The deploy and rollback scripts export it from the explicit SHA argument.

## Compose Commands

Set a helper alias during an operations session:

```bash
alias edumall-compose='docker compose --env-file .env.production -p edumall-career-production -f infrastructure/docker/docker-compose.production.yml'
```

Validate configuration:

```bash
edumall-compose config
```

Show services:

```bash
edumall-compose ps
```

Follow logs:

```bash
edumall-compose logs -f --tail=100
```

## Nginx Operations

Bootstrap first certificate issuance:

```bash
sudo cp infrastructure/nginx/career.bootstrap.conf /etc/nginx/sites-available/career.theedumall.com
sudo ln -sfn /etc/nginx/sites-available/career.theedumall.com /etc/nginx/sites-enabled/career.theedumall.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/certbot -d career.theedumall.com --email <operations-email> --agree-tos --no-eff-email
```

Install final HTTPS config:

```bash
sudo cp infrastructure/nginx/career.theedumall.com.conf /etc/nginx/sites-available/career.theedumall.com
sudo nginx -t
sudo systemctl reload nginx
```

Do not edit or reload unrelated site files except through their own approved change process.

## Deployment Procedure

1. Confirm the approved commit SHA.
2. Confirm production window, rollback owner, and monitoring owner.
3. Confirm `.env.production` safety flags are still locked down.
4. Back up PostgreSQL if the database already exists:

   ```bash
   BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
   ```

5. Run:

   ```bash
   cd /opt/edumall-career/repo
   ./scripts/deploy-production.sh <approved-commit-sha>
   ```

6. Verify:

   ```bash
   ./scripts/health-check-production.sh
   edumall-compose ps
   ```

7. Record deployed commit, operator, validation result, and any anomalies.

## Rollback Procedure

1. Confirm the previous known-good commit SHA.
2. Run:

   ```bash
   ./scripts/rollback-production.sh <previous-commit-sha>
   ```

3. Verify `/`, `/status`, `/api/health`, and `/api/ready`.
4. Record rollback reason and result.

Rollback preserves PostgreSQL and Redis volumes and restarts only application services where possible.

## Backup Procedure

Run before schema migrations, risky maintenance, and on the approved backup cadence:

```bash
BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
```

Verify:

```bash
ls -lh /opt/edumall-career/backups/postgres
```

Backups use compressed PostgreSQL custom format and restricted file permissions.

## Restore Procedure

Restore requires downtime, typed confirmation, and CTO approval:

```bash
./scripts/restore-postgres.sh /opt/edumall-career/backups/postgres/<backup-file>.dump.gz
```

After restore:

```bash
./scripts/health-check-production.sh
edumall-compose logs --tail=100 api
edumall-compose logs --tail=100 worker
```

Never run restore automatically from CI.

## Health Checks

Local checks:

```bash
curl -fsS http://127.0.0.1:3100
curl -fsS http://127.0.0.1:3100/status
curl -fsS http://127.0.0.1:3101/health
curl -fsS http://127.0.0.1:3101/ready
```

Public checks:

```bash
curl -fsS https://career.theedumall.com
curl -fsS https://career.theedumall.com/api/health
curl -fsS https://career.theedumall.com/api/ready
```

Container checks:

```bash
edumall-compose ps
docker inspect --format '{{json .State.Health}}' "$(edumall-compose ps -q api)"
```

Expected readiness:

- Web `/status`: HTTP `200`.
- API `/api/health`: HTTP `200`.
- API `/api/ready`: HTTP `200` only when PostgreSQL and Redis are reachable.

## Logs

Inspect individual services:

```bash
edumall-compose logs --tail=200 web
edumall-compose logs --tail=200 api
edumall-compose logs --tail=200 worker
edumall-compose logs --tail=200 postgres
edumall-compose logs --tail=200 redis
sudo journalctl -u nginx --since "30 minutes ago"
```

Log rotation is configured in Docker Compose with `max-size` and `max-file`.

## Secret Rotation

General steps:

1. Schedule a maintenance window.
2. Back up PostgreSQL if database credentials change.
3. Edit `.env.production` on the VPS only.
4. Restart affected services.
5. Verify health.
6. Record the rotation.

Do not pass secrets as command-line arguments.

## TLS Operations

Certbot obtains and renews certificates for host Nginx.

Troubleshooting checklist:

- DNS `A` record points to the VPS IP.
- UFW allows `80/tcp` and `443/tcp`.
- Nginx owns public ports `80` and `443`.
- Certificate paths under `/etc/letsencrypt/live/career.theedumall.com/` exist.
- `sudo nginx -t` succeeds before reload.
- The bootstrap config is used before the first certificate exists.

Commands:

```bash
sudo certbot renew --dry-run
sudo nginx -t
sudo systemctl reload nginx
curl -I https://career.theedumall.com
```

## Disk and Volume Operations

Monitor:

```bash
df -h
docker system df
du -sh /opt/edumall-career
du -sh /opt/edumall-career/backups/postgres
```

Safe cleanup:

```bash
docker image prune
```

Do not remove named volumes unless CTO approval and a tested backup exist.

## Memory Operations

Monitor:

```bash
free -h
docker stats --no-stream
```

Keep `REPORT_WORKER_CONCURRENCY=1` on the 4 GB VPS until load testing supports a change.

## Enable Registration Later

Registration remains disabled by default. To enable it later:

1. Obtain CTO/business-owner approval.
2. Confirm privacy, consent, support, and account-review readiness.
3. Back up PostgreSQL.
4. Change `PUBLIC_REGISTRATION_ENABLED=true` in `.env.production`.
5. Deploy a reviewed commit that relaxes the deploy-script guard.
6. Restart affected services and verify with test accounts.

## Enable Assessment Delivery Later

Assessment delivery remains disabled by default. To enable it later:

1. Obtain CTO/business-owner approval and psychometric signoff.
2. Confirm approved content, scoring versions, norm tables, and interpretation rules.
3. Confirm parent consent controls for minors.
4. Back up PostgreSQL.
5. Change `ASSESSMENT_DELIVERY_ENABLED=true` in `.env.production`.
6. Deploy a reviewed commit that relaxes the deploy-script guard.
7. Monitor attempts, audit events, sensitive alerts, and support channels.

## Security Checks

Regularly verify:

- Docker does not publish host ports `80`, `443`, or `3000`.
- Only web and API publish localhost ports `3100` and `3101`.
- PostgreSQL and Redis expose only Docker-internal ports.
- `.env.production` is mode `600`.
- Backups directory is mode `700`.
- SSH password login remains disabled after key login is verified.
- UFW allows only SSH, HTTP, and HTTPS.
- GitHub Actions deploy workflow remains `workflow_dispatch` only.
- GitHub `production` environment requires manual approval.

Commands:

```bash
ss -tulpn
sudo ufw status verbose
docker ps --format "table {{.Names}}\t{{.Ports}}"
stat -c "%a %n" .env.production /opt/edumall-career/backups/postgres
```

## Incident Response

### Web Unavailable

1. Check Nginx and web health.
2. Inspect Nginx logs and web logs.
3. Check DNS and certificate status.
4. Roll back if the issue follows a deployment.

### API Not Ready

1. Check `/api/health`.
2. Check `/api/ready`.
3. Inspect API logs.
4. Inspect PostgreSQL and Redis health.
5. Do not reset volumes as a first response.

### Disk Full

1. Stop deployments.
2. Check Docker disk usage and backup size.
3. Prune unused images only after confirming rollback requirements.
4. Expand disk or remove expired backups under approved retention policy.

### Memory Pressure

1. Confirm `REPORT_WORKER_CONCURRENCY=1`.
2. Check `docker stats --no-stream`.
3. Inspect API and worker logs.
4. Pause nonessential report generation if needed.

### Suspected Secret Exposure

1. Preserve logs and timestamps.
2. Rotate affected secrets.
3. Review GitHub secrets, `.env.production`, and SSH keys.
4. Rebuild/restart affected services.
5. Record incident details and corrective action.

### Suspected Data Loss

1. Stop web, API, and worker.
2. Preserve PostgreSQL volume.
3. Identify latest valid backup.
4. Restore only after CTO approval and typed confirmation.
5. Validate health and data integrity.

## Remaining VPS Information Required

Before the first real production deployment, collect:

- VPS IP address.
- SSH port.
- Deployment username.
- Deployment SSH key ownership and rotation plan.
- Docker and Docker Compose versions on the VPS.
- DNS status for `career.theedumall.com`.
- Current host Nginx site inventory.
- Operations email for Certbot.
- Final `.env.production` secret values.
- Approved initial admin/test accounts.
- Backup retention window.
- Named owners for deployment, incident response, security review, and privacy review.
