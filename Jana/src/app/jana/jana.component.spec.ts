import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JanaComponent } from './jana.component';

describe('JanaComponent', () => {
  let component: JanaComponent;
  let fixture: ComponentFixture<JanaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JanaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(JanaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
