// A deliberately tiny contract for generator tests, not a backend snapshot.
export const generatorFixture = {
  openapi: '3.1.0',
  info: { title: 'Generation test', version: '1' },
  paths: {
    '/health': {
      get: {
        operationId: 'get_api_v1_health',
        responses: {
          '200': {
            description: 'Healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', const: 'ok' } },
      },
    },
  },
}
