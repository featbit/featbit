import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoLoginComponent } from './do-login.component';
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";
import { NzMessageModule } from "ng-zorro-antd/message";

describe('DoLoginComponent', () => {
  let component: DoLoginComponent;
  let fixture: ComponentFixture<DoLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        FormsModule,
        HttpClientModule,
        NzMessageModule
      ],
      declarations: [ DoLoginComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DoLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
