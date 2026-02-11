# Security Policy

## Important Disclaimer

Prism was built with AI assistance (Claude Code) by someone who is not a professional software developer. While I use Prism daily in my own home, I cannot guarantee the absence of security vulnerabilities.

**Use at your own risk.** This is particularly important if you:
- Expose Prism to the internet (via Cloudflare Tunnel, port forwarding, etc.)
- Store sensitive information in the babysitter info section
- Have strict security requirements

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

Instead, please report it privately:

1. **GitHub Security Advisories** (preferred): Go to the [Security tab](https://github.com/sandydargoport/prism/security/advisories) and click "Report a vulnerability"

2. **Email**: If you prefer email, reach out via GitHub (open an issue asking for contact info, and I'll respond privately)

## What to Include

When reporting, please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (if you have them)

## Response Timeline

As a solo maintainer with a day job, I'll do my best to:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 1 week
- Release a fix as quickly as possible for critical issues

## Security Considerations

If you're self-hosting Prism, consider these best practices:

- **Don't expose to the internet** unless necessary. If you do, use Cloudflare Tunnel or similar with authentication.
- **Keep Docker and dependencies updated**
- **Use strong, unique PINs** for parent accounts
- **Review the `.env` file** - it contains your secrets
- **Regular backups** - use the built-in backup feature in Settings → Backups

## Scope

This policy covers the Prism application code. Third-party dependencies and infrastructure (Docker, PostgreSQL, Redis, your hosting environment) are outside the scope of this policy.
