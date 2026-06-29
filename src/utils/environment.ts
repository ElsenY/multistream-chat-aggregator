import { isTauri } from '@tauri-apps/api/core';

/** True in the native Tauri window; false in OBS/browser docks (localhost:9527). */
export function isInTauri(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as any).__TAURI_INTERNALS__?.isMock) return false;
  return isTauri();
}
