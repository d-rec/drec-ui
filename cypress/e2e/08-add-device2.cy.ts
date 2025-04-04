describe('Add second device Test', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add new device', () => {
    cy.developerUserLogin().wait(6000);
    cy.addDevice2();
  });
});
