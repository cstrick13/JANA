import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../.env/environment';

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

  // Example Hardware Data
  cpuUtilization = 50;
  memoryUtilization = 91;
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
    this.loginToSwitch('192.168.1.1'); // example IP
  }

  loginToSwitch(ip: string) {
    this.isLoggingIn = true;

    const body = new HttpParams()
      .set('username', environment.ArubaInfo.username) // ideally pulled from env or UI
      .set('password', environment.ArubaInfo.password); // same

    const url = `https://${environment.ArubaInfo.arubaIP}}/rest/v10.04/login`;

    this.http.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).subscribe({
      next: (res) => {
        console.log('Login successful:', res);
        this.isLoggingIn = false;
      },
      error: (err) => {
        console.error('Login failed:', err);
        this.isLoggingIn = false;
      }
    });
  }

  getResourceUtilization(ip: string, sessionCookie: string) {
    const url = `https://${environment.ArubaInfo.arubaIP}/rest/v10.04/system/subsystems?attributes=resource_utilization`;
  
    this.http.get(url, {
      headers: {
        'Cookie': `SESSION=${sessionCookie}`
      }
    }).subscribe({
      next: (res: any) => {
        const util = res.resource_utilization;
  
        this.cpuUtilization = util.cpu;
        this.memoryUtilization = util.memory;
        const cpu1m = util.cpu_avg_1_min;
        const cpu5m = util.cpu_avg_5_min;
  
        console.log('CPU:', this.cpuUtilization, 'Memory:', this.memoryUtilization);
      },
      error: (err) => {
        console.error('Failed to get utilization:', err);
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
import { Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

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
