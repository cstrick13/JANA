import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule
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
}
