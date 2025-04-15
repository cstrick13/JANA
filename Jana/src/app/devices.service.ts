// device.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';

export interface Device {
  name: string;
  ip: string;
  version: string;
  username?: string;
  password?: string;
}

const SELECTED_DEVICE_KEY = 'selectedDevice';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private selectedDeviceSubject = new BehaviorSubject<Device | null>(null);
  selectedDevice$ = this.selectedDeviceSubject.asObservable();

  constructor() {
    // On service initialization, load any persisted selected device.
    this.loadSelectedDevice();
  }

  private async loadSelectedDevice() {
    try {
      const result = await invoke<string>('get_local_storage', { key: SELECTED_DEVICE_KEY });
      if (result) {
        const device = JSON.parse(result) as Device;
        this.selectedDeviceSubject.next(device);
        console.log('Loaded persisted device:', device);
      }
    } catch (error) {
      console.error('Error loading persisted device:', error);
    }
  }

  async setSelectedDevice(device: Device): Promise<void> {
    this.selectedDeviceSubject.next(device);
    try {
      await invoke('set_local_storage', {
        key: SELECTED_DEVICE_KEY,
        value: JSON.stringify(device)
      });
      console.log('Persisted selected device:', device);
    } catch (error) {
      console.error('Error saving selected device:', error);
    }
  }
}
