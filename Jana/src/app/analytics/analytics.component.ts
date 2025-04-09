import { Component, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../.env/environment'; // Adjust the path as needed
import { invoke } from '@tauri-apps/api/core';

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
  // UI State
  isLoggingIn = false;

  // Hardware Data (will be updated from API)
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

  // We'll use this timer to fetch utilization periodically.
  private utilizationInterval: any;

  constructor(private dialog: MatDialog, private http: HttpClient) {}

  ngOnInit() {
    // Start login process on component initialization.
    this.loginFromFrontend();
  }

  ngOnDestroy() {
    // Clean up when the component is destroyed.
    if (this.utilizationInterval) {
      clearInterval(this.utilizationInterval);
    }
    this.logOutFrontend();
  }
  
  async loginFromFrontend() {
    try {
      const result = await invoke<string>('login_switch', {
        username: environment.ArubaInfo.username,
        password: environment.ArubaInfo.password,
        ip: environment.ArubaInfo.arubaIP,
      });
  
      console.log('Login successful:', result);
      // Once logged in, begin fetching utilization.
      this.fetchUtilization(environment.ArubaInfo.arubaIP);
      
      // Optionally, fetch utilization periodically (e.g. every 15 seconds):
      this.utilizationInterval = setInterval(() => {
        this.fetchUtilization(environment.ArubaInfo.arubaIP);
      }, 15000); // 15000 ms = 15 seconds

    } catch (error) {
      console.error('Login failed:', error);
    }
  }

  async logOutFrontend() {
    try {
      const result = await invoke<string>('logout_switch', {
        ip: environment.ArubaInfo.arubaIP,
      });
  
      console.log('Logout successful:', result);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
  
  // Fetch resource utilization, update CPU and memory data in the UI.
  async fetchUtilization(ip: string) {
    try {
      const result = await invoke<string>('get_utilization', { ip });
      console.log('Resource utilization:', result);
      const utilData = JSON.parse(result);
  
      // Update properties used in the template.
      this.cpuUtilization = utilData.cpu;
      this.memoryUtilization = utilData.memory;

      // You might also want to extract cpu_avg_1_min or cpu_avg_5_min if needed.
    } catch (error) {
      console.error('Error fetching utilization:', error);
    }
  }
  
  openLogPopup() {
    this.dialog.open(LogPopupComponent, {
      width: '400px',
      data: {
        logs: [
          'System boot complete.',
          'User admin logged in.',
          'Backup completed successfully.',
          'No warnings detected.'
        ]
      }
    });
  }
}

// Components for the log pop-up within the analytics page
import { Component as DialogComponent, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@DialogComponent({
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
