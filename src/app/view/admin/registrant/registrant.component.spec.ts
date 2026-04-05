import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrantComponent } from './registrant.component';

describe('RegistrantComponent', () => {
  let component: RegistrantComponent;
  let fixture: ComponentFixture<RegistrantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistrantComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
