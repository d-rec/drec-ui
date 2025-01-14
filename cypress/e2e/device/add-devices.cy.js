describe('Add divice Test', () => {
    beforeEach(()=>{
      cy.wait(1000);
    })
    it('should add new divice', () => {
      cy.dev_login().wait(6000);
      cy.add_device();
    });
  });