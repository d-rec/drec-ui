import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrantPermissionComponent } from './registrant-permission.component';

describe('RegistrantPermissionComponent', () => {
  let component: RegistrantPermissionComponent;
  let fixture: ComponentFixture<RegistrantPermissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistrantPermissionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrantPermissionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
