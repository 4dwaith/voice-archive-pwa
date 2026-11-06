import { mount } from 'cypress/react'
import '@testing-library/cypress/add-commands'
import '@cypress/code-coverage/support'
import '../../src/index.css'
import { database } from '../../src/data/database'

beforeEach(() => {
  cy.then(async () => {
    await database.delete()
    await database.open()
  })
})

Cypress.Commands.add('mount', mount)

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}
