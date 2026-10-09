import type { AppServices } from './App';

/** Test doubles are available only to the explicit Vite E2E build. */
export function selectE2EServices(mode: string, injected: AppServices | undefined): AppServices | undefined {
  return mode === 'e2e' ? injected : undefined;
}
