describe('Add history meter Read', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.wait(1000);
  });
  it('should add history meter Read', () => {
    cy.developerUserLogin().wait(50000);
    cy.addHistoryMeterRead();
  });
});
