import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricDrawerComponent } from './metric-drawer.component';

describe('MetricDrawerComponent', () => {
  let component: MetricDrawerComponent;
  let fixture: ComponentFixture<MetricDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MetricDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MetricDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
