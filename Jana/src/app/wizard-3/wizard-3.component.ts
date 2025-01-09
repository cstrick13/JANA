import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-wizard-3',
  standalone: true,
  imports: [CommonModule, RouterOutlet,RouterModule],
  templateUrl: './wizard-3.component.html',
  styleUrl: './wizard-3.component.css'
})
export class Wizard3Component {

}
