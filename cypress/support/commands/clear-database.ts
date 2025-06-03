import 'cypress-file-upload';
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');

Cypress.Commands.add('clearDatabase', () => {
  cy.request('POST', 'http://localhost:3040/api/test/reset-db');
});
