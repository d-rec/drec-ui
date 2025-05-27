const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('loginViaAPI', (username, password) => {
  cy.visit(`${UI_BASE_URL}/login`);

  cy.request('POST', '/login', { username, password }).then((response) => {
    const token = response.body.authToken;
    localStorage.setItem('authToken', token);
    cy.log(`token====${token}====`);
  });
  cy.visit('/dashboard');
});
