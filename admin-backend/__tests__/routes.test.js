const request = require('supertest');
const express = require('express');

jest.mock('../supabaseClient', () => {
  const makeBuilder = (result) => {
    const builder = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      gte: () => builder,
      lte: () => builder,
      ilike: () => builder,
      or: () => builder,
      in: () => builder,
      is: () => builder,
      range: () => builder,
      single: () => Promise.resolve(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    return builder;
  };
  return {
    supabase: {
      from: jest.fn(() => makeBuilder({ data: [], error: null }))
    }
  };
});

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn()
}));

const { supabase } = require('../supabaseClient');
const axios = require('axios');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/crawler', require('../routes/crawlerRoutes'));
  app.use('/api/upload', require('../routes/uploadRoutes'));
  const configsRoutes = require('../routes/configsRoutes');
  app.use('/api/configs', configsRoutes.router);
  app.use('/api/crawl-items', require('../routes/crawlItemsRoutes'));
  app.use('/api/templates', require('../routes/templatesRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/stats', require('../routes/statsRoutes'));
  return app;
};

describe('routes', () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'test-token';
    supabase.from.mockClear();
    axios.post.mockReset();
    axios.get.mockReset();
  });

  test('GET /api/crawl-items returns list', async () => {
    const app = buildApp();
    supabase.from.mockReturnValueOnce({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [{ id: 1 }], error: null })
        })
      })
    });
    const res = await request(app).get('/api/crawl-items');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('POST /api/templates requires admin token', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/templates').send({ name: 't1' });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/templates creates new version', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null })
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: '1', name: 't1' }, error: null })
            })
          })
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null })
      };
    });
    const res = await request(app)
      .post('/api/templates')
      .set('x-admin-token', 'test-token')
      .send({ name: 't1', crawler_rules: { text: 'a' }, ocr_rules: { teacher: 'a', time: 'b', course: 'c' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('t1');
  });

  test('POST /api/crawler/crawl inserts crawl_items', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({
      data: {
        ocr_results: [{ image_path: 'img.png' }]
      }
    });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_items') {
        return {
          insert: () => ({
            select: () => Promise.resolve({ data: [{ id: '1' }], error: null })
          })
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null })
      };
    });
    const res = await request(app).post('/api/crawler/crawl').send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test('POST /api/crawler/crawl handles python error', async () => {
    const app = buildApp();
    axios.post.mockRejectedValueOnce(new Error('timeout'));
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_items') {
        return { insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).post('/api/crawler/crawl').send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/crawler/crawl handles insert error', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ocr_results: [{ image_path: 'img.png' }] } });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_items') {
        return { insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'fail' } }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).post('/api/crawler/crawl').send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/upload accepts file', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { status: 'success' } });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_items') {
        return {
          insert: () => ({
            select: () => Promise.resolve({ data: [{ id: '1' }], error: null })
          })
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null })
      };
    });
    const res = await request(app)
      .post('/api/upload')
      .field('studio', 'S1')
      .attach('file', Buffer.from('abc'), 'test.png');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/upload handles python error', async () => {
    const app = buildApp();
    axios.post.mockRejectedValueOnce(new Error('upload failed'));
    supabase.from.mockImplementation(() => ({
      insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) })
    }));
    const res = await request(app)
      .post('/api/upload')
      .field('studio', 'S1')
      .attach('file', Buffer.from('abc'), 'test.png');
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/upload handles insert error', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { status: 'success' } });
    supabase.from.mockImplementation(() => ({
      insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'fail' } }) })
    }));
    const res = await request(app)
      .post('/api/upload')
      .field('studio', 'S1')
      .attach('file', Buffer.from('abc'), 'test.png');
    expect(res.statusCode).toBe(500);
  });

  test('GET /api/admin/months returns list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules') {
        return { select: () => Promise.resolve({ data: [{ course_date: '2026-02-01' }], error: null }) };
      }
      if (table === 'crawl_items') {
        return { select: () => Promise.resolve({ data: [{ created_at: '2026-01-01T00:00:00Z' }], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/months').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/admin/studios returns configs', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'studios') {
        return { select: () => Promise.resolve({ data: [{ id: 's1', name: 'A', branch: 'B' }], error: null }) };
      }
      if (table === 'crawl_configs') {
        return { select: () => Promise.resolve({ data: [{ id: 'c1', studio: 'A', branch: 'B' }], error: null }) };
      }
      if (table === 'schedules') {
        return { select: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [{ studio_id: 's1' }], error: null }) }) }) };
      }
      if (table === 'crawl_items') {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/studios?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/admin/studios handles query error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'studios') {
        return { select: () => Promise.resolve({ data: null, error: { message: 'fail' } }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/studios?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(500);
  });

  test('GET /api/admin/studios returns failure reason', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'studios') {
        return { select: () => Promise.resolve({ data: [{ id: 's1', name: 'A', branch: 'B' }], error: null }) };
      }
      if (table === 'crawl_configs') {
        return { select: () => Promise.resolve({ data: [{ id: 'c1', studio: 'A', branch: 'B', last_crawl_status: 'failed' }], error: null }) };
      }
      if (table === 'schedules') {
        return { select: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      if (table === 'crawl_items') {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [{ config_id: 'c1', error_message: 'timeout' }], error: null })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/studios?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body[0].fail_reason).toBe('网络超时');
  });

  test('GET /api/configs list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      select: () => ({
        order: () => Promise.resolve({ data: [{ id: 'c1' }], error: null })
      })
    }));
    const res = await request(app).get('/api/configs');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('POST /api/configs creates config', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'c1' }, error: null })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/configs')
      .set('x-admin-token', 'test-token')
      .send({ studio: 'S', wechat_url: 'u' });
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/configs handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'fail' } }) }) })
    }));
    const res = await request(app)
      .post('/api/configs')
      .set('x-admin-token', 'test-token')
      .send({ studio: 'S', wechat_url: 'u' });
    expect(res.statusCode).toBe(500);
  });

  test('PUT /api/configs updates config', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'c1' }, error: null })
              })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .put('/api/configs/c1')
      .set('x-admin-token', 'test-token')
      .send({ studio: 'S' });
    expect(res.statusCode).toBe(200);
  });

  test('PUT /api/configs handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'fail' } }) }) }) })
    }));
    const res = await request(app)
      .put('/api/configs/c1')
      .set('x-admin-token', 'test-token')
      .send({ studio: 'S' });
    expect(res.statusCode).toBe(500);
  });

  test('DELETE /api/configs deletes config', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return { delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .delete('/api/configs/c1')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('DELETE /api/configs handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'fail' } }) })
    }));
    const res = await request(app)
      .delete('/api/configs/c1')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/configs/:id/run triggers run', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ocr_results: [] } });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: 'c1', studio: 'S', branch: '' }, error: null })
            })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'c1' }, error: null })
              })
            })
          })
        };
      }
      if (table === 'crawl_items') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      if (table === 'templates') {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/configs/c1/run')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/configs/run-all triggers', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ocr_results: [] } });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'c1', studio: 'S' }], error: null }) }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'c1' }, error: null })
              })
            })
          })
        };
      }
      if (table === 'crawl_items') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      if (table === 'templates') {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/configs/run-all')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/templates/export returns list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return { select: () => ({ order: () => Promise.resolve({ data: [{ id: 't1' }], error: null }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/templates/export').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/templates list with filters', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        const builder = {
          eq: () => builder,
          order: () => builder,
          then: (resolve, reject) => Promise.resolve({ data: [{ id: 't1' }], error: null }).then(resolve, reject)
        };
        return { select: () => builder };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/templates?name=a&studio=b&branch=c');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/templates/current returns current', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: 't1' }, error: null })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/templates/current?name=t1');
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/templates/history returns list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [{ id: 't1' }], error: null })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/templates/history?name=t1');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/templates/current requires name', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/templates/current');
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/templates/history requires name', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/templates/history');
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/templates/import imports list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null })
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 't1' }, error: null })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/templates/import')
      .set('x-admin-token', 'test-token')
      .send({ templates: [{ name: 't1', crawler_rules: { text: 'a' }, ocr_rules: { teacher: 'a', time: 'b', course: 'c' } }] });
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/templates import requires array', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/templates/import')
      .set('x-admin-token', 'test-token')
      .send({ templates: {} });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/templates import validation error', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/templates/import')
      .set('x-admin-token', 'test-token')
      .send({ templates: [{ name: 't1', crawler_rules: {}, ocr_rules: {} }] });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/templates validates rules', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/templates')
      .set('x-admin-token', 'test-token')
      .send({ name: 't1', crawler_rules: { text: 'a' }, ocr_rules: {} });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/admin/restart triggers run', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ocr_results: [] } });
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: 'c1', studio: 'S', branch: null, template_name: 't' }], error: null })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'c1' }, error: null })
              })
            })
          })
        };
      }
      if (table === 'studios') {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 's1' }, error: null }) }) }) }) };
      }
      if (table === 'schedules') {
        return { delete: () => ({ eq: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      if (table === 'templates') {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) };
      }
      if (table === 'crawl_items') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/admin/restart')
      .set('x-admin-token', 'test-token')
      .send({ month: '2026-02', studio: 'S' });
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/admin/months handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules') {
        return { select: () => Promise.resolve({ data: null, error: { message: 'fail' } }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/months').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/admin/restart requires month', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/restart')
      .set('x-admin-token', 'test-token')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/stats/summary returns data', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: [{ course_date: '2026-02-01', teacher_id: 't1' }], error: null })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/stats/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body.totalSchedules7d).toBe(1);
  });

  test('GET /api/stats/overview returns data', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return { select: () => Promise.resolve({ data: [{ id: 'c1', need_manual_upload: true, fail_count: 1 }], error: null }) };
      }
      if (table === 'crawl_items') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: [{ created_at: '2026-02-01T00:00:00Z', ocr_status: 'failed' }], error: null })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/stats/overview');
    expect(res.statusCode).toBe(200);
    expect(res.body.failedItems).toBe(1);
  });

  test('GET /api/stats/schedules returns list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules_view') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  order: () => Promise.resolve({ data: [{ id: 's1' }], error: null })
                })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/stats/schedules?from=2026-02-01&to=2026-02-28');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('POST /api/admin/rules creates version', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawler_rules') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null })
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'r1', name: 'rule1' }, error: null })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/admin/rules')
      .set('x-admin-token', 'test-token')
      .send({ name: 'rule1' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('rule1');
  });

  test('POST /api/admin/rules parses mapping string', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawler_rules') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null })
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'r2', name: 'rule2' }, error: null })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/admin/rules')
      .set('x-admin-token', 'test-token')
      .send({ name: 'rule2', field_mapping: '{"a":1}', exception_policy: 'raw' });
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/admin/logs returns list', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'admin_operation_logs') {
        return {
          select: () => ({
            order: () => ({
              range: () => Promise.resolve({ data: [{ id: 'l1' }], error: null, count: 1 })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/logs').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('GET /api/admin/image requires path', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/image').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/admin/backup returns payload', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      select: () => Promise.resolve({ data: [{ id: 'x' }], error: null })
    }));
    const res = await request(app).get('/api/admin/backup').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.configs.length).toBe(1);
  });

  test('GET /api/admin/backup requires token', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/backup');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/admin/images returns items', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_items') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  range: () => Promise.resolve({ data: [{ id: 'i1', image_path: 'a.png' }], error: null, count: 1 })
                })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/images?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('GET /api/admin/image proxies', async () => {
    const app = buildApp();
    axios.get.mockResolvedValueOnce({ data: Buffer.from('x'), headers: { 'content-type': 'image/png' } });
    const res = await request(app).get('/api/admin/image?path=a.png').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('GET /api/admin/parsed returns data', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules_view') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  range: () => Promise.resolve({ data: [{ id: 'p1' }], error: null, count: 1 })
                })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/parsed?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('GET /api/admin/parsed handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules_view') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  range: () => Promise.resolve({ data: null, error: { message: 'fail' } })
                })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/parsed?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(500);
  });

  test('GET /api/admin/studios requires month', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/studios').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/configs/:id/run not found', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawl_configs') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/configs/c1/run')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/crawl-items handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: null, error: { message: 'fail' } })
        })
      })
    }));
    const res = await request(app).get('/api/crawl-items');
    expect(res.statusCode).toBe(500);
  });

  test('GET /api/stats/summary handles error', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'schedules') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: null, error: { message: 'fail' } })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/stats/summary');
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/templates/preview requires url or file', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/templates/preview')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/templates/export requires token', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/templates/export');
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/admin/stats returns stats', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'studios') {
        return { select: () => Promise.resolve({ data: [{ id: 's1' }], error: null }) };
      }
      if (table === 'crawl_configs') {
        return { select: () => Promise.resolve({ data: [{ id: 'c1', last_crawl_status: 'failed' }], error: null }) };
      }
      if (table === 'schedules') {
        return { select: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [{ studio_id: 's1' }], error: null }) }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app).get('/api/admin/stats?month=2026-02').set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.totalStudios).toBe(1);
  });

  test('POST /api/admin/restore accepts payload', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => ({
      upsert: () => Promise.resolve({ data: [], error: null })
    }));
    const res = await request(app)
      .post('/api/admin/restore')
      .set('x-admin-token', 'test-token')
      .send({ configs: [{ id: 'c1' }], templates: [{ id: 't1' }], rules: [{ id: 'r1' }] });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/admin/rules/:id/set-current', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawler_rules') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: 'r1', name: 'rule1' }, error: null })
            })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'r1', is_current: true }, error: null })
              })
            })
          })
        };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/admin/rules/r1/set-current')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/admin/rules/:id/set-current not found', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawler_rules') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/admin/rules/r1/set-current')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(404);
  });

  test('DELETE /api/admin/rules/:id deletes rule', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'crawler_rules') {
        return { delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'admin_operation_logs') {
        return { insert: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .delete('/api/admin/rules/r1')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/templates/preview url path', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ok: true } });
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: 't1' }, error: null })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/templates/preview')
      .set('x-admin-token', 'test-token')
      .send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/templates/preview image path', async () => {
    const app = buildApp();
    axios.post.mockResolvedValueOnce({ data: { ok: true } });
    const res = await request(app)
      .post('/api/templates/preview')
      .set('x-admin-token', 'test-token')
      .attach('file', Buffer.from('abc'), 'test.png');
    expect(res.statusCode).toBe(200);
  });

  test('POST /api/templates/preview error path', async () => {
    const app = buildApp();
    axios.post.mockRejectedValueOnce(new Error('preview failed'));
    const res = await request(app)
      .post('/api/templates/preview')
      .set('x-admin-token', 'test-token')
      .send({ url: 'https://example.com' });
    expect(res.statusCode).toBe(500);
  });

  test('POST /api/templates/:id/set-current', async () => {
    const app = buildApp();
    supabase.from.mockImplementation((table) => {
      if (table === 'templates') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: 't1', name: 'n1' }, error: null })
            })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 't1', is_current: true }, error: null })
              })
            })
          })
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });
    const res = await request(app)
      .post('/api/templates/t1/set-current')
      .set('x-admin-token', 'test-token');
    expect(res.statusCode).toBe(200);
  });
});
