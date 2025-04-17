import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Device, DeviceService } from '../devices.service';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';

@Component({
  selector: 'app-switch-interface',
  templateUrl: './switch-interface.component.html',
  styleUrl: './switch-interface.component.css',
  standalone: false
})
export class SwitchInterfaceComponent {
  selectedDevice!: Device | undefined;
  // holds the full overview per port
  portOverviews: Record<string, PortOverview | undefined> = {};
  readonly portNumbers = Array.from({ length: 28 }, (_, i) => i + 1);
  private deviceSub!: Subscription;
  private utilizationInterval!: any;

  constructor(
    private dialog: MatDialog,
    private http: HttpClient,
    private deviceService: DeviceService
  ) {}

  ngOnInit() {
    this.deviceSub = this.deviceService.selectedDevice$.subscribe(device => {
      if (device) {
        this.selectedDevice = device;
        // Use the device's IP for login and utilization.
        this.loginFromFrontend(device);
      } else {
        console.log('No device selected.');
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.utilizationInterval);
    this.deviceSub.unsubscribe();
  }

  async loginFromFrontend(device: Device) {
    if (device.version !== 'new') return;
    try {
      await invoke<string>('login_switch', {
        username: device.username,
        password: device.password,
        ip: device.ip,
      });
      // first, grab everything
      await this.fetchAllPortOverviews(device.ip);

      clearInterval(this.utilizationInterval);
      this.utilizationInterval = setInterval(() => {
        this.fetchAllPortOverviews(device.ip);
      }, 15000);

    } catch (e) {
      console.error('Login failed:', e);
    }
  }

  private async fetchAllPortOverviews(ip: string) {
    for (const i of this.portNumbers) {
      const portKey = `1/1/${i}`;
      const cmdName = `get_interface_1_1_${i}`;
      try {
        const raw = await invoke<string>(cmdName, { ip });
        this.portOverviews[portKey] = JSON.parse(raw);
      } catch (e) {
        console.error(`Error fetching overview ${portKey}`, e);
        // fallback placeholder
        this.portOverviews[portKey] = {
          ifindex: i,
          admin_state: 'error',
          link_state: 'error',
          duplex: 'unknown',
          link_speed_bps: 0,
          mac_in_use: '',
          flaps_performed: 0
        };
      }
    }
  }

  formatSpeed(bps: number = 0): string {
    return bps ? `${(bps / 1e6).toFixed(0)} Mbps` : '—';
  }

  getStatusClass(state: string = ''): string {
    switch (state.toLowerCase()) {
      case 'up':     return 'up';
      case 'down':   return 'down';
      default:       return 'unknown';
    }
  }

  getIconClass(state: string = ''): string {
    switch (state.toLowerCase()) {
      case 'up':   return 'fas fa-link';
      case 'down': return 'fas fa-unlink';
      default:     return 'fas fa-question';
    }
  }
  

}

export interface PortOverview {
  ifindex:        number;
  admin_state:    string;
  link_state:     string;
  duplex:         string;
  link_speed_bps: number;
  mac_in_use:     string;
  flaps_performed:number;
}
