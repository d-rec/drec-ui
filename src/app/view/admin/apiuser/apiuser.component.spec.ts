import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiuserComponent } from './apiuser.component';

describe('ApiuserComponent', () => {
  let component: ApiuserComponent;
  let fixture: ComponentFixture<ApiuserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApiuserComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiuserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
