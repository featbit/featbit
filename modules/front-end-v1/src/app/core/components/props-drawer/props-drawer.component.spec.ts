import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropsDrawerComponent } from './props-drawer.component';

describe('PropsDrawerComponent', () => {
  let component: PropsDrawerComponent;
  let fixture: ComponentFixture<PropsDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PropsDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PropsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
