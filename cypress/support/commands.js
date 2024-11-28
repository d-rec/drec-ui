
Cypress.Commands.add('clearDatabase', () => {
  cy.waitUntil(() => {
    return cy.request({
      method: 'GET',
      url: `${Cypress.env('REACT_APP_BACKEND_URL')}/health`, 
      failOnStatusCode: false,
    }).then((response) => {
      return response.status === 200;
    });
  }, { timeout: 60000, interval: 5000 }).then(() => {
    cy.request({
      method: 'DELETE',
      url: `${Cypress.env('REACT_APP_BACKEND_URL')}/api/testing/clear-db`,
      failOnStatusCode: false, 
    }).then((response) => {
      if (response.status === 200) {
        cy.log('Database cleared successfully');
      } else {
        cy.log(`Failed to clear database: ${response.body.error || response.statusText || 'Unknown error'}`);
      }
    });
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
