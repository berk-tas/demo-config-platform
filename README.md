# config-platform

A versioned configuration platform. Zod schemas in `@demo/config-contracts` are
the **source of truth** for config shape; the package version *is* the contract
version. Versioned config values live under `values/<version>/` and are
published to Consul KV by the `config-service` NestJS app.

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
  validate-config.ts     CI-time validator
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
5. `POST /config/publish` writes them to Consul under
   `configs/<new-version>/...`.

Old versions remain readable in Consul under their version prefix; consumers
pin the version they understand.

## Publishing flow

```
values/<v>/*.json
   │
   ▼
config-service  ──Zod parse──▶  configs/<v>/assets.json
                                configs/<v>/workspaceSettings.json
                                configs/<v>/manifest.json   (last)
```

`manifest.json` records `{ contractVersion, publishedAt, gitCommit, keys }`
so consumers can detect publishes atomically by watching the manifest key.

## Consuming

Services pin a contract version `v` and read:

- `configs/<v>/manifest.json` — wait for it; treat appearance as commit point.
- `configs/<v>/assets.json` and `configs/<v>/workspaceSettings.json`.

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

yarn workspace @demo/config-service start:dev

curl localhost:3000/health
curl localhost:3000/config/version
curl localhost:3000/config/validate
curl -XPOST localhost:3000/config/publish
curl 'localhost:8500/v1/kv/configs/1.0.0/manifest.json?raw'
```

## Endpoints

| Method | Path                | Purpose                                  |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/health`           | Liveness                                 |
| GET    | `/config/version`   | Current contract version                 |
| GET    | `/config/validate`  | Validate `values/<v>/*` without writing  |
| GET    | `/config/preview`   | Validated bundle (no publish)            |
| POST   | `/config/publish`   | Validate + write to Consul + manifest    |
