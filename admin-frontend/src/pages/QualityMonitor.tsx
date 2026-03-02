import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag, DatePicker } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const { RangePicker } = DatePicker;

const QualityMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Mock data for visualization
  const MOCK_STATS = {
    total_tasks: 1250,
    success_rate: 92.5,
    avg_confidence: 0.88,
    manual_intervention_rate: 15.2,
    daily_trend: [
      { date: 'Mon', auto: 45, manual: 5, failed: 2 },
      { date: 'Tue', auto: 52, manual: 8, failed: 1 },
      { date: 'Wed', auto: 48, manual: 6, failed: 3 },
      { date: 'Thu', auto: 60, manual: 4, failed: 0 },
      { date: 'Fri', auto: 55, manual: 7, failed: 2 },
      { date: 'Sat', auto: 30, manual: 2, failed: 0 },
      { date: 'Sun', auto: 35, manual: 3, failed: 1 },
    ],
    studio_performance: [
      { studio: 'Phoenix', success_rate: 98, count: 450 },
      { studio: '5KM', success_rate: 85, count: 320 },
      { studio: 'SinoStage', success_rate: 92, count: 280 },
      { studio: 'Unknown', success_rate: 60, count: 200 },
    ]
  };

  useEffect(() => {
    // TODO: Fetch real stats from backend
    setStats(MOCK_STATS);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Quality & Performance Monitor</h2>
        <RangePicker />
      </div>

      {/* Top Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="OCR Success Rate" 
              value={stats?.success_rate} 
              precision={1} 
              suffix="%" 
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
            />
            <Progress percent={stats?.success_rate} status="active" strokeColor="#52c41a" showInfo={false} size="small" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Avg Confidence Score" 
              value={stats?.avg_confidence * 100} 
              precision={1} 
              suffix="%" 
              prefix={<RobotOutlined style={{ color: '#1890ff' }} />} 
            />
            <Progress percent={stats?.avg_confidence * 100} strokeColor="#1890ff" showInfo={false} size="small" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Manual Intervention" 
              value={stats?.manual_intervention_rate} 
              precision={1} 
              suffix="%" 
              prefix={<UserOutlined style={{ color: '#faad14' }} />} 
            />
            <Progress percent={stats?.manual_intervention_rate} strokeColor="#faad14" showInfo={false} size="small" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Tasks" 
              value={stats?.total_tasks} 
              prefix={<DatabaseOutlined />} 
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="Processing Trend (7 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.daily_trend}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="auto" name="Auto Success" stackId="a" fill="#52c41a" />
                <Bar dataKey="manual" name="Manual Review" stackId="a" fill="#faad14" />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Studio Performance">
            <Table 
              dataSource={stats?.studio_performance} 
              rowKey="studio"
              pagination={false}
              size="small"
              columns={[
                { title: 'Studio', dataIndex: 'studio' },
                { 
                  title: 'Success Rate', 
                  dataIndex: 'success_rate',
                  render: (val) => (
                    <Tag color={val > 90 ? 'green' : val > 80 ? 'orange' : 'red'}>
                      {val}%
                    </Tag>
                  )
                },
                { title: 'Tasks', dataIndex: 'count' }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Icon helper
const DatabaseOutlined = () => <span role="img" className="anticon"><svg viewBox="64 64 896 896" focusable="false" data-icon="database" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M832 64H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V96c0-17.7-14.3-32-32-32zm-40 824H232V136h560v752zM304 248h416v48H304zm0 136h416v48H304zm0 136h416v48H304z"></path></svg></span>;

export default QualityMonitor;
