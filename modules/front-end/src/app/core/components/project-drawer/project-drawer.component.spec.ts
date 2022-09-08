import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectDrawerComponent } from './project-drawer.component';

describe('ProjectDrawerComponent', () => {
  let component: ProjectDrawerComponent;
  let fixture: ComponentFixture<ProjectDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
