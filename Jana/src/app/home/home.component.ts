import { ChangeDetectorRef, Component, ElementRef, OnInit, AfterViewInit, OnDestroy, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';
import Chart from 'chart.js/auto';
import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';
import { Device, DeviceService } from '../devices.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  standalone: false
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  // ─── Canvas refs for sparklines ───
  @ViewChild('cpuCanvas') cpuCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('memoryCanvas') memoryCanvas!: ElementRef<HTMLCanvasElement>;

  // ─── Original Auth/UI state ───
  userRole = '';
  userName = '';
  isLoggedIn = false;
  currentUser: any;
  hasProfile = false;
  authUnsubscribe!: Subscription;
  searchQuery = '';
  isLoading = true;

  // ─── Devices ───
  devices: Device[] = [];
  newDevice: Device = { name: '', ip: '', version: '' };
  selectedDevice: Device | null = null;

  // ─── Analytics state ───
  isLoggingIn = false;
  cpuUtilization = 0;
  memoryUtilization = 0;
  private utilizationInterval: any;
  private deviceSub!: Subscription;

  // ─── Chart.js instances ───
  private cpuChart: Chart<'line'> | null = null;
  private memoryChart: Chart<'line'> | null = null;

  // ─── History + stats ───
  private maxPoints = 20;
  cpuHistory: number[] = Array(this.maxPoints).fill(0);
  memHistory: number[] = Array(this.maxPoints).fill(0);
  labels: string[]       = Array(this.maxPoints).fill('');
  avgCpu = 0; minCpu = 0; maxCpu = 0;
  avgMem = 0; minMem = 0; maxMem = 0;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private authService: AuthService,
    private deviceService: DeviceService
  ) {}

  ngOnInit() {
    this.isLoading = true;

    // Auth subscription
    this.authUnsubscribe = this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
      if (user) {
        Promise.all([
          invoke<string>('get_local_storage', { key: 'displayName' }),
          invoke<string>('get_local_storage', { key: 'role' })
        ])
          .then(([name, role]) => {
            this.userName = name || 'User';
            this.userRole = role || 'operator';
            console.log('Display name from Tauri:', this.userName);
            console.log('Role from Tauri:', this.userRole);
          })
          .catch(err => {
            console.error('Error reading from Tauri storage:', err);
            this.userName = 'User';
            this.userRole = 'operator';
          })
          .finally(() => this.isLoading = false);

        invoke<string>('get_local_storage', { key: 'devices' })
          .then(res => {
            if (res) this.devices = JSON.parse(res);
          })
          .catch(() => {/* ignore */});
      } else {
        this.userName = '';
        this.userRole = '';
        this.isLoading = false;
      }
    });

    // Device selection → login + poll
    this.deviceSub = this.deviceService.selectedDevice$
      .subscribe(device => {
        this.selectedDevice = device;
        if (device) this.loginFromFrontend(device);
      });
  }

  ngAfterViewInit() {
    // CPU sparkline
    const cpuCtx = this.cpuCanvas.nativeElement.getContext('2d');
    if (cpuCtx) {
      this.cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: {
          labels: this.labels,
          datasets: [{
            data: this.cpuHistory,
            fill: true,
            tension: 0.3,
            borderWidth: 1,
            pointRadius: 2
          }]
        },
        options: {
          scales: { x:{display:false}, y:{display:false} },
          plugins:{ legend:{display:false} },
          responsive:true,
          maintainAspectRatio:false
        }
      });
    }

    // Memory sparkline
    const memCtx = this.memoryCanvas.nativeElement.getContext('2d');
    if (memCtx) {
      this.memoryChart = new Chart(memCtx, {
        type: 'line',
        data: {
          labels: this.labels,
          datasets: [{
            data: this.memHistory,
            fill: true,
            tension: 0.3,
            borderWidth: 1,
            pointRadius: 2
          }]
        },
        options: {
          scales: { x:{display:false}, y:{display:false} },
          plugins:{ legend:{display:false} },
          responsive:true,
          maintainAspectRatio:false
        }
      });
    }

    // draw initial zeros
    this.updateCharts();
  }

  ngOnDestroy() {
    if (this.utilizationInterval) clearInterval(this.utilizationInterval);
    this.authUnsubscribe.unsubscribe();
    this.deviceSub.unsubscribe();
    this.logOutFrontend();
  }

  onSaveDevice(): void {
    if (this.newDevice.name && this.newDevice.ip && this.newDevice.version) {
      this.newDevice.password = this.newDevice.password ?? '';
      this.devices.push({ ...this.newDevice });
      invoke('set_local_storage', {
        key: 'devices',
        value: JSON.stringify(this.devices)
      }).catch(() => {});
      this.newDevice = { name:'', ip:'', version:'', username:'', password:'' };
    }
  }

  onDeviceClick(device: Device) {
    this.deviceService.setSelectedDevice(device);
  }

  private async loginFromFrontend(device: Device) {
    this.isLoggingIn = true;
    if (device.version !== 'new') { this.isLoggingIn = false; return; }
    try {
      await invoke('login_switch', {
        username: device.username||'',
        password: device.password||'',
        ip: device.ip
      });
      this.fetchUtilization(device.ip);
      if (this.utilizationInterval) clearInterval(this.utilizationInterval);
      this.utilizationInterval = setInterval(() => {
        this.fetchUtilization(device.ip);
      }, 15000);
    } catch {}
    finally { this.isLoggingIn = false; }
  }

  private async logOutFrontend() {
    if (!this.selectedDevice) return;
    await invoke('logout_switch', { ip: this.selectedDevice.ip }).catch(() => {});
  }

  private async fetchUtilization(ip: string) {
    try {
      const raw = await invoke<string>('get_utilization', { ip });
      const {cpu, memory} = JSON.parse(raw);
      this.cpuUtilization    = cpu;
      this.memoryUtilization = memory;

      // push & shift
      const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      this.cpuHistory.push(cpu);
      this.memHistory.push(memory);
      this.labels.push(now);

      if (this.cpuHistory.length > this.maxPoints) {
        this.cpuHistory.shift();
        this.memHistory.shift();
        this.labels.shift();
      }

      this.updateStats();
      this.updateCharts();
    } catch {}
  }

  private updateStats() {
    const c = this.cpuHistory,   m = this.memHistory;
    const sum = (a: number[]) => a.reduce((x,y)=>x+y,0);
    if (c.length) {
      this.avgCpu = Math.round(sum(c)/c.length);
      this.minCpu = Math.min(...c);
      this.maxCpu = Math.max(...c);
    }
    if (m.length) {
      this.avgMem = Math.round(sum(m)/m.length);
      this.minMem = Math.min(...m);
      this.maxMem = Math.max(...m);
    }
  }

  private updateCharts() {
    if (this.cpuChart) {
      this.cpuChart.data.labels = this.labels;
      this.cpuChart.data.datasets![0].data = this.cpuHistory;
      this.cpuChart.update();
    }
    if (this.memoryChart) {
      this.memoryChart.data.labels = this.labels;
      this.memoryChart.data.datasets![0].data = this.memHistory;
      this.memoryChart.update();
    }
  }
}
