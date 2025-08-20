describe('Add reservation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add reservation', () => {
    cy.developerUserLogin().wait(20000);
    cy.addDeviceGroup();
  });
});
