# Security Policy

Hedron treats Jeston security as part of the framework contract.

## Supported versions

The `main` branch and the latest stable release receive security fixes. Older releases may not receive patches; upgrade before reporting an issue that may already be fixed.

## Private reporting

Do not publish vulnerabilities in public issues. Use GitHub's **Report a vulnerability** feature in the repository Security tab or send a private report to Hedron maintainers. Include the affected version, Node.js environment, reproduction steps, impact, and a suggested fix when possible.

Do not include real tokens, keys, personal data, or credentials.

## Recommended practices

Use Node.js LTS, keep dependencies updated, set `JESTON_SESSION_SECRET` to at least 32 random characters, configure body and request limits, use HTTPS in production, enable Secure cookies, and never log secrets.

Jeston does not promise the complete absence of vulnerabilities. The commitment is to investigate, fix, and communicate security issues responsibly.
