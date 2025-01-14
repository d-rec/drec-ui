describe('Add meter Read', () => {
    beforeEach(()=>{
      cy.wait(1000);
    })
    it('should add meter Read', () => {
      cy.dev-login().wait(20000);
      cy.add-meter-read();
    });
  });