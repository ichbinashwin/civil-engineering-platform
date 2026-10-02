export interface DistCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { files: number; bytes: number };
}
export function checkDist(root: string, options?: { basePath?: string }): DistCheckResult;
