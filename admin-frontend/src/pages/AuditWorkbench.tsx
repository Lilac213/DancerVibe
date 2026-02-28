import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Tag, Modal, Form, Input, Select, message, Space, Row, Col, InputNumber } from 'antd';
import { CheckCircleOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const AuditWorkbench: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [form] = Form.useForm();

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Use proxy endpoint
      const res = await axios.get(apiUrl('/api/crawler/audit/tasks?status=pending'));
      setTasks(res.data || []);
    } catch (err) {
      message.error('Failed to load audit tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleResolve = async () => {
    try {
      const values = await form.validateFields();
      const fixedData = {
        ...currentTask.original_data, // Keep base data
        ...values // Overwrite with manual fixes
      };
      
      await axios.post(apiUrl(`/api/crawler/audit/tasks/${currentTask.id}/resolve`), fixedData);
      message.success('Task resolved successfully');
      setModalOpen(false);
      loadTasks();
    } catch (err) {
      message.error('Failed to resolve task');
    }
  };

  const openAuditModal = (task: any) => {
    setCurrentTask(task);
    // Prefer fixed_data (if partial fix exist) or original_data
    const data = task.fixed_data || task.original_data || {};
    
    // Flatten data for form
    form.setFieldsValue({
      course: data.course,
      teacher: data.teacher,
      style: data.style,
      level: data.level,
      start_time: data.start_time,
      end_time: data.end_time,
      raw_text: data.raw_text
    });
    setModalOpen(true);
  };

  const columns = [
    { 
      title: 'Confidence', 
      dataIndex: 'confidence_score', 
      key: 'score',
      width: 100,
      render: (score: number) => {
        const color = score > 0.8 ? 'green' : score > 0.5 ? 'orange' : 'red';
        return <Tag color={color}>{(score * 100).toFixed(1)}%</Tag>;
      }
    },
    { 
      title: 'Source', 
      dataIndex: 'source_type', 
      key: 'source',
      width: 120,
      render: (t: string) => <Tag>{t}</Tag> 
    },
    { 
      title: 'Raw Text', 
      dataIndex: ['original_data', 'raw_text'], 
      key: 'raw',
      ellipsis: true 
    },
    { 
      title: 'Parsed (Auto)', 
      key: 'parsed',
      render: (_: any, r: any) => {
        const d = r.original_data || {};
        return (
          <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
            <div>Course: <span style={{ fontWeight: 500 }}>{d.course || '?'}</span></div>
            <div>Teacher: <span style={{ fontWeight: 500 }}>{d.teacher || '?'}</span></div>
            <div>Style: <Tag style={{ margin: 0 }}>{d.style || '?'}</Tag></div>
          </Space>
        );
      }
    },
    { 
      title: 'AI Suggestion', 
      dataIndex: 'ai_suggestion',
      key: 'ai',
      render: (ai: any) => ai ? (
        <Space direction="vertical" size={0} style={{ fontSize: 12, color: '#1890ff' }}>
          <div>{ai.course}</div>
          <div>{ai.teacher}</div>
        </Space>
      ) : '-' 
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_: any, r: any) => (
        <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => openAuditModal(r)}>
          Review
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Audit Workbench</h2>
        <Button onClick={loadTasks}>Refresh</Button>
      </div>

      <Card>
        <Table
          loading={loading}
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Manual Review"
        open={modalOpen}
        onOk={handleResolve}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Raw OCR Text" name="raw_text">
            <Input.TextArea disabled rows={2} style={{ color: '#000' }} />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Course Name" name="course" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Teacher" name="teacher" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Style" name="style">
                <Select options={[
                  { value: 'JAZZ', label: 'JAZZ' },
                  { value: 'HIPHOP', label: 'HIPHOP' },
                  { value: 'KPOP', label: 'KPOP' },
                  { value: 'URBAN', label: 'URBAN' },
                  { value: 'HEELS', label: 'HEELS' },
                  { value: 'CHOREOGRAPHY', label: 'CHOREO' },
                  { value: 'OTHER', label: 'OTHER' }
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Level (Difficulty)" name="level">
                <InputNumber min={0} max={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Start Time" name="start_time">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="End Time" name="end_time">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        
        {currentTask?.ai_suggestion && (
          <div style={{ marginTop: 16, padding: 12, background: '#f0f5ff', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>
              <WarningOutlined /> AI Suggestion
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>Course: {currentTask.ai_suggestion.course}</div>
              <div>Teacher: {currentTask.ai_suggestion.teacher}</div>
              <div>Style: {currentTask.ai_suggestion.style}</div>
              <div>Level: {currentTask.ai_suggestion.level}</div>
            </div>
            <Button 
              size="small" 
              type="link" 
              style={{ padding: 0, marginTop: 8 }}
              onClick={() => form.setFieldsValue(currentTask.ai_suggestion)}
            >
              Apply AI Suggestion
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditWorkbench;