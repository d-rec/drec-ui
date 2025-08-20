import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleDevicePathwayComponent } from './single-device-pathway.component';

describe('SingleDevicePathwayComponent', () => {
  let component: SingleDevicePathwayComponent;
  let fixture: ComponentFixture<SingleDevicePathwayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SingleDevicePathwayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SingleDevicePathwayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
