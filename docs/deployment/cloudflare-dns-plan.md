# PGS Hub Cloudflare DNS plan

This plan defines future records; it makes no DNS change.

## Zone ownership

Cloudflare is authoritative DNS for the approved company domain. Record the old nameservers/records and export the zone before nameserver changes. Validate DNSSEC sequencing with the registrar and Cloudflare during the separately approved rollout.

## Web hostname

```text
app.<company-domain> -> DNS Only -> exact DNS target shown by Vercel
```

Add the custom domain in Vercel first, inspect its required record, then create exactly that record at Cloudflare with proxy status **DNS Only** (gray cloud). Do not put Cloudflare's reverse proxy in front of Vercel by default; Vercel owns web CDN, TLS, caching, and firewall behavior. Re-check the required value rather than copying an example. References: [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain) and [Vercel WAF versus Cloudflare WAF](https://vercel.com/kb/guide/vercel-waf-vs-cloudflare-waf).

## API hostname

```text
api.<company-domain> -> Cloudflare Tunnel public-hostname route -> local API service
```

Create the API hostname from the Tunnel route so Cloudflare creates/uses the appropriate CNAME to the Tunnel target (conceptually `<tunnel-uuid>.cfargotunnel.com`). Do not create an A/AAAA record to the VPS. Confirm the route has Cloudflare proxy protection and maps only to the intended local service. Reference: [Tunnel routing](https://developers.cloudflare.com/tunnel/routing/).

## Supabase

Keep the Supabase project domain managed and used as provided by Supabase. Do not proxy that project hostname through custom Cloudflare DNS and do not change its records under this plan.

## Validation

- Web resolves to the exact Vercel-required value, Vercel reports the domain valid, and HTTPS loads with Cloudflare DNS Only.
- API resolves through the Tunnel route; HTTPS health, REST, CORS, and Socket.IO tests pass.
- No API A/AAAA record exposes the VPS; direct VPS/API port checks fail externally.
- Supabase Auth and approved read-only API flow still work; no production data mutation is part of DNS validation.

## Rollback

Web: restore the recorded prior DNS record/proxy state. API: disable/remove only the Tunnel hostname route; do not replace it automatically with the VPS IP. Nameserver rollback, if ever necessary, requires an owner-approved DNS incident plan and the recorded previous zone. DNS rollback is not a database rollback.
