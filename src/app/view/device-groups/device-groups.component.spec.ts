import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceGroups } from './device-groups.component';

describe('DeviceGroups', () => {
  let component: DeviceGroups;
  let fixture: ComponentFixture<DeviceGroups>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DeviceGroups],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceGroups);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
