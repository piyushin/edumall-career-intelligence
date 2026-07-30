# Hostinger VPS Staging Deployment Guide

This guide prepares the Phase 0 staging deployment for the EduMall Career Intelligence Platform on a Hostinger VPS running Ubuntu 24.04.

It does not approve production launch. It does not replace security, legal, privacy, psychometric, or CTO release gates.

## Target

- Repository: `piyushin/edumall-career-intelligence`
- Deployment branch: `phase-0/hostinger-staging-deployment`
- Runtime stack: Docker Compose with Caddy, web, API, worker, PostgreSQL, and Redis
- Staging hostname: `staging-career.theedumall.com`
- Public ports: `80` and `443` only
- Internal services: PostgreSQL, Redis, web, API, and worker remain private on Docker networks

## Architecture

```text
Internet
  |
  | HTTPS :443 / HTTP :80
  v
Caddy
  |-- /              -> web:3000
  |-- /api/*         -> api:3001, with /api stripped before proxying
  |-- /.well-known/health -> Caddy health response

Private Docker network
  |-- web
  |-- api -> postgres, redis
  |-- worker -> redis
  |-- postgres volume
  |-- redis volume
```

## Hostinger References

Hostinger documents these current VPS operations:

- Find VPS IP address: https://support.hostinger.com/en/articles/5139756-how-to-find-your-vps-ip-address
- Connect by SSH and locate SSH details: https://support.hostinger.com/en/articles/5723772-how-to-connect-to-your-vps-via-ssh
- Use Browser Terminal: https://support.hostinger.com/en/articles/7978544-how-to-use-the-browser-terminal
- Ubuntu 24.04 Docker template: https://support.hostinger.com/en/articles/8306612-how-to-use-the-docker-vps-template
- SSH keys on VPS: https://support.hostinger.com/en/articles/4792364-how-to-use-ssh-keys-at-vps

## 1. Identify the VPS IP

In Hostinger hPanel:

1. Open **VPS**.
2. Select the target VPS.
3. Use the displayed IP address from the VPS overview/status area.
4. Confirm `staging-career.theedumall.com` has an `A` record pointing to this IP before requesting Caddy TLS.

Verify DNS from your local machine:

```bash
dig +short staging-career.theedumall.com
```

## 2. Use Hostinger Browser Terminal

Use Browser Terminal only for bootstrap or break-glass access:

1. Open hPanel.
2. Open **VPS**.
3. Select the server.
4. Click **Browser terminal**.
5. Allow pop-ups from hPanel if the terminal does not open.
6. Log in with the SSH user and password shown in the VPS dashboard.

Prefer SSH-key login for normal operations.

## 3. Connect by SSH

From a local terminal:

```bash
ssh root@<vps-ip>
```

If Hostinger shows a non-default SSH port:

```bash
ssh -p <ssh-port> root@<vps-ip>
```

Use root only for initial bootstrap. Do not run regular deployments as root.

## 4. Create a Non-Root Deployment User

Run as root:

```bash
adduser deploy
usermod -aG sudo deploy
```

Use a strong temporary password. The deployment user should later use SSH keys and limited sudo.

## 5. Install an SSH Public Key

From the root session:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Paste only the public key, never a private key.

## 6. Verify SSH-Key Login

Before disabling password or root login, open a new terminal and test:

```bash
ssh -i ~/.ssh/edumall-staging deploy@<vps-ip>
```

Verify:

```bash
whoami
sudo -v
```

Proceed only after this succeeds.

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

Keep the current working session open until a new SSH-key session succeeds.

## 8. Configure UFW

Allow SSH before enabling the firewall:

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

Do not expose PostgreSQL, Redis, API, worker, or web ports through UFW.

## 9. Verify Docker and Docker Compose

Hostinger offers an Ubuntu 24.04 Docker template. Whether using that template or installing Docker manually, verify:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

If only the legacy command is available, install the modern Docker Compose plugin before using this project.

## 10. Grant Docker Access Safely

Docker group membership grants root-equivalent control over containers. Add only trusted deployment users:

```bash
sudo usermod -aG docker deploy
```

Log out and back in, then verify:

```bash
docker ps
```

If Docker access is not granted, prefix deployment commands with `sudo` and document that operational model.

## 11. Clone the Private GitHub Repository

Create a GitHub deploy key or use an approved machine user with least privilege.

As `deploy`:

```bash
mkdir -p /opt/edumall-career
sudo chown deploy:deploy /opt/edumall-career
cd /opt/edumall-career
git clone git@github.com:piyushin/edumall-career-intelligence.git repo
cd repo
git fetch origin
git switch phase-0/hostinger-staging-deployment
```

Do not clone with a personal access token embedded in shell history.

## 12. Create `/opt/edumall-career`

Recommended layout:

```text
/opt/edumall-career/
  repo/                  Git checkout
  backups/postgres/      Restricted database backups
```

Permissions:

```bash
sudo mkdir -p /opt/edumall-career/backups/postgres
sudo chown -R deploy:deploy /opt/edumall-career
chmod 750 /opt/edumall-career
chmod 700 /opt/edumall-career/backups/postgres
```

## 13. Create the Staging `.env` File Securely

Copy the template:

```bash
cd /opt/edumall-career/repo
cp .env.staging.example .env.staging
chmod 600 .env.staging
nano .env.staging
```

Replace every placeholder. Never commit `.env.staging`.

Generate `SESSION_SECRET` locally or on the server:

```bash
openssl rand -hex 32
```

Use a strong PostgreSQL password and keep `DATABASE_URL` aligned with `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.

## 14. Recommended File Permissions

```bash
chmod 600 /opt/edumall-career/repo/.env.staging
chmod 700 /opt/edumall-career/backups/postgres
find /opt/edumall-career/repo/scripts -type f -name "*.sh" -exec chmod 750 {} \;
```

Only the deployment user and approved administrators should read secrets.

## 15. Start the Staging Stack

Deployment must use an explicit approved commit SHA:

```bash
cd /opt/edumall-career/repo
./scripts/deploy-staging.sh <approved-40-character-commit-sha>
```

The script:

- Fetches origin.
- Verifies the commit exists.
- Checks out the exact commit in detached-head mode.
- Validates `.env.staging`.
- Validates Docker Compose.
- Builds app images.
- Starts services.
- Waits for health checks.
- Verifies API readiness through the public HTTPS route.

## 16. Verify Containers

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml ps
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Only Caddy should publish host ports `80` and `443`.

## 17. Inspect Logs

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml logs --tail=100 caddy
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml logs --tail=100 api
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml logs --tail=100 web
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml logs --tail=100 worker
```

Do not paste secrets from logs into tickets or chat.

## 18. Verify `/health`

```bash
curl -fsS https://staging-career.theedumall.com/api/health
```

Expected result: JSON with service `api`, status `ok`, environment `staging`, and the deployed commit as version.

## 19. Verify `/ready`

```bash
curl -fsS https://staging-career.theedumall.com/api/ready
```

Expected result: HTTP `200` when PostgreSQL and Redis are reachable from the API container.

## 20. Verify HTTPS

```bash
curl -I https://staging-career.theedumall.com
curl -I https://staging-career.theedumall.com/status
```

Check:

- Valid certificate.
- `Strict-Transport-Security` header.
- `X-Content-Type-Options` header.
- No internal service ports exposed.

## 21. Deploy an Approved Commit

Use only a reviewed commit SHA:

```bash
./scripts/deploy-staging.sh <approved-commit-sha>
```

Do not deploy a moving branch name. The script intentionally deploys a detached exact commit.

## 22. Roll Back to a Specific Commit

Use a previously deployed known-good commit:

```bash
./scripts/rollback-staging.sh <previous-commit-sha>
```

Rollback preserves PostgreSQL and Redis volumes and rebuilds/restarts application services where possible.

## 23. Back Up PostgreSQL

```bash
BACKUP_DIR=/opt/edumall-career/backups/postgres ./scripts/backup-postgres.sh
```

Backups are timestamped PostgreSQL custom-format dumps with restricted permissions.

## 24. Restore PostgreSQL

Restoration is destructive for current database objects and requires downtime:

```bash
./scripts/restore-postgres.sh /opt/edumall-career/backups/postgres/<backup-file>.dump
```

The script requires typed confirmation before restoring.

## 25. Stop and Restart Services

Stop application services:

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml stop web api worker
```

Restart:

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml up -d web api worker caddy
```

Stop the full stack without deleting volumes:

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml stop
```

## 26. Rotate Secrets

1. Back up `.env.staging` to a protected location if policy allows.
2. Generate the replacement secret.
3. Edit `.env.staging` using `nano` or another server-side editor.
4. Restart affected services.
5. Verify `/api/ready`.
6. Record the rotation in the operations log.

For PostgreSQL password rotation, schedule downtime unless a tested dual-password procedure exists.

## 27. Renew or Troubleshoot HTTPS

Caddy manages automatic TLS when:

- DNS points to the VPS.
- Ports `80` and `443` are open.
- The `STAGING_DOMAIN` is correct.
- `CADDY_EMAIL` is set.

Inspect:

```bash
docker compose --env-file .env.staging -p edumall-career-staging -f infrastructure/docker/docker-compose.staging.yml logs --tail=200 caddy
```

Common issues:

- DNS still points to another IP.
- UFW blocks `80` or `443`.
- Hostinger firewall blocks public HTTP/HTTPS.
- The Caddy data volume was removed and rate limits are reached.

## 28. Monitor Disk Usage

```bash
df -h
du -sh /opt/edumall-career
docker system df
```

Watch Docker images, container logs, PostgreSQL volume growth, and backups.

## 29. Prune Unused Docker Images Safely

After confirming a rollback target is still available or can be rebuilt:

```bash
docker image prune
```

Avoid broad prune commands during incidents. Do not remove named volumes unless a restore plan is approved and tested.

## 30. Incident and Recovery Steps

1. Identify impact: web down, API down, database unavailable, TLS issue, disk full, or suspected compromise.
2. Preserve evidence: do not delete logs or containers until triage is complete.
3. Check health:

   ```bash
   ./scripts/health-check-staging.sh
   ```

4. Inspect service logs.
5. Verify disk and memory.
6. If the issue followed a deployment, roll back to the last known-good commit.
7. If data loss is suspected, stop app services and consult CTO/security before restore.
8. Record timeline, commands run, commit SHA, symptoms, and recovery result.
9. Complete a post-incident review before re-opening staging for reviewers.

## GitHub Actions Manual Deployment

The workflow `.github/workflows/deploy-staging.yml` is manual only.

Required repository secrets:

- `HOSTINGER_VPS_HOST`
- `HOSTINGER_VPS_USER`
- `HOSTINGER_VPS_SSH_PORT`
- `HOSTINGER_VPS_SSH_KEY`

Required input:

- `commit_sha`: full 40-character approved commit SHA.

The workflow SSHes to `/opt/edumall-career/repo` and runs `./scripts/deploy-staging.sh <commit_sha>`.

Do not add automatic deployment on push until the CTO approves the release process.
