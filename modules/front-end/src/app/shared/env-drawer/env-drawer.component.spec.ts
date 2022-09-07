import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnvDrawerComponent } from './env-drawer.component';

describe('EnvDrawerComponent', () => {
  let component: EnvDrawerComponent;
  let fixture: ComponentFixture<EnvDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EnvDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EnvDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
