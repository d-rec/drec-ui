describe('Add device registration on evident Test', () => {
  beforeEach(() => {
    cy.wait(10000);
  });
  it('should test device registration on evident', () => {
    cy.developerUserLogin().wait(6000);
    cy.evidentConfiguration();
  });
});
