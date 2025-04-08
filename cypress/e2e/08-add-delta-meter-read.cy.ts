describe('Add delta meter Read', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add delta meter Read', () => {
    cy.developerUserLogin().wait(20000);
    cy.addDeltaMeterRead();
  });
});
