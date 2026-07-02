import { nmapAdapter } from "./nmap";
import { subfinderAdapter } from "./subfinder";
import { httpxAdapter } from "./httpx";
import { nucleiAdapter } from "./nuclei";
import { headersAdapter } from "./headers";
import type { ToolAdapter } from "./types";

export const adapterRegistry = new Map<string, ToolAdapter>([
  [nmapAdapter.name, nmapAdapter],
  [subfinderAdapter.name, subfinderAdapter],
  [httpxAdapter.name, httpxAdapter],
  [nucleiAdapter.name, nucleiAdapter],
  [headersAdapter.name, headersAdapter],
]);
