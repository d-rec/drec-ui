import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrantPermissionFormComponent } from './registrant-permission-form.component';

describe('RegistrantPermissionFormComponent', () => {
  let component: RegistrantPermissionFormComponent;
  let fixture: ComponentFixture<RegistrantPermissionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistrantPermissionFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrantPermissionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
