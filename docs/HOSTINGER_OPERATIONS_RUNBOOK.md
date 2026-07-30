# Hostinger Staging Operations Runbook

This runbook covers day-to-day operations for the Hostinger VPS staging stack. It is for staging only and must not be used as a production launch checklist.

## Operating Principles

- Deploy only explicit approved commit SHAs.
- Keep `.env.staging` only on the VPS with `600` permissions.
- Keep PostgreSQL and Redis private on the Docker network.
- Preserve named volumes during deployment and rollback.
- Do not run database-destructive commands from deploy or rollback scripts.
- Use synthetic or approved anonymised data only.
- Do not expose internal ports through UFW or Docker `ports`.
- Record every manual operation with timestamp, operator, commit SHA, and result.

## Standard Paths

```text
/opt/edumall-career/repo
/opt/edumall-career/repo/.env.staging
/opt/edumall-career/backups/postgres
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
CADDY_EMAIL
STAGING_DOMAIN
```

Use `APP_VERSION` as the deployed commit SHA. The deploy and rollback scripts export it from the explicit SHA argument.

## Compose Commands

Set a helper alias during an operations session:

```bash
alias edumall-compose='docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml'
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

## Deployment Procedure

1. Confirm the approved commit SHA.
2. Confirm the staging window and reviewer availability.
3. SSH as the non-root deployment user.
4. Run:

   ```bash
   cd /opt/edumall-career/repo
   ./scripts/deploy-staging.sh <approved-commit-sha>
   ```

5. Verify:

   ```bash
   ./scripts/health-check-staging.sh
   edumall-compose ps
   ```

6. Record the deployed commit and result.

## Rollback Procedure

1. Confirm the previous known-good commit SHA.
2. Run:

   ```bash
   ./scripts/rollback-staging.sh <previous-commit-sha>
   ```

3. Verify `/status`, `/api/health`, and `/api/ready`.
4. Record the rollback reason and result.

Rollback preserves PostgreSQL and Redis volumes.

## Backup Procedure

Run before risky maintenance and on a scheduled staging cadence:

```bash
BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
```

Verify:

```bash
ls -lh /opt/edumall-career/backups/postgres
```

Backups use PostgreSQL custom format and restricted file permissions.

## Restore Procedure

Restore requires downtime and typed confirmation:

```bash
./scripts/restore-postgres.sh /opt/edumall-career/backups/postgres/<backup-file>.dump
```

After restore:

```bash
./scripts/health-check-staging.sh
edumall-compose logs --tail=100 api
edumall-compose logs --tail=100 worker
```

Never run restore automatically from CI.

## Health Checks

Public checks:

```bash
curl -fsS https://staging-career.theedumall.com/status
curl -fsS https://staging-career.theedumall.com/api/health
curl -fsS https://staging-career.theedumall.com/api/ready
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
edumall-compose logs --tail=200 caddy
edumall-compose logs --tail=200 web
edumall-compose logs --tail=200 api
edumall-compose logs --tail=200 worker
edumall-compose logs --tail=200 postgres
edumall-compose logs --tail=200 redis
```

Log rotation is configured in Docker Compose with `max-size` and `max-file`.

## Secret Rotation

General steps:

1. Schedule a maintenance window.
2. Back up PostgreSQL if database credentials change.
3. Edit `.env.staging` on the VPS only.
4. Restart affected services.
5. Verify health.
6. Record the rotation.

Do not pass secrets as command-line arguments.

## TLS Operations

Caddy obtains and renews certificates automatically.

Troubleshooting checklist:

- DNS `A` record points to the VPS IP.
- UFW allows `80/tcp` and `443/tcp`.
- No other process binds ports `80` or `443`.
- Caddy logs do not show ACME validation failures.
- `CADDY_EMAIL` is set in `.env.staging`.

Commands:

```bash
edumall-compose logs --tail=200 caddy
curl -I https://staging-career.theedumall.com
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

## Security Checks

Regularly verify:

- No service other than Caddy publishes host ports.
- `.env.staging` is mode `600`.
- Backups directory is mode `700`.
- SSH password login remains disabled after key login is verified.
- UFW allows only SSH, HTTP, and HTTPS.
- GitHub Actions deploy workflow remains `workflow_dispatch` only.

Commands:

```bash
ss -tulpn
sudo ufw status verbose
docker ps --format "table {{.Names}}\t{{.Ports}}"
stat -c "%a %n" .env.staging /opt/edumall-career/backups/postgres
```

## Incident Response

### Web unavailable

1. Check Caddy and web health.
2. Inspect Caddy logs.
3. Check DNS and certificate status.
4. Roll back if the issue follows a deployment.

### API not ready

1. Check `/api/health`.
2. Check `/api/ready`.
3. Inspect API logs.
4. Inspect PostgreSQL and Redis health.
5. Do not reset volumes as a first response.

### Disk full

1. Stop deployments.
2. Check Docker disk usage and backup size.
3. Prune unused images only after confirming rollback requirements.
4. Expand disk or remove expired backups under approved retention policy.

### Suspected secret exposure

1. Preserve logs and timestamps.
2. Rotate affected secrets.
3. Review GitHub secrets, `.env.staging`, and SSH keys.
4. Rebuild/restart affected services.
5. Record incident details and corrective action.

### Suspected data loss

1. Stop web, API, and worker.
2. Preserve PostgreSQL volume.
3. Identify latest valid backup.
4. Restore only after CTO approval and typed confirmation.
5. Validate health and data integrity.

## Remaining VPS Information Required

Before the first real staging deployment, collect:

- VPS IP address.
- SSH port.
- Deployment username.
- Deployment SSH public/private key ownership and rotation plan.
- Whether Hostinger Docker template is installed or Docker must be installed manually.
- DNS status for `staging-career.theedumall.com`.
- Operations email for Caddy ACME registration.
- Final staging `.env.staging` values.
- Backup retention window.
- Named owners for deployment, incident response, and security review.
