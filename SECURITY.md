# Security

## Supported Reporting Channel

Security issues should be reported privately to the project owner or security lead. Do not open public issues containing secrets, vulnerabilities, personal data, assessment responses, or exploit details.

## Phase 0 Security Baseline

- No hard-coded credentials.
- No real secrets in source files.
- `.env.example` files contain placeholders only.
- Production CORS must not allow wildcard origins.
- Error responses must not expose stack traces in production.
- Logs must not contain passwords, tokens, authorization headers, assessment responses, or personal data.
- Object storage must be private by default in later phases.
- Dependency and secret scanning are required before pilot release.

## Local Secret Detection Guidance

Before pushing, run:

```bash
git diff --cached
pnpm security:audit
```

Review staged changes for tokens, credentials, private keys, copied proprietary assessment content, personal data, and assessment responses.

## Dependency Scanning Guidance

GitHub Actions runs dependency audit checks. Security-critical dependency upgrades should be reviewed and tested before release.
