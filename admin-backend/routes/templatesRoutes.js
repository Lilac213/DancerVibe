const express = require('express');
const router = express.Router();
const axios = require('axios');

const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const adminToken = process.env.ADMIN_TOKEN || '';

const proxyRequest = async (method, path, req, res) => {
  try {
    const url = `${pythonServiceUrl}/templates${path}`;
    const response = await axios({
      method,
      url,
      data: req.body,
      params: req.query,
      headers: {
        'x-admin-token': adminToken,
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Proxy error:', error.message);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }
};

// Rules CRUD (Specific routes first)
router.put('/rules/:id', (req, res) => proxyRequest('PUT', `/rules/${req.params.id}`, req, res));
router.delete('/rules/:id', (req, res) => proxyRequest('DELETE', `/rules/${req.params.id}`, req, res));

// Template Config Update
router.put('/:id/config', (req, res) => proxyRequest('PUT', `/${req.params.id}/config`, req, res));

// Template CRUD
router.get('/:id', (req, res) => proxyRequest('GET', `/${req.params.id}`, req, res));
router.put('/:id', (req, res) => proxyRequest('PUT', `/${req.params.id}`, req, res));
router.delete('/:id', (req, res) => proxyRequest('DELETE', `/${req.params.id}`, req, res));

// List/Create Templates
router.get('/', (req, res) => proxyRequest('GET', '', req, res));
router.post('/', (req, res) => proxyRequest('POST', '', req, res));

module.exports = router;
