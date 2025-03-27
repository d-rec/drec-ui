describe('Generate and Filter certified meter reads', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should generate and filter certified meter reads', () => {
    cy.developerUserLogin().wait(20000);
    cy.certifiedMeterRead();
  });
});
