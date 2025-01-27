describe('Add meter Read', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add meter Read', () => {
    cy.dev_login().wait(20000);
    cy.add_meter_read();
  });
});
