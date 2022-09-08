import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExperimentDrawerComponent } from './experiment-drawer.component';

describe('ExperimentDrawerComponent', () => {
  let component: ExperimentDrawerComponent;
  let fixture: ComponentFixture<ExperimentDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExperimentDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExperimentDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
