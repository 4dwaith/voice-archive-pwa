import { mount } from 'cypress/react'
import '@testing-library/cypress/add-commands'
import '@cypress/code-coverage/support'
import '../../src/index.css'

Cypress.Commands.add('mount', mount)

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}
