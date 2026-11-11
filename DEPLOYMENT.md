# Deploy Deep Learning Blocks

The app is an Angular SPA served by **Cloudflare Workers Static Assets**. Training runs in the visitor's browser. There is no AWS dependency, Worker request handler, database or server training service.

## CLI

Use Node from `.nvmrc` (Node 22.19.0) or supported Node 24 LTS.

```sh
nvm use
npm ci
npm run deploy:check
npx wrangler login
npm run deploy
```

`deploy:check` builds and packages without publishing. `deploy` builds first, including analytics configuration, then publishes the `deep-learning-blocks` Worker from `wrangler.jsonc`. `preview:worker` builds and serves the same assets locally. To keep the existing development URL:

```sh
npm run preview:worker -- --port 8788
```

If multiple Cloudflare accounts are available, set `CLOUDFLARE_ACCOUNT_ID` to the intended account. For noninteractive deployment, supply `CLOUDFLARE_API_TOKEN` through the CI secret store. Those are deployment credentials and must never go into `config/analytics.json`, `public/` or frontend environment files.

## Cloudflare Git integration

Connect the repository in Workers & Pages and use:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Worker name | `deep-learning-blocks` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version build variable | `NODE_VERSION=22.19.0` |

Use the Wrangler deploy command here because the build step already runs separately. For a preview build intended to stay out of analytics, set the **build** variable `POSTHOG_PROJECT_TOKEN` to an empty string in that environment. The repository's GitHub Checks workflow runs tests and a dry run, never a live deployment.

After the first deployment, attach the existing domain under the Worker's **Settings → Domains & Routes → Add → Custom Domain**. Choose the intended Cloudflare zone and review any conflicting DNS records. The canonical origin is `https://deeplearningblocks.com`, set in `config/site.json`. Override it with the `SITE_URL` Cloudflare **build** variable or in `.env.local` for a CLI build.

With an explicitly empty `SITE_URL`, builds emit `noindex` and omit the sitemap. Cloudflare non-production branch builds use the same indexing protection. If the production branch differs from `main`, set `SITE_PRODUCTION_BRANCH` to match. For previews built outside Cloudflare's Git integration, set `SITE_PREVIEW=1`. Responses on standard `workers.dev` hosts also carry `X-Robots-Tag: noindex`.

## PostHog configuration

The user's EU project is configured in `config/analytics.json`. Its `phc_` token is a **public ingestion token** and is intentionally sent to the browser. It is not a personal API key and grants no dashboard/admin access. Personal PostHog keys are rejected by the build script.

`npm run build`, `start`, `dev` and `watch` generate `public/analytics-config.json`. The production build copies it into the static assets. This generated file is ignored by Git and served with `Cache-Control: no-store`.

Optional build overrides:

| Variable | Meaning |
| --- | --- |
| `POSTHOG_PROJECT_TOKEN` | Another project's public token; empty string disables analytics |
| `POSTHOG_API_HOST` | `https://eu.i.posthog.com` or `https://us.i.posthog.com` |

Local overrides can live in an ignored `.env.local`; `.env.example` shows the format. Environment variables supplied by CI take precedence. These are **build-time** settings. Worker runtime bindings do not change an already-built static file; rebuild to apply changes. Direct `ng build` skips the npm configuration hook, so use `npm run build`.

## Event contract

The lazy SDK uses the official `posthog-js/no-external` bundle. Failure to fetch config, import or initialize the SDK, or capture an event does not interrupt the playground.

| Event | Trigger | Extra properties |
| --- | --- | --- |
| `$pageview` | Once after initialization | Origin/path only; no URL query or hash |
| `workspace_opened` | Initial workspace or successful mode/level switch | Mode, stable level ID, dataset ID |
| `level_completed` | First successful Journey construction check | Mode, level ID, dataset ID |
| `training_started` | Valid connected network starts training | Context, parameter count, Dense count |
| `training_completed` | Training and evaluation finish | Above plus accuracy and duration |
| `training_cancelled` | A started run is stopped | Context, architecture counts, duration |
| `training_failed` | A started run throws | Context and architecture counts, no exception text |
| `model_exported` | Download a Python script or notebook | Context, format, parameter count |

Analytics runs only on non-local HTTPS origins, respects Do Not Track, and is disabled on localhost and HTTP previews even with a configured token. Automated tests use a fake SDK, never the real project.

There is no autocapture, session replay, survey loading, remote feature configuration, exception capture or persistent analytics storage. IDs last only in memory, so returning-visitor counts and funnels across reloads are intentionally limited. An event filter removes undeclared events/properties, including referrers, query strings, drawings, board contents and raw error messages. PostHog still receives network requests; this configuration is not a claim of anonymous networking. Geography enrichment is disabled per event.

After deploying, open the HTTPS site with Do Not Track off and check PostHog's live events for `$pageview` and `workspace_opened`. Complete a build, run or stop training, and download code to inspect their events. Ad blockers can suppress delivery. Local checks do not establish live dashboard receipt.

## References

- [Cloudflare static SPA hosting](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [PostHog browser configuration](https://posthog.com/docs/libraries/js/config)
