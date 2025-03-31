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
import { Wizard1Component } from './wizard-1/wizard-1.component';
import { Wizard2Component } from './wizard-2/wizard-2.component';
import { Wizard3Component } from './wizard-3/wizard-3.component';
import { JanaComponent } from './jana/jana.component';
import { LoginComponent } from './login/login.component';
import { HeaderComponent } from './header/header.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { DaltonDemoComponent } from './dalton-demo/dalton-demo.component';
import { BodyComponent } from './body/body.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule     } from '@angular/material/input';




import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { environment } from '../.env/environment';
import { TauriPersistence } from './tauri-firebase';


@NgModule({
  declarations: [
    AppComponent,
    Wizard1Component,
    Wizard2Component,
    Wizard3Component,
    JanaComponent,
    LoginComponent,
    HeaderComponent,
    SidenavComponent,
    DaltonDemoComponent,
    BodyComponent,
    LoginComponent,
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
    MatProgressBarModule,
    AnalyticsComponent,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
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
    let app;
    if (!getApps().length) {
      console.log('Initializing Firebase...');
      app = initializeApp(environment.firebaseConfig);
      console.log('Firebase initialized.');
    } else {
      app = getApp();
      console.log('Firebase already initialized.');
    }

    const auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence]
    });
    if (auth) {
      console.log('Firebase Auth instance is available.');
    } else {
      console.error('Firebase Auth instance is not available.');
    }
  }
}
