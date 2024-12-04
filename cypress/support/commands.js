Cypress.Commands.add('clearDatabase', () => {
  cy.request({
    method: 'DELETE',
    url: " REACT_APP_BACKEND_URL:3040/api/testing/clear-db",  // Use service name "backend"
    failOnStatusCode: false,
    timeout: 10000,
  }).then((response) => {
    if (response.status === 200) {
      cy.log('Database cleared successfully');
    } else {
      cy.log(`Failed to clear database: ${response.body.error || 'Unknown error'}`);
    }
  });
});


Cypress.Commands.add('signup', function () {
  
  cy.fixture('signup.js').then((data) => {
    cy.visit('http://localhost:4200/login').wait(1000); 
    
    cy.get('[data-testid="register"]').click();
    data.forEach((step) => {
  
    if (step.action === "type") {
      return cy.get(step.selector).type(step.value);
      
    } 
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
    if (step.action === 'select') {
      return cy
        .get(step.selector) 
        .click() 
        .then(() => {
          cy.get('mat-option') 
            .contains(step.value) 
            .click(); 
        });
    }
  });
  });
});
