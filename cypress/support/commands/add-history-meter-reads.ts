import 'cypress-file-upload';

Cypress.Commands.add('addHistoryMeterRead', () => {
  cy.fixture('add-history-meter-read.json').then(async (data) => {
    for (const step of data) {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).should('be.visible').click();
          break;

        case 'selected':
          cy.get(step.selector).should('be.visible').click({ force: true });
          cy.get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .should('be.visible')
            .click({ force: true });
          break;

        case 'select-timezone':
          cy.get(step.selector).should('be.visible').click({ force: true });
          cy.get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .should('be.visible')
            .click('center', { force: true });
          break;

        case 'select':
          cy.get(step.selector).should('be.visible').click({ force: true });
          cy.get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .should('be.visible')
            .click('center', { force: true });
          break;

        case 'type':
          cy.get(step.selector)
            .should('be.visible')
            .click({ force: true })
            .type(step.value, { force: true });
          break;

        case 'start-date':
          cy.get(step.selector)
            .eq(0)
            .should('be.visible')
            .click('center', { force: true });
          cy.get(step.option).eq(0).should('be.visible').click();
          cy.get('.mat-stroked-button').should('be.visible').click();
          break;

        case 'end-date':
          cy.get(step.selector)
            .eq(1)
            .should('be.visible')
            .click('center', { force: true });
          cy.get(step.option).eq(5).should('be.visible').click();
          cy.get('.mat-stroked-button').should('be.visible').click();
          break;

        case 'submit':
          cy.get(step.selector)
            .scrollIntoView()
            .should('be.visible')
            .click()
            .wait(1000);
          cy.contains('Successfully!').should('be.visible');
          break;

        default:
          throw new Error(`Unknown action type: ${step.action}`);
      }
    }
  });
});
