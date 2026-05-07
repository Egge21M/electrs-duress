import { createHash } from "node:crypto";
import { HDKey, type Versions } from "@scure/bip32";
import * as bitcoin from "bitcoinjs-lib";
import type { WatchConfig } from "./types";

export interface WatchedAddress {
  address: string;
  index: number;
  path: string;
  scriptHash: string;
}

export interface XpubWatch {
  addresses: WatchedAddress[];
  byScriptHash: Map<string, WatchedAddress>;
}

export function createXpubWatch(config: WatchConfig): XpubWatch {
  const network = inferNetwork(config.xpub);
  const root = HDKey.fromExtendedKey(config.xpub, network.bip32Versions);
  const chain = root.deriveChild(config.chain);
  const addresses: WatchedAddress[] = [];
  const byScriptHash = new Map<string, WatchedAddress>();

  for (let index = 0; index < config.addressCount; index += 1) {
    const child = chain.deriveChild(index);
    if (!child.publicKey) {
      throw new Error(`Could not derive public key at m/${config.chain}/${index}`);
    }

    const payment = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
      network: network.paymentNetwork,
    });

    if (!payment.address || !payment.output) {
      throw new Error(`Could not derive P2PKH address at m/${config.chain}/${index}`);
    }

    const watchedAddress = {
      address: payment.address,
      index,
      path: `m/${config.chain}/${index}`,
      scriptHash: scriptToElectrumScriptHash(payment.output),
    };

    addresses.push(watchedAddress);
    byScriptHash.set(watchedAddress.scriptHash, watchedAddress);
  }

  return {
    addresses,
    byScriptHash,
  };
}

interface WatchNetwork {
  bip32Versions: Versions;
  paymentNetwork: typeof bitcoin.networks.bitcoin;
}

function inferNetwork(xpub: string): WatchNetwork {
  if (xpub.startsWith("xpub")) {
    return {
      bip32Versions: bitcoin.networks.bitcoin.bip32,
      paymentNetwork: bitcoin.networks.bitcoin,
    };
  }

  if (xpub.startsWith("tpub")) {
    return {
      bip32Versions: bitcoin.networks.testnet.bip32,
      paymentNetwork: bitcoin.networks.testnet,
    };
  }

  throw new Error("WATCH_XPUB must start with xpub or tpub");
}

function scriptToElectrumScriptHash(script: Uint8Array) {
  return Buffer.from(createHash("sha256").update(script).digest())
    .reverse()
    .toString("hex");
}
