import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDrawerComponent } from './account-drawer.component';

describe('AccountDrawerComponent', () => {
  let component: AccountDrawerComponent;
  let fixture: ComponentFixture<AccountDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AccountDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AccountDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
