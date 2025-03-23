import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

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
  // CPU & Memory Data
  cpuUtilization = 50;
  memoryUtilization = 91;
  moduleName = 'Mgmt Module 1/1';

  // Firmware Data
  currentVersion = "FL.10.12.1021";
  primaryVersion = "FL.10.12.1021";
  secondaryVersion = "FL.10.06.0120";

  // Fans Data
  totalFans = 3;
  criticalFans = 0;
  warningFans = 0;

  // Logs Data
  criticalLogs = 0;
  warningLogs = 0;

  constructor(private dialog: MatDialog) {}

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
