# Branching And Releases

## Branching

- `main` is protected conceptually and should receive reviewed changes only.
- Phase work should happen on dedicated branches, such as `phase-0/engineering-foundation`.
- Do not force-push shared branches unless explicitly approved by the CTO.

## Pull Requests

Each PR should include:

- Scope summary.
- Requirements addressed.
- Validation commands and results.
- Security/privacy considerations.
- Known limitations.

## Releases

Pilot and production releases require product, CTO/security, legal/privacy, and psychometric sign-off according to `docs/ARCHITECTURE.md` and `docs/DECISION_LOG.md`.
