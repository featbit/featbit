import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadDrawerComponent } from './upload-drawer.component';

describe('UploadDrawerComponent', () => {
  let component: UploadDrawerComponent;
  let fixture: ComponentFixture<UploadDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UploadDrawerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UploadDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
