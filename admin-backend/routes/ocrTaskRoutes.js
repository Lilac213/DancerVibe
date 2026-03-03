const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const adminToken = process.env.ADMIN_TOKEN || '';

const upload = multer({ storage: multer.memoryStorage() });

// 模拟OCR任务数据 - 当Python服务不可用时使用
const mockTasks = [
  {
    id: '1',
    status: 'completed',
    created_at: '2024-01-15T10:30:00Z',
    template_id: 'template_1',
    image_url: 'https://example.com/image1.jpg',
    results: {
      text: '模拟OCR结果文本',
      confidence: 0.95,
      extracted_data: {
        date: '2024-01-15',
        time: '10:30',
        course: '舞蹈课程A'
      }
    }
  },
  {
    id: '2',
    status: 'processing',
    created_at: '2024-01-15T11:00:00Z',
    template_id: 'template_2',
    image_url: 'https://example.com/image2.jpg',
    results: null
  }
];

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    python_service: {
      url: pythonServiceUrl,
      configured: !!pythonServiceUrl && pythonServiceUrl !== 'http://localhost:8000',
      token_configured: !!adminToken
    }
  });
});

// Helper to proxy requests with fallback
const proxyRequest = async (method, path, req, res, extraHeaders = {}) => {
  try {
    // 检查Python服务是否配置
    if (!pythonServiceUrl || pythonServiceUrl === 'http://localhost:8000') {
      console.warn('Python服务未配置，使用模拟数据');
      return res.json({
        tasks: mockTasks,
        total: mockTasks.length,
        message: 'Using mock data - Python service not configured'
      });
    }

    const url = `${pythonServiceUrl}/ocr${path}`;
    const response = await axios({
      method,
      url,
      data: req.body,
      params: req.query,
      timeout: 10000, // 增加超时时间到10秒
      headers: {
        'x-admin-token': adminToken,
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // 网络错误或超时，返回模拟数据
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.warn('Python服务连接失败，使用模拟数据');
      return res.json({
        tasks: mockTasks,
        total: mockTasks.length,
        message: 'Using mock data - Python service unavailable'
      });
    }

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Internal Server Error', 
        details: error.message,
        fallback: 'Python service connection failed'
      });
    }
  }
};

// List Tasks - 带降级处理
router.get('/tasks', async (req, res) => {
  try {
    // 如果Python服务未配置，直接返回模拟数据
    if (!pythonServiceUrl || pythonServiceUrl === 'http://localhost:8000') {
      console.warn('Python服务未配置，使用模拟数据');
      return res.json({
        tasks: mockTasks,
        total: mockTasks.length,
        message: 'Using mock data - Python service not configured'
      });
    }

    await proxyRequest('GET', '/tasks', req, res);
  } catch (error) {
    console.error('获取任务列表错误:', error.message);
    res.json({
      tasks: mockTasks,
      total: mockTasks.length,
      message: 'Using mock data due to error'
    });
  }
});

// Create Task (supports file upload)
router.post('/tasks', upload.single('file'), async (req, res) => {
  try {
    // 如果Python服务未配置，创建模拟任务
    if (!pythonServiceUrl || pythonServiceUrl === 'http://localhost:8000') {
      console.warn('Python服务未配置，创建模拟任务');
      const newTask = {
        id: Date.now().toString(),
        status: 'processing',
        created_at: new Date().toISOString(),
        template_id: req.body.template_id || 'default_template',
        image_url: req.body.image_url || 'https://example.com/uploaded-image.jpg',
        message: 'Task created with mock data - Python service not configured'
      };
      mockTasks.unshift(newTask);
      return res.status(201).json(newTask);
    }

    const url = `${pythonServiceUrl}/ocr/tasks`;
    
    // Check if file is uploaded
    if (req.file) {
      const formData = new FormData();
      formData.append('file', req.file.buffer, req.file.originalname);
      
      // Append other fields
      if (req.body.template_id) formData.append('template_id', req.body.template_id);
      if (req.body.image_url) formData.append('image_url', req.body.image_url);

      const response = await axios.post(url, formData, {
        timeout: 30000, // 文件上传超时30秒
        headers: {
          'x-admin-token': adminToken,
          ...formData.getHeaders()
        }
      });
      res.json(response.data);
    } else {
      // JSON request
      const response = await axios.post(url, req.body, {
        timeout: 10000, // JSON请求超时10秒
        headers: {
          'x-admin-token': adminToken,
          'Content-Type': 'application/json'
        }
      });
      res.json(response.data);
    }
  } catch (error) {
    console.error('创建任务错误:', error.message);
    
    // 网络错误或超时，返回模拟任务
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.warn('Python服务连接失败，创建模拟任务');
      const newTask = {
        id: Date.now().toString(),
        status: 'processing',
        created_at: new Date().toISOString(),
        template_id: req.body.template_id || 'default_template',
        image_url: req.body.image_url || 'https://example.com/uploaded-image.jpg',
        message: 'Task created with mock data - Python service unavailable'
      };
      mockTasks.unshift(newTask);
      return res.status(201).json(newTask);
    }

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Internal Server Error', 
        details: error.message,
        fallback: 'Task creation failed'
      });
    }
  }
});

// Get Task
router.get('/tasks/:id', (req, res) => {
  // 如果请求模拟任务ID，直接返回
  const task = mockTasks.find(t => t.id === req.params.id);
  if (task) {
    return res.json(task);
  }
  
  proxyRequest('GET', `/tasks/${req.params.id}`, req, res);
});

// Get Results
router.get('/tasks/:id/results', (req, res) => {
  // 如果请求模拟任务结果，直接返回
  const task = mockTasks.find(t => t.id === req.params.id);
  if (task && task.results) {
    return res.json(task.results);
  }
  
  proxyRequest('GET', `/tasks/${req.params.id}/results`, req, res);
});

module.exports = router;