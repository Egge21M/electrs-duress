# electrs-duress

`electrs-duress` is a small Electrum TCP proxy that sits between a wallet and an
electrs-compatible server. It forwards traffic in both directions and logs
wallet address/script-hash data requests to stdout.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

By default the proxy listens on `127.0.0.1:60001` and forwards to
`127.0.0.1:50001`. In practice, point `ELECTRUM_PORT` at your real electrs
server and configure the wallet to connect to `LISTEN_PORT`:

```bash
LISTEN_PORT=60001 ELECTRUM_HOST=127.0.0.1 ELECTRUM_PORT=50001 bun run start
```

Set `ELECTRUM_TLS=true` when forwarding to a TLS Electrum endpoint such as
`btc1.shiftcrypto.io:443`:

```bash
LISTEN_PORT=60001 ELECTRUM_HOST=btc1.shiftcrypto.io ELECTRUM_PORT=443 ELECTRUM_TLS=true bun run start
```

Some Electrum servers use certificates that are not trusted by the local system
CA store. For those endpoints, set `ELECTRUM_TLS_REJECT_UNAUTHORIZED=false`:

```bash
LISTEN_PORT=60001 ELECTRUM_HOST=btc1.shiftcrypto.io ELECTRUM_PORT=443 ELECTRUM_TLS=true ELECTRUM_TLS_REJECT_UNAUTHORIZED=false bun run start
```

## Watched xpub alerts

Set `WATCH_XPUB` to derive watched addresses at startup. The proxy supports
`xpub`/`tpub` P2PKH watches and `zpub`/`vpub` native SegWit P2WPKH watches. It
derives the first 200 external-chain addresses, computes their Electrum script
hashes, and emits an alert if the wallet sends any `blockchain.scripthash.*`
request for one of those hashes:

```bash
WATCH_XPUB=xpub... bun run start
```

Optional watch settings:

- `WATCH_ADDRESS_COUNT` changes the number of derived addresses. Default: `200`.
- `WATCH_CHAIN` changes the non-hardened child chain. Default: `0`.

Alert example:

```text
[alert] watched script-hash requested client=127.0.0.1:12345 method=blockchain.scripthash.subscribe address=1... path=m/0/0 scripthash=... id=1
```

Internally, watched matches are published through `NotificationService.notify()`.
Custom `NotificationHandler` implementations can register with the service to
trigger their own side effects. The default service registers a console handler
that emits the alert shown above.

Non-alert address request logging is disabled by default. Set
`LOG_ADDRESS_REQUESTS=true` to also print every observed address or script-hash
request:

```bash
LOG_ADDRESS_REQUESTS=true bun run start
```

Logged methods include the common address and script-hash query methods:

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

## Project layout

- `index.ts` is the public export surface and CLI entrypoint.
- `src/config.ts` parses environment configuration.
- `src/proxy.ts` owns socket forwarding and upstream TLS/TCP connections.
- `src/electrum-observer.ts` parses Electrum JSON-RPC lines and reports address
  data requests.
- `src/xpub-watch.ts` derives watched addresses using `@scure/bip32` and maps
  them to Electrum script hashes.
- `src/notification-service.ts` publishes watched-address notifications to
  registered handlers.
- `src/*.test.ts` cover local behavior; `index.test.ts` is the live integration
  test against `btc1.shiftcrypto.io:443`.

This project was created using `bun init` in bun v1.3.11. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
