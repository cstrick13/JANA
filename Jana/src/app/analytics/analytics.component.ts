import { Component, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../.env/environment'; // Adjust the path as needed
import { invoke } from '@tauri-apps/api/core';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule,
    MatDialogModule
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnDestroy {

  isLoggingIn = false;
  cpuUtilization = 0;
  memoryUtilization = 0;
  moduleName = 'Mgmt Module 1/1';
  currentVersion = "FL.10.12.1021";
  primaryVersion = "FL.10.12.1021";
  secondaryVersion = "FL.10.06.0120";
  totalFans = 3;
  criticalFans = 0;
  warningFans = 0;
  criticalLogs = 0;
  warningLogs = 0;
  private utilizationInterval: any;
  private deviceSub!: Subscription;
  selectedDevice!: Device;
  linkStates: Record<string,string> = {};
  readonly portNumbers = Array.from({ length: 28 }, (_, i) => i + 1);

  constructor(private dialog: MatDialog, private http: HttpClient, private deviceService: DeviceService) {}

  ngOnInit() {
    // Subscribe to the selected device from the shared service.
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
    if (this.utilizationInterval) {
      clearInterval(this.utilizationInterval);
    }
    if (this.deviceSub) {
      this.deviceSub.unsubscribe();
    }
    // Optionally log out from the current device.
    // this.logOutFrontend();
  }

  async loginFromFrontend(device: Device) {
    if (device.version === "old") {
      console.log("This is a different for different commands");
    } else if (device.version === "new") {
      try {
        const result = await invoke<string>('login_switch', {
          username: device.username,
          password: device.password,
          ip: device.ip,
        });
        console.log('Login successful:', result);

        // first immediate fetch:
        this.fetchUtilization(device.ip);

        // clear any existing loop:
        if (this.utilizationInterval) {
          clearInterval(this.utilizationInterval);
        }
        // new 15 s loop including both util + all link states
        this.utilizationInterval = setInterval(() => {
          this.fetchUtilization(device.ip);
       
        }, 15000);

      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  }

  async logOutFrontend() {
    if (!this.selectedDevice) return;
    try {
      const result = await invoke<string>('logout_switch', { ip: this.selectedDevice.ip });
      console.log('Logout successful:', result);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  async fetchUtilization(ip: string) {
    try {
      const result = await invoke<string>('get_utilization', { ip });
      console.log('Resource utilization:', result);
      const utilData = JSON.parse(result);
      this.cpuUtilization = utilData.cpu;
      this.memoryUtilization = utilData.memory;
    } catch (error) {
      console.error('Error fetching utilization:', error);
    }
  }
  
  async openLogPopup() {
    if (!this.selectedDevice) return;
    try {
      const logsResult = await invoke<string>('get_event_logs', { ip: this.selectedDevice.ip });
      console.log('Fetched filtered logs:', logsResult);
      const logs: string[] = JSON.parse(logsResult);
      this.dialog.open(LogPopupComponent, {
        width: '400px',
        data: { logs }
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      this.dialog.open(LogPopupComponent, {
        width: '400px',
        data: { logs: ['Failed to fetch logs', JSON.stringify(error)] }
      });
    }
  }
}

// Components for the log pop-up within the analytics page
import { Component as DialogComponent, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Device, DeviceService } from '../devices.service';

@Component({
  selector: 'app-log-popup',
  template: `
    <h2 mat-dialog-title>Logs</h2>
    <mat-dialog-content>
      <div *ngFor="let log of data.logs" style="margin-bottom: 8px;">
        • {{ log }}
      </div>
    </mat-dialog-content>
  `,
  standalone: true,
  imports: [MatDialogModule, CommonModule]
})
export class LogPopupComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { logs: string[] }) {}
}