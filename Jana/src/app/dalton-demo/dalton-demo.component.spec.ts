import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DaltonDemoComponent } from './dalton-demo.component';

describe('DaltonDemoComponent', () => {
  let component: DaltonDemoComponent;
  let fixture: ComponentFixture<DaltonDemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DaltonDemoComponent],
      imports: [HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(DaltonDemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
