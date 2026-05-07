# electrs-duress

`electrs-duress` is an Electrum TCP proxy that sits between a wallet and an
electrs-compatible server. It forwards traffic in both directions, watches for
configured wallet script hashes, and emits notifications when a watched hash is
requested.

This repository is a Bun workspace. The proxy implementation lives in
`packages/server`, while root scripts delegate to that package.

## Quick Start

Install dependencies:

```bash
bun install
```

Apply SQLite migrations:

```bash
bun run db:migrate
```

Run the proxy:

```bash
bun run start
```

By default the proxy listens on `127.0.0.1:60001` and forwards plain TCP traffic
to `127.0.0.1:50001`.

Bun automatically loads `.env`. Runtime proxy settings are read from SQLite;
`DB_FILE_NAME` can be placed in `.env` to point the server at a different
database file.

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `DB_FILE_NAME` | `electrs-duress.sqlite` | SQLite database path used by Drizzle commands and the server DB client. |

## SQLite Backend

The server package uses Drizzle with Bun SQLite for runtime configuration. The
`config_entries` table stores scalar settings, including Telegram credentials.
The `xpub_watch_sources` table is the source of truth for watched xpubs; derived
script hashes are built into an in-memory lookup at startup.

Supported `config_entries` keys:

```text
LISTEN_HOST
LISTEN_PORT
ELECTRUM_HOST
ELECTRUM_PORT
ELECTRUM_TLS
ELECTRUM_TLS_REJECT_UNAUTHORIZED
LOG_ADDRESS_REQUESTS
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
TELEGRAM_CUSTOM_MESSAGE
TELEGRAM_DEBOUNCE_MS
```

Unset keys use the defaults listed below, except Telegram
settings which remain disabled until token and chat ID are configured.

| Key | Default | Description |
| --- | --- | --- |
| `LISTEN_HOST` | `127.0.0.1` | Local interface the proxy listens on. |
| `LISTEN_PORT` | `60001` | Local TCP port wallets should connect to. |
| `ELECTRUM_HOST` | `127.0.0.1` | Upstream Electrum server host. |
| `ELECTRUM_PORT` | `50001` | Upstream Electrum server port. |
| `ELECTRUM_TLS` | `false` | Use TLS for upstream Electrum traffic. |
| `ELECTRUM_TLS_REJECT_UNAUTHORIZED` | `true` | Set to `false` for Electrum servers with certificates not trusted by the local CA store. |
| `LOG_ADDRESS_REQUESTS` | `false` | When `true`, logs every observed address/script-hash request, including non-alerts. |
| `TELEGRAM_DEBOUNCE_MS` | `5000` | Quiet period before queued Telegram alerts are sent as one message. |

Generate migrations after schema changes:

```bash
bun run db:generate
```

Apply generated migrations to the configured SQLite file with Bun's native
SQLite migrator:

```bash
DB_FILE_NAME=electrs-duress.sqlite bun run db:migrate
```

Migration files live in `packages/server/drizzle`; local `*.sqlite` database
files are ignored.

## Watched-Key Alerts

Enabled xpub watch sources are loaded from SQLite at startup. The proxy derives
branch `0` addresses, computes the Electrum script hash for each derived output
script, and keeps the active script-hash index in memory. If the wallet sends
any observed `blockchain.scripthash.*` request for a watched hash, the proxy
emits a notification.

Console alert example:

```text
[alert] watched script-hash requested client=127.0.0.1:12345 method=blockchain.scripthash.subscribe address=bc1q... path=m/0/0 scripthash=... id=1
```

Non-alert request logs are disabled by default. Enable them by setting
`LOG_ADDRESS_REQUESTS=true` in `config_entries`.


## Notifications

Watched matches are published through `NotificationService.notify()`.
`NotificationHandler` implementations can register with the service and run
their own side effects.

The runtime composition layer creates the default notification service with a
console handler. If Telegram settings are present in `config_entries`, that
layer also registers a Telegram handler. The TCP proxy receives the composed
notification service instead of constructing handlers itself.

## Telegram

Telegram alerts use [grammY](https://grammy.dev/) and `bot.api.sendMessage`.
Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `config_entries` to enable
them.

Telegram alerts are debounced. The handler waits for `TELEGRAM_DEBOUNCE_MS`
milliseconds of silence, then sends one message for all queued notifications.
With `TELEGRAM_CUSTOM_MESSAGE`, that exact text is sent once per debounce window
instead of generated alert details.

## Observed Methods

The parser currently observes these address and script-hash methods:

```text
blockchain.scripthash.get_balance
blockchain.scripthash.get_history
blockchain.scripthash.get_mempool
blockchain.scripthash.listunspent
blockchain.scripthash.subscribe
blockchain.address.get_balance
blockchain.address.get_history
blockchain.address.get_mempool
blockchain.address.listunspent
blockchain.address.subscribe
```

Alerts are only emitted for watched `blockchain.scripthash.*` targets.
`blockchain.address.*` requests are currently observable logs only when
`LOG_ADDRESS_REQUESTS=true`.

## Tests

Run typecheck:

```bash
bun run typecheck
```

Run tests:

```bash
bun run test
```

The root test command runs the server package tests. `packages/server/index.test.ts`
is a live integration test against `btc1.shiftcrypto.io:443`. The other tests
use local sockets and fake Telegram senders.

## Project Layout

- `package.json` defines the root workspace and delegates scripts to
  `@electrs-duress/server`.
- `packages/server/package.json` owns the server runtime dependencies and
  package-local scripts.
- `packages/server/index.ts` is the public export surface and CLI entrypoint.
- `packages/server/src/app.ts` composes the database, repositories, config,
  watch service, notification service, and TCP proxy into the runtime used by
  the CLI and future API layers.
- `packages/server/src/config.ts` parses string-backed configuration records
  into typed proxy settings.
- `packages/server/src/proxy.ts` owns socket forwarding and upstream TLS/TCP
  connections. It does not create database repositories or notification
  handlers.
- `packages/server/src/electrum-observer.ts` parses Electrum JSON-RPC lines and
  reports address data requests.
- `packages/server/src/xpub-watch.ts` derives watched addresses using
  `@scure/bip32` and maps them to Electrum script hashes.
- `packages/server/src/xpub-watch-service.ts` owns the active watch-source
  lifecycle and the in-memory script-hash index.
- `packages/server/src/notification-service.ts` publishes watched-hash
  notifications to registered handlers.
- `packages/server/src/telegram-notification-handler.ts` sends debounced
  Telegram alerts through grammY.
