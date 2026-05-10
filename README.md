# config-platform

A versioned configuration platform. Zod schemas in `@demo/config-contracts` are
the **source of truth** for config shape; the package version *is* the contract
version. Versioned config values live under `values/<version>/` and are
published to Consul KV either directly from CI (production path) or via the
`config-service` NestJS app (local debugging).

## Layout

```
apps/
  config-service/        NestJS app — validates + publishes configs to Consul
packages/
  config-contracts/      Zod schemas + generated JSON Schema + Go types
    src/schemas/
    generated/
      json-schema/
      go/config/
values/
  1.0.0/                 Versioned config values (matches contracts version)
    assets.json
    workspaceSettings.json
scripts/
  validate-config.ts     Validates values/<v>/*.json against ConfigBundleSchema
  publish-to-consul.ts   Direct Consul publisher used by CI (and locally)
  lib/load-and-validate.ts
docker-compose.yml       Local Consul (dev mode) on :8500
.github/workflows/ci.yml
```

## Version = contract

The version of `@demo/config-contracts` (currently `1.0.0`) is the only
schema/config version that exists. To roll a new contract:

1. Bump `packages/config-contracts/package.json` version and the
   `CONTRACT_VERSION` constant in `src/version.ts`.
2. Add a sibling `values/<new-version>/` directory with the new value files.
3. `yarn generate` regenerates JSON Schema and Go types under
   `packages/config-contracts/generated/`.
4. `yarn validate` enforces that on-disk values still parse.
5. `yarn publish:consul` (or CI on merge) writes them to
   `configs/<new-version>/...`.

Old versions remain readable in Consul under their version prefix; consumers
pin the version they understand.

## Publishing flow

```
values/<v>/*.json
   │
   ▼
yarn publish:consul  ──Zod parse──▶  configs/<v>/<filename>.json   (each)
(or POST /config/publish)            configs/<v>/manifest.json     (LAST)
```

The publisher discovers `*.json` files in `values/<v>/` dynamically. Adding a
new config file (e.g. `networks.json`) requires a matching schema in
`@demo/config-contracts` but **does not** require workflow or script changes.

`manifest.json` records `{ contractVersion, publishedAt, gitCommit, keys }`
and is **always written last**. Consumers watch the manifest key and reload
all sibling configs when its index/value changes.

## Updating a config value through Git

1. Edit `values/1.0.0/<file>.json` (or add a new file).
2. If you added a new config file, also add its Zod schema in
   `packages/config-contracts/src/schemas/`, wire it into `ConfigBundleSchema`,
   and run `yarn generate`. **The CI workflow itself does not need changes.**
3. Open a PR — CI runs `yarn validate` only. **Nothing is published.**
4. Merge to `staging` — CI runs validate + `yarn publish:consul` against
   `STAGING_CONSUL_HTTP_ADDR`.
5. Merge to `master` — same flow against `PROD_CONSUL_HTTP_ADDR`.
6. `configs/<v>/manifest.json` is written last; consumers reload when it
   changes.

## Consuming

Services pin a contract version `v` and read:

- `configs/<v>/manifest.json` — watch for changes; treat each new index as a
  commit point.
- `configs/<v>/<key>.json` for each key listed in the manifest.

TypeScript consumers import schemas from `@demo/config-contracts` and call
`AssetsSchema.parse(...)` etc. Go consumers import
`packages/config-contracts/generated/go/config` and call
`config.ParseAssets(data)`.

## Local dev

```
docker compose up -d consul
yarn install
yarn build
yarn generate
yarn validate

# direct publish from your machine to local Consul:
yarn publish:consul

# dry run — print plan, no writes:
PUBLISH_DRY_RUN=true yarn publish:consul

# or run the service for endpoint-driven publishing:
yarn workspace @demo/config-service start:dev

curl localhost:3000/health
curl localhost:3000/config/version
curl localhost:3000/config/validate
curl localhost:3000/config/publish
curl 'localhost:8500/v1/kv/configs/1.0.0/manifest.json?raw'
```

## Environment variables

| Var                  | Used by                  | Default                  | Notes                       |
| -------------------- | ------------------------ | ------------------------ | --------------------------- |
| `CONSUL_HTTP_ADDR`   | publish-to-consul, service | `http://localhost:8500`  | Consul HTTP base URL        |
| `CONSUL_HTTP_TOKEN`  | publish-to-consul        | (unset)                  | Sent as `X-Consul-Token`    |
| `GIT_COMMIT`         | publish-to-consul, service | `local-demo` / `git rev-parse HEAD` | Stored in manifest |
| `PUBLISH_DRY_RUN`    | publish-to-consul        | `false`                  | `true` skips Consul writes  |
| `VALUES_DIR`         | service                  | repo `values/`           | Override values root        |

## CI

Defined in [.github/workflows/ci.yml](.github/workflows/ci.yml):

- **Pull request** → `validate` job only (install + build + generate + validate).
- **Push to `staging`** → `validate` + `publish-staging` (uses
  `STAGING_CONSUL_HTTP_ADDR` / `STAGING_CONSUL_HTTP_TOKEN`).
- **Push to `master`** → `validate` + `publish-prod` (uses
  `PROD_CONSUL_HTTP_ADDR` / `PROD_CONSUL_HTTP_TOKEN`).

Secrets are scoped through GitHub Environments (`staging`, `production`),
which can require manual approval before publishing.

## Endpoints

| Method | Path                       | Purpose                                  |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/health`                  | Liveness                                 |
| GET    | `/config/version`          | Current contract version                 |
| GET    | `/config/validate`         | Validate `values/<v>/*` without writing  |
| GET    | `/config/preview`          | Discovered keys + parsed configs         |
| GET    | `/config/publish`          | Validate + write to Consul + manifest    |
| POST   | `/admin/assets/create-pr`  | Open a GitHub PR adding a new asset      |

## Demo: Add asset via PR

The `/admin/assets/create-pr` endpoint demonstrates the Git-driven flow end to
end. The service does **not** touch Consul or the local filesystem — it
validates the input, fetches the current `values/<v>/assets.json` from GitHub,
appends the new asset, validates the full array, and opens a pull request.
After the PR merges into `staging` (or `main`), CI runs `yarn publish:consul`
and the new value reaches Consul.

Copy [.env.example](.env.example) to `.env` at the repo root — the service
loads it at boot via `dotenv`. `.env` is gitignored.

### Required env vars

| Var                   | Required | Default     | Notes                                           |
| --------------------- | -------- | ----------- | ----------------------------------------------- |
| `GITHUB_TOKEN`        | yes      | —           | PAT or app token with `repo` scope              |
| `GITHUB_OWNER`        | yes      | —           | Repo owner (org or user)                        |
| `GITHUB_REPO`        | yes      | —           | Repo name                                       |
| `GITHUB_BASE_BRANCH`  | no       | `staging`   | Branch the PR targets                           |

### curl example

```
curl -X POST http://localhost:3000/admin/assets/create-pr \
  -H 'content-type: application/json' \
  -d '{
    "symbol": "ARB",
    "name": "Arbitrum",
    "coinGeckoId": "arbitrum",
    "icon": "https://assets.coingecko.com/coins/images/16547/large/arb.jpg",
    "minimumAmountToSweep": "0.1",
    "depositSuspended": false,
    "withdrawSuspended": false,
    "networks": {
      "arbitrum": {
        "isNative": false,
        "assetAddress": "0x912CE59144191C1204E64559FE8253a0e49E6548",
        "assetType": "erc20",
        "decimals": 18,
        "displayDecimals": 6,
        "isHidden": false
      }
    }
  }'
```

Response:

```
{
  "prUrl": "https://github.com/<owner>/<repo>/pull/123",
  "branch": "add-asset-arb-1714679800123",
  "filePath": "values/1.0.0/assets.json"
}
```

### Expected PR

- **Title**: `Add ARB asset config`
- **Branch**: `add-asset-arb-<timestamp>` → targets `GITHUB_BASE_BRANCH`
- **Diff**: appends a single object to `values/1.0.0/assets.json`
- **Body**: lists symbol, coinGeckoId, networks, and a "Generated by
  config-service. CI will validate and publish after merge." note.

### After merge

1. CI's `validate` job re-runs against the merged commit.
2. If the target branch is `staging` or `main`, the matching publish job runs
   `yarn publish:consul`, writing each `configs/<v>/<key>.json` and
   `configs/<v>/manifest.json` (last) to the corresponding Consul.
3. Consumers watching the manifest reload and pick up the new asset.
