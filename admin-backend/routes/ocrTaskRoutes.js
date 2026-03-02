const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const adminToken = process.env.ADMIN_TOKEN || '';

const upload = multer({ storage: multer.memoryStorage() });

// Helper to proxy requests
const proxyRequest = async (method, path, req, res, extraHeaders = {}) => {
  try {
    const url = `${pythonServiceUrl}/ocr${path}`;
    const response = await axios({
      method,
      url,
      data: req.body,
      params: req.query,
      headers: {
        'x-admin-token': adminToken,
        'Content-Type': 'application/json',
        ...extraHeaders
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

// List Tasks
router.get('/tasks', (req, res) => proxyRequest('GET', '/tasks', req, res));

// Create Task (supports file upload)
router.post('/tasks', upload.single('file'), async (req, res) => {
  try {
    const url = `${pythonServiceUrl}/ocr/tasks`;
    
    // Check if file is uploaded
    if (req.file) {
      const formData = new FormData();
      formData.append('file', req.file.buffer, req.file.originalname);
      
      // Append other fields
      if (req.body.template_id) formData.append('template_id', req.body.template_id);
      if (req.body.image_url) formData.append('image_url', req.body.image_url);

      const response = await axios.post(url, formData, {
        headers: {
          'x-admin-token': adminToken,
          ...formData.getHeaders()
        }
      });
      res.json(response.data);
    } else {
      // JSON request
      proxyRequest('POST', '/tasks', req, res);
    }
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Proxy error:', error.message);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }
});

// Get Task
router.get('/tasks/:id', (req, res) => proxyRequest('GET', `/tasks/${req.params.id}`, req, res));

// Get Results
router.get('/tasks/:id/results', (req, res) => proxyRequest('GET', `/tasks/${req.params.id}/results`, req, res));

module.exports = router;
