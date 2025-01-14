describe('Admin login', () => {
    beforeEach(()=>{
      cy.wait(1000);
     
    })
    it('Admin should login successfully', () => {
      cy.admin-login();
    });
  });