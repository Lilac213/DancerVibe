const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 20000,
  pingTimeout: 20000,
  cors: { 
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.FRONTEND_URL, 
        'https://dancervibe-admin.up.railway.app', 
        'https://dancervibe-admin-backend.up.railway.app',
        'http://localhost:3000',
        'http://localhost:5173'
      ].filter(Boolean);

      if (allowedOrigins.includes(origin) || process.env.FRONTEND_URL === '*') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true 
  }
});

app.set('trust proxy', 1);

// Allow CORS from frontend domain
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL, 
      'https://dancervibe-admin.up.railway.app', 
      'https://dancervibe-admin-backend.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ].filter(Boolean);

    if (allowedOrigins.includes(origin) || process.env.FRONTEND_URL === '*') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "connect-src": ["'self'", "https:", "wss:", "ws:"],
      "img-src": ["'self'", "data:", "https:", "*"]
    },
  },
}));
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120
});
app.use(limiter);
const crawlerRoutes = require('./routes/crawlerRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const statsRoutes = require('./routes/statsRoutes');
const configsRoutes = require('./routes/configsRoutes');
const crawlItemsRoutes = require('./routes/crawlItemsRoutes');
const templatesRoutes = require('./routes/templatesRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dictRoutes = require('./routes/dictRoutes');
const ocrTaskRoutes = require('./routes/ocrTaskRoutes');
const { swaggerUi, openapiSpec } = require('./openapi');

const path = require('path');

// Routes
app.use('/api/crawler', crawlerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/configs', configsRoutes.router);
app.use('/api/crawl-items', crawlItemsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dict', dictRoutes);
app.use('/api/ocr', ocrTaskRoutes);

app.get('/api/openapi.json', (req, res) => {
  res.json(openapiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../admin-frontend-vue/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-frontend-vue/dist/index.html'));
});

io.on('connection', () => {});
app.set('io', io);

const { supabase } = require('./supabaseClient');
function isoDate(d) { return d.toISOString().slice(0,10); }
async function checkAndEmitAlerts() {
  try {
    const today = new Date();
    const resp = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('course_date', isoDate(today));
    const count = resp.count ?? 0;
    if (count === 0) {
      io.emit('alert', { type: 'no_data_today', message: '今日暂未入库课程表' });
    }
  } catch (e) {
    // ignore
  }
}
setInterval(checkAndEmitAlerts, 60 * 1000);

const pollInterval = parseInt(process.env.CRAWL_POLL_INTERVAL_MS || '600000', 10);
setInterval(() => {
  configsRoutes.runAllConfigs(io);
}, pollInterval);

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
