export const PROVIDERS: string[];
export interface HeaderConfig {
  headers: Record<string, string>;
  immutable: { path: string; cacheControl: string };
}
export function loadHeaderConfig(root?: string): HeaderConfig;
export function renderUnderscoreHeaders(config: HeaderConfig): string;
export function renderAzureConfig(config: HeaderConfig): unknown;
export function renderFirebaseConfig(
  config: HeaderConfig,
  options?: { site?: string; dist?: string },
): unknown;
export function renderVercelOutputConfig(config: HeaderConfig): unknown;
export function writeProviderConfig(
  provider: string,
  options?: { root?: string; dist?: string; site?: string },
): string[];
