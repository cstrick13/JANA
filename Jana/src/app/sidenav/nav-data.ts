import { RouterLink } from "@angular/router";

export const navbarData = [
    {
        routeLink: 'dashboard',
        icon: 'fas fa-home', // Change 'fal' to 'fas' if using solid icons
        label: 'Dashboard'
    },
    {
        routeLink: 'create',
        icon: 'fas fa-wrench', // Change 'fal' to 'fas' if using solid icons
        label: 'Build'
    },
    {
        routeLink: 'export',
        icon: 'fas fa-file', // Change 'fal' to 'fas' if using solid icons
        label: 'Export'
    },
    {
        routeLink: 'settings',
        icon: 'fas fa-cog', // Change 'fal' to 'fas' if using solid icons
        label: 'Settings'
    },
];