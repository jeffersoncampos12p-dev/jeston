# Jeston security baseline

Jeston treats request data, cookies, action payloads, upstream URLs, logs, and deployment manifests as trust boundaries. The default controls include signed sessions, CSRF primitives, secure headers, origin validation for actions, payload limits, SSRF URL validation, redacted logs, serializability checks, and bounded audit retention.

Applications should configure a 32-character-or-longer session secret, use HTTPS, configure an explicit action CSRF strategy, restrict remote image/upstream hosts, run `npm audit`, review generated manifests, and forward audit events to durable storage when compliance requires it.

Report vulnerabilities privately through the repository security policy. Do not include credentials or exploit payloads in public issues. Security releases must preserve the compatibility contract where possible and document any required migration.
