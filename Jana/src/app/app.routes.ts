import { Routes } from "@angular/router";
import { Wizard1Component } from "./wizard-1/wizard-1.component";
import { Wizard2Component } from "./wizard-2/wizard-2.component";
import { HomeComponent } from "./home/home.component";
import { Wizard3Component } from "./wizard-3/wizard-3.component";
import { DaltonDemoComponent } from "./dalton-demo/dalton-demo.component";
import { JanaComponent } from "./jana/jana.component";
import { AuthGuard } from "./auth.guard";
import { LoginComponent } from "./login/login.component";
import { AnalyticsComponent } from "./analytics/analytics.component";
import { SwitchInterfaceComponent } from "./switch-interface/switch-interface.component";



const routeConfig: Routes = [
    {
        path: "home",
        component: HomeComponent,
        title: "Home",
        canActivate: [AuthGuard]
    },
    {
        path: "",
        component: HomeComponent,
        title: "Home",
        canActivate: [AuthGuard]
    },
    {
        path:"jana",
        component: JanaComponent,
        title: "Jana",
    },
    {
        path: "step1",
        component: Wizard1Component,
        title: "Wizard 1",
    },
    {
        path: "step2",
        component: Wizard2Component,
        title: "Wizard 2",
    },
    {
        path: "step3",
        component: Wizard3Component,
        title: "Wizard 3",
    },
    {
        path: "analytics",
        component: AnalyticsComponent,
        title: "Analytics",
    },
    {
    path: "recording",
    component: DaltonDemoComponent,
    title: "Dalton Demo",
    },
    {
        path: "ports",
        component: SwitchInterfaceComponent,
        title: "Ports",
    },

]

export default routeConfig;