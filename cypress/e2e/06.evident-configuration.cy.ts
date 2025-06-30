describe('Add evident configuration', () => {
  beforeEach(() => {
    cy.wait(10000);
  });
  it('should test evident configuration', () => {
    cy.developerUserLogin().wait(6000);
    cy.evidentConfiguration();
  });
});
