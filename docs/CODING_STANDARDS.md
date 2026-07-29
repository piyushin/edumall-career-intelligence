# Coding Standards

## TypeScript

- Use strict TypeScript.
- Avoid `any`.
- Prefer explicit domain types at package boundaries.
- Keep business logic out of controllers.
- Keep scoring, assessment, report, and psychometric logic out of Phase 0.

## API

- Use standard error responses.
- Use request IDs and correlation IDs.
- Validate environment variables before startup.
- Do not expose stack traces in production responses.
- Log structured JSON only.
- Do not log passwords, tokens, personal data, assessment responses, or report content.

## Frontend

- Build accessible components.
- Use semantic HTML.
- Support keyboard navigation.
- Do not hard-code future assessment or report text.

## Formatting And Linting

Use:

```bash
pnpm format
pnpm lint
pnpm type-check
```
