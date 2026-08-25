# R19.1A Authorization Matrix And Threat Model

## Controller permissions

| Controller area         | Read                                 | Mutation                                                   | Scope                                    |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| Platform administrators | `admin.view`                         | `admin.create`, `admin.permission.manage`, `admin.suspend` | Platform only                            |
| Administrative audit    | `audit.view`                         | None                                                       | Platform only                            |
| Assessment governance   | `assessment.view`                    | `assessment.manage`, `assessment.publish`                  | Platform or authenticated organization   |
| Assessment assignment   | `assessment.view` + `candidate.view` | `assessment.manage` + `candidate.manage`                   | Selected organization must be authorized |
| Assessment results      | `candidate.view`                     | `assessment.manage`, `report.release`                      | Selected organization must be authorized |
| Career governance       | `career.view`                        | `career.manage`, `career.mapping.manage`                   | Platform only                            |
| Commerce governance     | `commerce.view`                      | Product/coupon/payment-specific permission                 | Platform or authenticated organization   |

## Enforced invariants

- A platform `SUPER_ADMIN` is the only wildcard context.
- An organization-scoped `SUPER_ADMIN` is denied before permission evaluation.
- A `PLATFORM_ADMIN` is authorized only by active effective assignments resolved by the server.
- Caller-supplied organization IDs never expand authenticated scope.
- Protected system templates cannot be renamed, permission-replaced, activated, or deactivated.
- Suspending an `AdminProfile` revokes only sessions attributed to that profile.
- Sensitive administrative reads require successfully persisted audit evidence.
- Audit failure cannot affect health, readiness, status, or public non-sensitive endpoints.

## Primary threats covered

- Wildcard privilege reuse in tenant sessions.
- Inactive/revoked assignment reuse through a stale client permission cache.
- Tenant-ID substitution and indirect-resource cross-tenant access.
- Security-baseline weakening through system-template mutation.
- Destruction of unrelated user sessions during delegated-admin suspension.
- Unstable or duplicating audit pagination.
- Unrecorded privileged directory and audit access.
