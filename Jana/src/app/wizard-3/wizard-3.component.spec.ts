import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Wizard3Component } from './wizard-3.component';

describe('Wizard3Component', () => {
  let component: Wizard3Component;
  let fixture: ComponentFixture<Wizard3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Wizard3Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Wizard3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
