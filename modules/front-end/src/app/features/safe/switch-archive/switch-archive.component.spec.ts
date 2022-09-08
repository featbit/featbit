import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitchArchiveComponent } from './switch-archive.component';

describe('SwitchArchiveComponent', () => {
  let component: SwitchArchiveComponent;
  let fixture: ComponentFixture<SwitchArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SwitchArchiveComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SwitchArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
