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
- `src/*.test.ts` cover local behavior; `index.test.ts` is the live integration
  test against `btc1.shiftcrypto.io:443`.

This project was created using `bun init` in bun v1.3.11. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
