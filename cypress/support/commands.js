const ADMIN_EMAIL = Cypress.env("ADMIN_EMAIL");
const ADMIN_PASSWORD = Cypress.env("ADMIN_PASSWORD");
const REACT_APP_BACKEND_URL = Cypress.env("REACT_APP_BACKEND_URL");
const UI_BASE_URL=Cypress.env("UI_BASE_URL");


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
      cy.log(`Failed to clear database: ${response.body.error || 'Unknown error'}`);
    }
  });
});


Cypress.Commands.add('signupdev', function () {
  cy.fixture('signupdev.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000); 
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

Cypress.Commands.add('signupbuyer', function () {
  cy.fixture('signupbuyer.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000); 
    cy.get('[data-testid="register"]').click();
    data.forEach((step) => {
  
    if (step.action === "type") {
      return cy.get(step.selector).type(step.value)
      .should('have.value', step.value);
      
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

Cypress.Commands.add('adminlogin', function () {
  
  cy.fixture('adminlogin.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000); 
    data.forEach((step) => {
  
    
      if (step.action === "type") {
        if (step.index === 0) {
          return cy.get(step.selector).type(ADMIN_EMAIL);
        }
        if (step.index === 1) {
          return cy.get(step.selector).type(ADMIN_PASSWORD);
        }
      }
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
  });
  });
});

Cypress.Commands.add('permissions', function () {
  
  cy.fixture('permissions.js').then((data) => { 
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).should('be.visible').click().wait(1000);
    }
    if (step.action === "select") {
      return cy.get(step.selector).click()
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(1)
        .click(); 
    }
    if (step.action === "check") {
      return cy.get(step.selector).eq(step.index).click();
    }  
    if (step.action === "check-multiple") {
      return cy.contains("table tr", step.contains) 
          .within(() => {
              cy.get(step.selector).each(($el) => {
                  cy.wrap($el).click(); 
              });
          });
  }
  if (step.action === "submit"){
    return cy.get(step.selector).scrollIntoView().should('be.visible').click();
  }
  });
  });
});


Cypress.Commands.add('buyerpermissions', function () {
  
  cy.fixture('buyerpermissions.js').then((data) => { 
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).should('be.visible').click().wait(1000);
    }
    if (step.action === "select") {
      return cy.get(step.selector).click()
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(3)
        .click().wait(1000); 
    }
    if (step.action === "check") {
      return cy.get(step.selector).eq(step.index).click();
    }  
    if (step.action === "check-multiple") {
      return cy.contains("table tr", step.contains) 
          .within(() => {
              cy.get(step.selector).each(($el) => {
                  cy.wrap($el).click(); 
              });
          });
  }
  if (step.action === "submit"){
    return cy.get(step.selector).scrollIntoView().should('be.visible').click();
  }
  });
  });
});

Cypress.Commands.add('addDevice', function () {
  
  cy.fixture('addDevice.js').then((data) => { 
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
    if (step.action === "type") {
      return cy.get(step.selector).should('be.visible').type(step.value);
    }
    if (step.action === "write") {
      return cy.get(step.selector)
      .should('be.visible') 
      .clear()              
      .type(step.value + '{enter}'); 
        }
    if (step.action === "select") {
      return cy.get(step.selector).click()
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(0)
        .click(); 
    }
    if (step.action === "submit") {
      return cy.get(step.selector).click('center', { force: true });
    }
  });
  });
});

Cypress.Commands.add('addMeterRead', function () {
  
  cy.fixture('addMeterRead.js').then((data) => { 
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
    if (step.action === "selected") {
       return  cy.get(step.selector).click({ force: true }).wait(1000)
           .get(step.option)
           .should('have.length.greaterThan', 0)
           .first() 
           .should('be.visible') 
           .click({ force: true }) 
           .wait(1000); 
}

    
    if (step.action === "select-timezone") {
      return cy.get(step.selector).click({ force: true })
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(0)
        .click('center', { force: true }); 
    }
    if (step.action === "select") {
      return cy.get(step.selector).click({ force: true })
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(0)
        .click('center', { force: true }); 
    }
    
    if (step.action === "type") {
      return cy.get(step.selector).wait(1000)  
      .click({ force: true }) 
      .type(step.value, { force: true });
    }
    if (step.action === "start-date") {
      return cy.get(step.selector).eq(0).click('center', { force: true })
              .get(step.option).eq(0).click()
              .get(".mat-stroked-button").click();
    }
    if (step.action === "end-date") {
      return cy.get(step.selector).eq(1).click('center', { force: true })
              .get(step.option).eq(5).click()
              .get(".mat-stroked-button").click();
    }
  });
  });
});


Cypress.Commands.add('addReservation', function () {
  
  cy.fixture('addReservation.js').then((data) => { 
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
    if (step.action === "type") {
      return cy.get(step.selector).should('be.visible').type(step.value,{ force: true });
    }
    if (step.action === "select") {
      return cy.get(step.selector).click({ force: true })
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(0)
        .click('center', { force: true }); 
    }
    if (step.action === "check") {
      return cy.get(step.selector).eq(step.index).click();
    } 
  });
});
});


Cypress.Commands.add('devlogin', function () {
  
  cy.fixture('devlogin.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000); 
    data.forEach((step) => {
  
    
      if (step.action === "type") {
        
          return cy.get(step.selector).type(step.value);
        }
        
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
  });
  });
});


Cypress.Commands.add('buyerlogin', function () {
  
  cy.fixture('buyerlogin.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000); 
    data.forEach((step) => {
  
    
      if (step.action === "type") {
        
          return cy.get(step.selector).type(step.value);
        }
        
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
  });
  });
});


Cypress.Commands.add('certficate', function () {
  cy.fixture('certficate.js').then((data) => {
    data.forEach((step) => {   
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
  });
  });
});