import 'cypress-file-upload';
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');

Cypress.Commands.add('clearDatabase', () => {
    cy.request({
      method: 'DELETE',
      url: `${REACT_APP_BACKEND_URL}/api/testing/clear-db`,
      failOnStatusCode: false,
      timeout: 10000,
    }).then((response) => {
      if (response.status === 200) {
        cy.log('Database cleared successfully');
      } else {
        cy.log(
          `Failed to clear database: ${response.body.error || 'Unknown error'}`,
        );
      }
    });
  });