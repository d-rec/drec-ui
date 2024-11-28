Cypress.Commands.add('clearDatabase', () => {
  // Custom retry logic
  const maxRetries = 10; // Max number of retries
  const retryInterval = 5000; // 5 seconds interval between retries

  function checkBackendHealth(retries) {
    // Make a request to the health check endpoint
    cy.request({
      method: 'GET',
      url: `${Cypress.env('REACT_APP_BACKEND_URL')}/health`, // Health check endpoint
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 200) {
        // If the backend is healthy, proceed with clearing the database
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('REACT_APP_BACKEND_URL')}/api/testing/clear-db`,
          failOnStatusCode: false,
        }).then((deleteResponse) => {
          if (deleteResponse.status === 200) {
            cy.log('Database cleared successfully');
          } else {
            cy.log(`Failed to clear database: ${deleteResponse.body.error || 'Unknown error'}`);
          }
        });
      } else if (retries < maxRetries) {
        // If the backend is not ready, retry after an interval
        cy.log(`Backend not ready, retrying... (${retries + 1}/${maxRetries})`);
        cy.wait(retryInterval); // Wait before retrying
        checkBackendHealth(retries + 1); // Retry the check
      } else {
        cy.log('Backend is not available after maximum retries');
      }
    });
  }

  // Start the retry logic
  checkBackendHealth(0);
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
