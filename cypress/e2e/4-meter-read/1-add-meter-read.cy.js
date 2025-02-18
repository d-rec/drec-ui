describe('Add meter Read', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add meter Read', () => {
    cy.developerUserLogin().wait(20000);
    cy.addMeterRead();
  });
});
