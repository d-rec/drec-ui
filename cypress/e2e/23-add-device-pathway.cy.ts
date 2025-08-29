describe('Add device pathway', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add device pathway', () => {
    cy.developerUserLogin().wait(20000);
    cy.addDevicePathway();
  });
});
