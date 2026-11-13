export function requestApi(
  methodOrOptions: string | Partial<Cypress.RequestOptions>,
  url?: string,
  body?: Cypress.RequestBody,
) {
  let options: Partial<Cypress.RequestOptions>
  if (typeof methodOrOptions !== 'string') options = methodOrOptions
  else if (url === undefined) options = { url: methodOrOptions }
  else options = { method: methodOrOptions, url, body }
  return cy.request({
    ...options,
    headers: {
      Origin: new URL(Cypress.config('baseUrl')!).origin,
      ...options.headers,
    },
  })
}
