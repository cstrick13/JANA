import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule, provideHttpClient, withFetch } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';


import { getAuth } from 'firebase/auth';

import { initializeApp, getApps } from 'firebase/app';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    CommonModule,
    MatIconModule,
    MatSidenavModule,
    MatToolbarModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatBadgeModule,
    MatCardModule,
    MatTabsModule,
    BrowserAnimationsModule, 
    ToastrModule.forRoot({
      timeOut: 10000, // 10 seconds
      extendedTimeOut: 5000, // 5 seconds after mouseover
      closeButton: true, // add a close button for user to dismiss manually if needed
      tapToDismiss: false
    }),
    SweetAlert2Module.forRoot(),
  ],
  providers: [
    provideHttpClient(withFetch()),
    provideClientHydration(),
    provideAnimationsAsync()
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {
    if (!getApps().length) {
      console.log('Initializing Firebase...');
      initializeApp(environment.firebaseConfig);
      console.log('Firebase initialized.');
    } else {
      console.log('Firebase already initialized.');
    }

    const auth = getAuth();
    if (auth) {
      console.log('Firebase Auth instance is available.');
    } else {
      console.error('Firebase Auth instance is not available.');
    }
  }
}
