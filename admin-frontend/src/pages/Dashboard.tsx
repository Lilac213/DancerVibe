import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Alert, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../lib/api';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  
  const [summary, setSummary] = useState<{ last7Days: Array<{date: string, count: number}>, totalSchedules7d: number, distinctTeachers7d: number } | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Array<{ type: string; message: string }>>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await axios.get(apiUrl('/api/stats/summary'));
        setSummary(r.data);
        const o = await axios.get(apiUrl('/api/stats/overview'));
        setOverview(o.data);
        const cfg = await axios.get(apiUrl('/api/configs'));
        setConfigs(cfg.data || []);
        const it = await axios.get(apiUrl('/api/crawl-items?limit=20'));
        setItems(it.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
    const socket = io((import.meta as any).env?.VITE_API_BASE_URL || '', { path: '/socket.io', transports: ['websocket'] });
    socket.on('alert', (payload: any) => {
      setAlerts(a => [...a, { type: payload?.type || 'info', message: payload?.message || 'Alert' }]);
    });
    return () => { socket.close(); };
  }, []);

  const chartData = (summary?.last7Days || []).map(d => ({
    date: d.date.slice(5),
    count: d.count,
  }));

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Dashboard</h2>
      {alerts.map((a, idx) => (
        <Alert key={idx} type={a.type === 'no_data_today' ? 'warning' : 'info'} message={a.message} showIcon style={{ marginBottom: 12 }} />
      ))}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Schedules (7d)" value={summary?.totalSchedules7d || 0} loading={loading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Need Manual Upload" 
              value={overview?.needManual || 0} 
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Configs" value={overview?.totalConfigs || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Failed Items (7d)" 
              value={overview?.failedItems || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Crawl Trend">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent Items">
            <Table
              rowKey="id"
              size="small"
              dataSource={items}
              pagination={false}
              columns={[
                { title: '舞室', dataIndex: 'studio' },
                { title: '分店', dataIndex: 'branch' },
                { title: '来源', dataIndex: 'source_type', render: (v) => <Tag>{v}</Tag> },
                { title: 'OCR', dataIndex: 'ocr_status', render: (v) => <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag> }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Crawler Configs">
            <Table
              rowKey="id"
              size="small"
              dataSource={configs}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: '舞室', dataIndex: 'studio' },
                { title: '分店', dataIndex: 'branch' },
                { title: 'URL', dataIndex: 'wechat_url', ellipsis: true },
                { title: '模板', dataIndex: 'template_name' },
                { title: '失败次数', dataIndex: 'fail_count' },
                { title: '需手工', dataIndex: 'need_manual_upload', render: (v) => v ? <Tag color="red">是</Tag> : <Tag>否</Tag> }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
