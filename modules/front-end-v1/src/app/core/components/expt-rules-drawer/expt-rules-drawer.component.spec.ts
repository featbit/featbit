import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExptRulesDrawerComponent } from './expt-rules-drawer.component';

describe('ExptRulesDrawerComponent', () => {
  let component: ExptRulesDrawerComponent;
  let fixture: ComponentFixture<ExptRulesDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExptRulesDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExptRulesDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
