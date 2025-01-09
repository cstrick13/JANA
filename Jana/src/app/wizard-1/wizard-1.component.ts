import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-wizard-1',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule],
  templateUrl: './wizard-1.component.html',
  styleUrl: './wizard-1.component.css'
})
export class Wizard1Component {

}
