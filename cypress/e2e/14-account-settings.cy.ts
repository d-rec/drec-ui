describe('User Account Update', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should updates username, email, and password successfully', () => {
    cy.adminLogin().wait(20000);
  });
});
