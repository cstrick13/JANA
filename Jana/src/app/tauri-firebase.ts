// src/app/firebase-persistence.ts
import { invoke } from '@tauri-apps/api/core';
import type { Persistence } from 'firebase/auth';

export const TauriPersistence = {
  type: 'LOCAL', // Use LOCAL so Firebase treats it like normal disk storage

  async _get(key: string): Promise<string | null> {
    const result = await invoke<string>('get_local_storage', { key });
    return result || null;
  },

  async _set(key: string, value: string): Promise<void> {
    await invoke('set_local_storage', { key, value });
  },

  async _remove(key: string): Promise<void> {
    await invoke('set_local_storage', { key, value: '' });
  }
} as Persistence;
