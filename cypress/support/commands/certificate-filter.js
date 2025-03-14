import 'cypress-file-upload';

Cypress.Commands.add('certificateFilter', function () {
    cy.fixture('certificate-filter.js').then((data) => {
      data.forEach((step) => {
        if (step.action === 'click') {
          cy.get(step.selector).click().wait(1000);
        }
        if (step.action === 'select') {
          cy.get(step.selector).click({ force: true });
          cy.get('body').then(($body) => {
            if ($body.find(step.option).length > 0) {
              cy.get(step.option)
                .should('have.length.greaterThan', 0)
                .eq(0)
                .click('center', { force: true });
              cy.get('[test-id="filter-button"]').click({ force: true });
            } else {
              cy.get('[test-id="dropdown-no-selection"]').click({ force: true });
              cy.get('[test-id="filter-button"]').click({ force: true });
              cy.get('[test-id="no-certificate"]', { timeout: 5000 })
                .should('be.visible')
                .should('contain', 'No Certificate');
            }
          });
        }
      });
    });
  });