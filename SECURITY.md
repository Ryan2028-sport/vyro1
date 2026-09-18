# Security policy

## Reporting a vulnerability

Do **not** open a public issue. Email the maintainers with:

- what you found and where,
- reproduction steps or a proof of concept,
- the impact you believe it has.

Expect an acknowledgement within 3 business days and a status update within 10.

## Scope

In scope: this application, its server functions, HTTP routes under `src/routes/api`,
database policies in `supabase/migrations`, and the BLE/OTA client code.

Out of scope: watch firmware (separate repository), third-party services, and findings that
require a physically compromised device the reporter already controls.

## Handling rules we hold ourselves to

- Secrets are never committed, logged, echoed or returned to the client.
- Every public table enables RLS with explicit grants and policies.
- Roles live in `user_roles`, checked server-side via `has_role()` — never from client state.
- Public HTTP routes verify their caller (signature, token or session) before doing work.
- Health and biometric data is user-scoped by RLS; no cross-user reads.
