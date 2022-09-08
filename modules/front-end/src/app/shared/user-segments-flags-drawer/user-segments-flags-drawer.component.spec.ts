import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserSegmentsFlagsDrawerComponent } from './props-drawer.component';

describe('PropsDrawerComponent', () => {
  let component: UserSegmentsFlagsDrawerComponent;
  let fixture: ComponentFixture<UserSegmentsFlagsDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserSegmentsFlagsDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserSegmentsFlagsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
