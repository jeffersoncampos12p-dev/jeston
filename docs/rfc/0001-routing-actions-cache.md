# RFC 0001: routing, actions, and cache contracts

## Status

Accepted for the 2.x additive API surface.

## Decisions

Route manifests are deterministic and portable. App routes may add layouts and boundaries without changing the legacy pages router. Server Actions receive stable IDs, JSON-serializable input/output, same-origin checks, optional CSRF validation, and bounded execution. Data cache scope is explicit; private entries require a variation key. Existing adapters remain valid because richer methods are optional.

## Non-goals

This RFC does not claim full React Flight protocol compatibility or provider-specific remote cache semantics. Those require versioned adapters and independent contract suites.
