import {
  type CreateXpubWatchSourceInput,
  type XpubWatchSourceRepository,
} from "./db/xpub-watch-source-repository";
import type { XpubWatchSource } from "./db/schema";
import { createXpubWatch, type WatchedAddress, type XpubWatch } from "./xpub-watch";

export interface ActiveWatchedAddress extends WatchedAddress {
  sourceLabel?: string;
}

export interface XpubWatchService {
  add(input: CreateXpubWatchSourceInput): XpubWatchSource;
  delete(xpub: string): void;
  disable(xpub: string): XpubWatchSource;
  enable(xpub: string): XpubWatchSource;
  init(): void;
  listActiveSources(): XpubWatchSource[];
  matchScriptHash(scriptHash: string): ActiveWatchedAddress[];
}

interface DerivedWatchSource {
  addresses: ActiveWatchedAddress[];
  source: XpubWatchSource;
}

interface CreateXpubWatchServiceOptions {
  deriveWatch?: (source: XpubWatchSource) => XpubWatch;
}

export function createXpubWatchService(
  repository: XpubWatchSourceRepository,
  options: CreateXpubWatchServiceOptions = {},
): XpubWatchService {
  const deriveWatch =
    options.deriveWatch ??
    ((source) =>
      createXpubWatch({
        xpub: source.xpub,
        addressCount: source.addressCount,
      }));
  const activeSourcesByXpub = new Map<string, DerivedWatchSource>();
  let matchesByScriptHash = new Map<string, ActiveWatchedAddress[]>();

  const activate = (source: XpubWatchSource) => {
    const watch = deriveWatch(source);
    activeSourcesByXpub.set(source.xpub, {
      source,
      addresses: watch.addresses.map((address) => ({
        ...address,
        ...(source.label ? { sourceLabel: source.label } : {}),
      })),
    });
    rebuildIndex();
  };

  const deactivate = (xpub: string) => {
    activeSourcesByXpub.delete(xpub);
    rebuildIndex();
  };

  const rebuildIndex = () => {
    const nextMatches = new Map<string, ActiveWatchedAddress[]>();

    for (const activeSource of activeSourcesByXpub.values()) {
      for (const address of activeSource.addresses) {
        const matches = nextMatches.get(address.scriptHash) ?? [];
        matches.push(address);
        nextMatches.set(address.scriptHash, matches);
      }
    }

    matchesByScriptHash = nextMatches;
  };

  return {
    add(input) {
      const source = repository.add(input);
      activate(source);
      return source;
    },

    delete(xpub) {
      repository.delete(xpub);
      deactivate(xpub);
    },

    disable(xpub) {
      const source = repository.disable(xpub);
      deactivate(xpub);
      return source;
    },

    enable(xpub) {
      const source = repository.enable(xpub);
      activate(source);
      return source;
    },

    init() {
      activeSourcesByXpub.clear();
      for (const source of repository.listEnabled()) {
        activate(source);
      }
      rebuildIndex();
    },

    listActiveSources() {
      return [...activeSourcesByXpub.values()].map(({ source }) => source);
    },

    matchScriptHash(scriptHash) {
      return matchesByScriptHash.get(scriptHash.toLowerCase()) ?? [];
    },
  };
}
