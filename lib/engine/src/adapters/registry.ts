import { nmapAdapter } from "./nmap";
import { subfinderAdapter } from "./subfinder";
import { httpxAdapter } from "./httpx";
import { nucleiAdapter } from "./nuclei";
import { headersAdapter } from "./headers";
import { tlsAdapter } from "./tls";
import { dnsAdapter } from "./dns";
import type { ToolAdapter } from "./types";

export const adapterRegistry = new Map<string, ToolAdapter>([
  // Pure-Node adapters (no Docker required) first.
  [dnsAdapter.name, dnsAdapter],
  [headersAdapter.name, headersAdapter],
  [tlsAdapter.name, tlsAdapter],
  // Container-based adapters.
  [subfinderAdapter.name, subfinderAdapter],
  [httpxAdapter.name, httpxAdapter],
  [nmapAdapter.name, nmapAdapter],
  [nucleiAdapter.name, nucleiAdapter],
]);
