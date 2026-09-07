export type FormalVerdict = "PROVEN" | "FAILED" | "UNKNOWN" | "ERROR" | "TIMEOUT";

export interface FailedAssertion {
  name: string;
  location?: string;
  step?: number;
}

export interface FormalProveResult {
  success: boolean;
  verdict: FormalVerdict;
  topModule: string;
  mode: string;
  depth: number;
  engine: string;
  failedAssertions: FailedAssertion[];
  workDir?: string;
  warnings: string[];
  errors: string[];
  logTail: string[];
}

export interface SvaLintResult {
  success: boolean;
  diagnostics: Array<{ file: string; line?: number; message: string }>;
  warnings: string[];
  errors: string[];
}

export interface FormalToolchainInfo {
  runtime: "podman" | "docker" | "host";
  image?: string;
  sbyVersion: string;
  solvers: string[];
  engines: string[];
}
