import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../.env/environment';  // Adjust the path as needed

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
export class AnalyticsComponent {
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

  constructor(private dialog: MatDialog, private http: HttpClient) {}

  ngOnInit() {
    // Start the login flow.
    this.loginToSwitch();
  }

  loginToSwitch() {
    this.isLoggingIn = true;

    // Build the form data for URL-encoded POST body.
    const body = new HttpParams()
      .set('username', environment.ArubaInfo.username)
      .set('password', environment.ArubaInfo.password);

    // Note: Make sure your environment configuration provides the proper API IP and version.
    const url = `https://${environment.ArubaInfo.arubaIP}/rest/v10.12/login`;

    this.http.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // withCredentials ensures the cookie/session is stored automatically.
      withCredentials: true,
    }).subscribe({
      next: (res) => {
        console.log('Login successful:', res);
        this.isLoggingIn = false;
        // Optionally, trigger the resource utilization call after login.
        this.getResourceUtilization();
      },
      error: (err) => {
        console.error('Login failed:', err);
        this.isLoggingIn = false;
      }
    });
  }

  getResourceUtilization() {
    // This URL uses query parameters to ask for just the resource_utilization attributes.
    const url = `https://${environment.ArubaInfo.arubaIP}/rest/v10.12/system/subsystems?attributes=resource_utilization`;

    this.http.get(url, {
      // withCredentials sends cookies (including the SESSION cookie) automatically.
      withCredentials: true,
    }).subscribe({
      next: (res: any) => {
        const util = res.resource_utilization;
        // Assign the API values to the component's properties.
        this.cpuUtilization = util.cpu;
        this.memoryUtilization = util.memory;
        // Optionally, you may also use cpu_avg_1_min or cpu_avg_5_min:
        const cpu1m = util.cpu_avg_1_min;
        const cpu5m = util.cpu_avg_5_min;
        console.log('CPU:', this.cpuUtilization, 'Memory:', this.memoryUtilization);
      },
      error: (err) => {
        console.error('Failed to get resource utilization:', err);
      }
    });
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
