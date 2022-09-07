import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberDrawerComponent } from './member-drawer.component';

describe('MemberDrawerComponent', () => {
  let component: MemberDrawerComponent;
  let fixture: ComponentFixture<MemberDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MemberDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MemberDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
