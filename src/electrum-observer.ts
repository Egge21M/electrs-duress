import { StringDecoder } from "node:string_decoder";

export interface ElectrumAddressRequest {
  clientLabel: string;
  id: string | number | null;
  method: string;
  target: unknown;
}

export type AddressRequestHandler = (request: ElectrumAddressRequest) => void;

const addressRequestMethods = new Set([
  "blockchain.address.get_balance",
  "blockchain.address.get_history",
  "blockchain.address.get_mempool",
  "blockchain.address.listunspent",
  "blockchain.address.subscribe",
  "blockchain.scripthash.get_balance",
  "blockchain.scripthash.get_history",
  "blockchain.scripthash.get_mempool",
  "blockchain.scripthash.listunspent",
  "blockchain.scripthash.subscribe",
]);

export function createElectrumRequestObserver(
  clientLabel: string,
  onAddressRequest: AddressRequestHandler,
) {
  const decoder = new StringDecoder("utf8");
  let buffered = "";

  return {
    observe(chunk: Buffer | string) {
      buffered += typeof chunk === "string" ? chunk : decoder.write(chunk);

      let newlineIndex = buffered.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);

        if (line.length > 0) {
          observeLine(line, clientLabel, onAddressRequest);
        }

        newlineIndex = buffered.indexOf("\n");
      }
    },
  };
}

function observeLine(
  line: string,
  clientLabel: string,
  onAddressRequest: AddressRequestHandler,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }

  const requests = Array.isArray(parsed) ? parsed : [parsed];
  for (const request of requests) {
    if (!isJsonRpcRequest(request) || !addressRequestMethods.has(request.method)) {
      continue;
    }

    onAddressRequest({
      clientLabel,
      id: request.id ?? null,
      method: request.method,
      target: request.params[0],
    });
  }
}

function isJsonRpcRequest(value: unknown): value is {
  id?: string | number | null;
  method: string;
  params: unknown[];
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { method?: unknown; params?: unknown };
  return (
    typeof candidate.method === "string" &&
    Array.isArray(candidate.params) &&
    candidate.params.length > 0
  );
}
