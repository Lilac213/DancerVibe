const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DancerVibe Admin API',
      version: '1.0.0'
    },
    servers: [
      { url: process.env.API_BASE_URL || 'https://dancervibe-admin-backend.up.railway.app' }
    ]
  },
  apis: []
});

openapiSpec.paths = {
  '/api/ocr/tasks': {
    get: { summary: 'List OCR tasks', responses: { 200: { description: 'OK' } } },
    post: { summary: 'Create OCR task', responses: { 200: { description: 'OK' } } }
  },
  '/api/ocr/tasks/{task_id}': {
    get: { summary: 'Get OCR task', responses: { 200: { description: 'OK' } } }
  },
  '/api/ocr/tasks/{task_id}/results': {
    get: { summary: 'Get OCR results', responses: { 200: { description: 'OK' } } }
  },
  '/api/templates': {
    get: { summary: 'List templates', responses: { 200: { description: 'OK' } } },
    post: { summary: 'Create template', responses: { 200: { description: 'OK' } } }
  },
  '/api/templates/{id}': {
    get: { summary: 'Get template', responses: { 200: { description: 'OK' } } }
  },
  '/api/templates/{id}/config': {
    put: { summary: 'Publish template config', responses: { 200: { description: 'OK' } } }
  },
  '/api/admin/rules': {
    get: { summary: 'List rules', responses: { 200: { description: 'OK' } } },
    post: { summary: 'Create rule', responses: { 200: { description: 'OK' } } }
  },
  '/api/admin/rules/{id}/set-current': {
    post: { summary: 'Set rule current', responses: { 200: { description: 'OK' } } }
  },
  '/api/admin/rules/{id}/gray-release': {
    post: { summary: 'Gray release rule', responses: { 200: { description: 'OK' } } }
  },
  '/api/admin/rules/test': {
    post: { summary: 'Test rule against input', responses: { 200: { description: 'OK' } } }
  }
};

module.exports = { swaggerUi, openapiSpec };
