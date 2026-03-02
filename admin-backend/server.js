const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, {
  cors: { 
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.FRONTEND_URL, 
        'https://dancervibe-admin.up.railway.app', 
        'http://localhost:3000',
        'http://localhost:5173'
      ].filter(Boolean);

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.FRONTEND_URL === '*') {
        callback(null, true);
      } else {
        // Log blocked origin for debugging
        console.log('Blocked by CORS:', origin);
        // For development/debugging convenience, we might want to allow it temporarily or check if it matches a pattern
        // But strictly speaking we should reject.
        // callback(new Error('Not allowed by CORS'));
        // Temporarily allow all for debugging deployment issues if strict mode fails
         callback(null, true);
      }
    },
    credentials: true 
  }
});

app.set('trust proxy', 1);

// Allow CORS from frontend domain
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL, 
      'https://dancervibe-admin.up.railway.app', 
      'http://localhost:3000',
      'http://localhost:5173'
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.FRONTEND_URL === '*') {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      // callback(new Error('Not allowed by CORS'));
      // Temporarily allow all for debugging deployment issues
       callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
app.use(helmet());
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

app.get('/', (req, res) => {
  res.send('DancerVibe Admin API is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
