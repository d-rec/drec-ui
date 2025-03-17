/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    clearDatabase(): Chainable<void>;
    developerUserSignup(): Chainable<void>;
    buyerUserSignup(): Chainable<void>;
    adminLogin(): Chainable<void>;
    buyerUserPermissionsSetup(): Chainable<void>;
    developerUserPermissionsSetup(): Chainable<void>;
    addDevice(): Chainable<void>;
    addHistoryMeterRead(): Chainable<void>;
    addDeltaMeterRead(): Chainable<void>;
    developerUserLogin(): Chainable<void>;
    addAggregateMeterRead(): Chainable<void>;
    buyerUserLogin(): Chainable<void>;
    addReservation(): Chainable<void>;
    certificate(): Chainable<void>;
    certificateFilter(): Chainable<void>;
    bulkUpload(filename: string): Chainable<void>;
    accountSettings(): Chainable<void>;
  }
}
