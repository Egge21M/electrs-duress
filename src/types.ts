export interface Endpoint {
  host: string;
  port: number;
}

export interface UpstreamEndpoint extends Endpoint {
  tls: boolean;
  tlsRejectUnauthorized: boolean;
}

export interface ElectrumProxyConfig {
  listen: Endpoint;
  upstream: UpstreamEndpoint;
  watch?: WatchConfig;
}

export interface WatchConfig {
  xpub: string;
  addressCount: number;
  chain: number;
}

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}
