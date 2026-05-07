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
}

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}
