import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Wizard1Component } from './wizard-1.component';

describe('Wizard1Component', () => {
  let component: Wizard1Component;
  let fixture: ComponentFixture<Wizard1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Wizard1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Wizard1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
