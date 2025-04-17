import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitchInterfaceComponent } from './switch-interface.component';

describe('SwitchInterfaceComponent', () => {
  let component: SwitchInterfaceComponent;
  let fixture: ComponentFixture<SwitchInterfaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchInterfaceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SwitchInterfaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
