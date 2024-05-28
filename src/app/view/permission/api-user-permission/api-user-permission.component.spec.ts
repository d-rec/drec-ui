import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiUserPermissionComponent } from './api-user-permission.component';

describe('ApiUserPermissionComponent', () => {
  let component: ApiUserPermissionComponent;
  let fixture: ComponentFixture<ApiUserPermissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApiUserPermissionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiUserPermissionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
