import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditCountryYieldvalueComponent } from './edit-country-yieldvalue.component';

describe('EditCountryYieldvalueComponent', () => {
  let component: EditCountryYieldvalueComponent;
  let fixture: ComponentFixture<EditCountryYieldvalueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditCountryYieldvalueComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EditCountryYieldvalueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
