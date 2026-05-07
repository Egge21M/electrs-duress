# Repository Guidelines

## Project Structure & Module Organization

`electrs-duress` is a Bun workspace. The root `package.json` only coordinates
workspace scripts. The server package lives in `packages/server`; its
`index.ts` is both the public export surface and CLI entrypoint. Runtime modules
live in `packages/server/src/`: `config.ts` parses environment variables,
`proxy.ts` owns socket forwarding, `electrum-observer.ts` parses Electrum
JSON-RPC requests, and notification modules publish console or Telegram alerts.
Tests are colocated as `*.test.ts`.

## Build, Test, and Development Commands

- `bun install`: install all workspace dependencies from `bun.lock`.
- `bun run db:generate`: generate Drizzle migrations from the server schema.
- `bun run db:migrate`: apply generated migrations to `DB_FILE_NAME`.
- `bun run start`: delegate to `@electrs-duress/server` and run the proxy.
- `bun run typecheck`: typecheck the server package with `tsc --noEmit`.
- `bun run test`: run the server package test suite.

Package-local equivalents can be run from `packages/server` with the same
script names.

For local TLS upstream testing, prefer environment variables such as
`ELECTRUM_HOST=btc1.shiftcrypto.io ELECTRUM_PORT=443 ELECTRUM_TLS=true bun run start`.

## Coding Style & Naming Conventions

Use TypeScript ES modules and Bun APIs where practical. Export public server
APIs from `packages/server/index.ts`, and prefer small focused modules under
`packages/server/src/`. Follow the existing two-space indentation,
double-quoted strings, and trailing commas in multiline calls and object
literals. Use camelCase for variables/functions and PascalCase for exported
types/classes.

## Testing Guidelines

Use `bun:test` with `test` and `expect`. Name tests after the behavior being
verified, for example `rejects invalid port values`. Add or update colocated
`*.test.ts` files when changing module behavior. Be aware that
`packages/server/index.test.ts` is a live integration test against
`btc1.shiftcrypto.io:443`; keep unit tests local and deterministic unless
external Electrum behavior is the point.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, for example `Add Telegram
notification handler` and `Gate address request logs behind env flag`. Keep
commits focused by behavior or module. Pull requests should describe the user
visible change, list validation commands such as `bun run test` and
`bun run typecheck`, and call out any configuration changes or live-network test
requirements.

## Security & Configuration Tips

Do not commit `.env` files, Telegram bot tokens, chat IDs, or private wallet
material. Local `*.sqlite` database files are ignored and should remain
machine-local; commit Drizzle migrations in `packages/server/drizzle` instead.
Watch-only configuration should use xpub-style public keys. Treat
`ELECTRUM_TLS_REJECT_UNAUTHORIZED=false` as a local testing escape hatch, not a
default production setting.
