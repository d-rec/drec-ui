import 'cypress-file-upload';

Cypress.Commands.add('addDeltaMeterRead', function () {
    cy.fixture('add-delta-meter-read.js').then((data) => {
      data.forEach((step) => {
        if (step.action === 'click') {
          return cy.get(step.selector).click().wait(1000);
        }
        if (step.action === 'selected') {
          return cy
            .get(step.selector)
            .click({ force: true })
            .wait(1000)
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .should('be.visible')
            .click({ force: true })
            .wait(1000);
        }
        if (step.action === 'select-timezone') {
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });
        }
        if (step.action === 'select') {
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(1)
            .click('center', { force: true });
        }
  
        if (step.action === 'type') {
          return cy
            .get(step.selector)
            .wait(1000)
            .click({ force: true })
            .type(step.value, { force: true });
        }
        if (step.action === 'date-picker') {
          
          const currentTime = new Date();
          currentTime.setHours(currentTime.getHours() + 2); 
          
          const formattedTime = currentTime.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
  
          return cy
            .get(step.selector)
            .wait(1000)
            .click({ force: true })
            .type(formattedTime, { force: true })  
            .click();  
        }
  
      });
    });
  });