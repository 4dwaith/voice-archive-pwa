import type { OpenAPIV3_1 } from 'openapi-types'

function jsonResponse(schemaName: string) {
  return {
    description: schemaName,
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  } satisfies OpenAPIV3_1.ResponseObject
}

// Valid generator input exercising our integration rules, not a backend snapshot.
export const integrationContract = {
  openapi: '3.1.0',
  info: { title: 'Generator integration test', version: '1' },
  paths: {
    '/result': {
      get: {
        operationId: 'get_api_v1_result',
        responses: {
          '200': jsonResponse('ExistingResult'),
          '202': jsonResponse('PendingResult'),
          '404': jsonResponse('MissingResult'),
          '409': jsonResponse('ConflictResult'),
        },
      },
      delete: {
        operationId: 'delete_api_v1_result',
        responses: {
          '204': { description: 'Deleted without a response body' },
          '404': jsonResponse('MissingResult'),
        },
      },
    },
    '/files': {
      post: {
        operationId: 'create_api_v1_file',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    contentMediaType: 'application/octet-stream',
                  },
                },
              },
            },
          },
        },
        responses: { '201': jsonResponse('ExistingResult') },
      },
    },
    '/pdf': {
      get: {
        operationId: 'get_api_v1_pdf',
        responses: {
          '200': {
            description: 'PDF bytes',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '404': jsonResponse('MissingResult'),
        },
      },
      head: {
        operationId: 'head_api_v1_pdf',
        responses: { '200': { description: 'PDF headers only' } },
      },
    },
  },
  components: {
    schemas: {
      ExistingResult: {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1, maxLength: 3 },
        },
      },
      PendingResult: {
        type: 'object',
        required: ['ticket'],
        properties: { ticket: { type: 'string' } },
      },
      MissingResult: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', const: 'not_found' } },
      },
      ConflictResult: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', const: 'conflict' } },
      },
    },
  },
} satisfies OpenAPIV3_1.Document
