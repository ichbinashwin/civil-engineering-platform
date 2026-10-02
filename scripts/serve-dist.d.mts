import type { Server } from "node:http";
export function resolveFile(root: string, urlPath: string): string | null;
export function createDistServer(dist: string, options?: { basePath?: string }): Server;
