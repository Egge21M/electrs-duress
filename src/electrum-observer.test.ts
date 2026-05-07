import { expect, test } from "bun:test";
import {
  createElectrumRequestObserver,
  type ElectrumAddressRequest,
} from "./electrum-observer";

test("observes newline-delimited Electrum script-hash requests", () => {
  const observed: ElectrumAddressRequest[] = [];
  const observer = createElectrumRequestObserver("wallet:1", (request) => {
    observed.push(request);
  });

  observer.observe(
    `${JSON.stringify({
      id: 7,
      method: "blockchain.scripthash.get_history",
      params: ["abc"],
    })}\n`,
  );

  expect(observed).toEqual([
    {
      clientLabel: "wallet:1",
      id: 7,
      method: "blockchain.scripthash.get_history",
      target: "abc",
    },
  ]);
});

test("buffers partial JSON-RPC lines until a newline arrives", () => {
  const observed: ElectrumAddressRequest[] = [];
  const observer = createElectrumRequestObserver("wallet:1", (request) => {
    observed.push(request);
  });

  observer.observe('{"id":1,"method":"blockchain.address.get_balance",');
  expect(observed).toEqual([]);

  observer.observe('"params":["bc1qexample"]}\n');
  expect(observed).toEqual([
    {
      clientLabel: "wallet:1",
      id: 1,
      method: "blockchain.address.get_balance",
      target: "bc1qexample",
    },
  ]);
});

test("ignores non-address Electrum methods and malformed JSON", () => {
  const observed: ElectrumAddressRequest[] = [];
  const observer = createElectrumRequestObserver("wallet:1", (request) => {
    observed.push(request);
  });

  observer.observe("not json\n");
  observer.observe(
    `${JSON.stringify({
      id: 2,
      method: "server.version",
      params: ["electrs-duress", "1.4"],
    })}\n`,
  );

  expect(observed).toEqual([]);
});
