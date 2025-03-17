// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import routeConfig from './app.routes'; // Adjust the path if necessary

@NgModule({
  imports: [RouterModule.forRoot(routeConfig)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
