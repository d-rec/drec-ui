import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiuserPermissionFormComponent } from './apiuser-permission-form.component';

describe('ApiuserPermissionFormComponent', () => {
  let component: ApiuserPermissionFormComponent;
  let fixture: ComponentFixture<ApiuserPermissionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ApiuserPermissionFormComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApiuserPermissionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
