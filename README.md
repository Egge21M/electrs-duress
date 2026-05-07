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

Run the proxy:

```bash
bun run start
```

By default the proxy listens on `127.0.0.1:60001` and forwards plain TCP traffic
to `127.0.0.1:50001`.

Example TLS upstream using the public ShiftCrypto Electrum endpoint:

```bash
LISTEN_PORT=3007 \
ELECTRUM_HOST=btc1.shiftcrypto.io \
ELECTRUM_PORT=443 \
ELECTRUM_TLS=true \
ELECTRUM_TLS_REJECT_UNAUTHORIZED=false \
bun run start
```

Bun automatically loads `.env`, so local testing can be done by placing those
variables in `.env` and running `bun run start`.

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `LISTEN_HOST` | `127.0.0.1` | Local interface the proxy listens on. |
| `LISTEN_PORT` | `60001` | Local TCP port wallets should connect to. |
| `ELECTRUM_HOST` | `127.0.0.1` | Upstream Electrum server host. |
| `ELECTRUM_PORT` | `50001` | Upstream Electrum server port. |
| `ELECTRUM_TLS` | `false` | Use TLS for upstream Electrum traffic. |
| `ELECTRUM_TLS_REJECT_UNAUTHORIZED` | `true` | Set to `false` for Electrum servers with certificates not trusted by the local CA store. |
| `WATCH_XPUB` | unset | Extended public key to watch. Supports `xpub`/`tpub` P2PKH and `zpub`/`vpub` native SegWit P2WPKH. |
| `WATCH_ADDRESS_COUNT` | `200` | Number of child addresses to derive and watch. |
| `WATCH_CHAIN` | `0` | Non-hardened child chain to derive, usually `0` for external addresses. |
| `LOG_ADDRESS_REQUESTS` | `false` | When `true`, logs every observed address/script-hash request, including non-alerts. |
| `TELEGRAM_BOT_TOKEN` | unset | Enables Telegram notifications when set with `TELEGRAM_CHAT_ID`. |
| `TELEGRAM_CHAT_ID` | unset | Destination Telegram chat ID for alerts. |
| `TELEGRAM_CUSTOM_MESSAGE` | unset | Sends this exact Telegram text instead of generated alert details. |
| `TELEGRAM_DEBOUNCE_MS` | `5000` | Quiet period before queued Telegram alerts are sent as one message. |

## Watched-Key Alerts

Set `WATCH_XPUB` to derive watched addresses at startup. The proxy computes the
Electrum script hash for each derived output script. If the wallet sends any
observed `blockchain.scripthash.*` request for a watched hash, the proxy emits a
notification.

Console alert example:

```text
[alert] watched script-hash requested client=127.0.0.1:12345 method=blockchain.scripthash.subscribe address=bc1q... path=m/0/0 scripthash=... id=1
```

Non-alert request logs are disabled by default. Enable them explicitly:

```bash
LOG_ADDRESS_REQUESTS=true bun run start
```

## Notifications

Watched matches are published through `NotificationService.notify()`.
`NotificationHandler` implementations can register with the service and run
their own side effects.

The default notification service registers a console handler. If Telegram env
vars are present, the proxy also registers a Telegram handler.

## Telegram

Telegram alerts use [grammY](https://grammy.dev/) and `bot.api.sendMessage`.

```bash
TELEGRAM_BOT_TOKEN=123:abc \
TELEGRAM_CHAT_ID=123456789 \
bun run start
```

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
- `packages/server/src/config.ts` parses environment configuration.
- `packages/server/src/proxy.ts` owns socket forwarding and upstream TLS/TCP
  connections.
- `packages/server/src/electrum-observer.ts` parses Electrum JSON-RPC lines and
  reports address data requests.
- `packages/server/src/xpub-watch.ts` derives watched addresses using
  `@scure/bip32` and maps them to Electrum script hashes.
- `packages/server/src/notification-service.ts` publishes watched-hash
  notifications to
  registered handlers.
- `packages/server/src/telegram-notification-handler.ts` sends debounced
  Telegram alerts through grammY.
