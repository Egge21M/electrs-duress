import { expect, test } from "bun:test";
import { createXpubWatch } from "./xpub-watch";

const fixtureXpub =
  "xpub6DDeqdmzCpioRhR7fgHQAibbTMNRcPnW1qcYrrtAR5YEAWztVK3G6HuAky6Y3mZzB4UCqVifkXFY2qBUv8rJCHiT1JfoCLtUerZYp653yss";

test("derives watched P2PKH addresses and Electrum script hashes from an xpub", () => {
  const watch = createXpubWatch({
    xpub: fixtureXpub,
    addressCount: 3,
    chain: 0,
  });

  expect(watch.addresses).toEqual([
    {
      address: "1Exq3M51dXqk8eHnosigC5DPDVYbxz9934",
      index: 0,
      path: "m/0/0",
      scriptHash:
        "aa7ea9c5470f1a8186bfcac43af945464514633106097c14b8375bfcba7ef21f",
    },
    {
      address: "169y7gF5wGj9tQtK1v4kwnJMxepPPyxyDo",
      index: 1,
      path: "m/0/1",
      scriptHash:
        "ff44ecff3acde58b9a570a7dfa008a08e4fc0f98dd8f23c01e6c5c46af0b7b28",
    },
    {
      address: "1LaiDzwcguixWMmxmMGjiZvUhw4c8aGCau",
      index: 2,
      path: "m/0/2",
      scriptHash:
        "41f03ff226805532f7e1b98f3ee060e4636cdad5b5a6a7e319507d1dc5ff922f",
    },
  ]);

  expect(
    watch.byScriptHash.get(
      "aa7ea9c5470f1a8186bfcac43af945464514633106097c14b8375bfcba7ef21f",
    )?.address,
  ).toBe("1Exq3M51dXqk8eHnosigC5DPDVYbxz9934");
});

test("rejects unsupported extended public key prefixes", () => {
  expect(() =>
    createXpubWatch({
      xpub: "ypub-example",
      addressCount: 1,
      chain: 0,
    }),
  ).toThrow("WATCH_XPUB must start with xpub or tpub");
});
