import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';
import Chart from 'chart.js/auto';
import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';
import { Device, DeviceService } from '../devices.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    standalone: false
})
export class HomeComponent implements OnInit {
    @ViewChild('bandwidthCanvas') canvas!: ElementRef<HTMLCanvasElement>;
    userRole: string = ''; // Track user role
    userName: string = ''; // Track user name
    isLoggedIn: boolean = false; // Track login status
    currentUser: any; // Track current user
    hasProfile: boolean = false; // Track if the user has a profile
    authUnsubscribe: any; // Unsubscribe function
    searchQuery = '';
    isLoading: boolean = true;
    devices: Device[] = [];
    newDevice: Device = { name: '', ip: '', version: '' };
    selectedDevice: Device | null = null;

    constructor(
        private cdr: ChangeDetectorRef,
        private router: Router, private authService: AuthService // Typed injection for AuthService
        ,private deviceService: DeviceService
      ) {}


      ngOnInit() {
        // Start loading
        this.isLoading = true;
        
        // Subscribe to authentication changes
        this.authService.currentUser$.subscribe(user => {
          this.isLoggedIn = !!user;
          if (user) {
            // Retrieve both display name and role concurrently
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
              // Set fallback values if retrieval fails
              this.userName = 'User';
              this.userRole = 'operator';
            })
            .finally(() => {
              // Stop loading once both values have been handled
              this.isLoading = false;
            });
            
            // Retrieve stored devices if available.
            invoke<string>('get_local_storage', { key: 'devices' })
              .then((result: string | null) => {
                if (result) {
                  try {
                    this.devices = JSON.parse(result);
                    console.log('Devices loaded from storage:', this.devices);
                  } catch (error) {
                    console.error('Error parsing devices from storage:', error);
                  }
                }
              })
              .catch(error => console.error('Error loading devices:', error));
              
          } else {
            this.userName = '';
            this.userRole = '';
            this.isLoading = false;
          }
          console.log('Authentication status updated:', this.isLoggedIn, 'Username:', this.userName);
        });
        this.deviceService.selectedDevice$.subscribe(device => {
          this.selectedDevice = device;
          console.log('Current selected device:', device);
        });
      }
      
      onSaveDevice(): void {
        // Ensure required fields are provided for name, ip, and version.
        if (this.newDevice.name && this.newDevice.ip && this.newDevice.version) {
          // If the password field is empty, default it to an empty string.
          this.newDevice.password = this.newDevice.password ? this.newDevice.password : "";
          
          // Add a copy of the newDevice to the devices array.
          this.devices.push({ ...this.newDevice });
          
          // Save the updated devices array to local storage.
          invoke('set_local_storage', {
            key: 'devices',
            value: JSON.stringify(this.devices)
          })
            .then(() => console.log('Devices saved to local storage:', this.devices))
            .catch(error => console.error('Error saving devices:', error));
          
          // Reset the newDevice model to clear the form.
          this.newDevice = { name: '', ip: '', version: '', username: '', password: '' };
        } else {
          console.log('Please complete all fields.');
        }
      }
      
    
      // Called when a device card is clicked
      onDeviceClick(device: Device): void {
        this.deviceService.setSelectedDevice(device);
      }
    
}
