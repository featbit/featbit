import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganizationDrawerComponent } from './organization-drawer.component';

describe('OrganizationDrawerComponent', () => {
  let component: OrganizationDrawerComponent;
  let fixture: ComponentFixture<OrganizationDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OrganizationDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrganizationDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
