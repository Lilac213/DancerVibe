import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Tag, Modal, Upload, Select, message, Space, Drawer, Descriptions, List } from 'antd';
import { PlusOutlined, UploadOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface OCRTask {
  id: string;
  status: string;
  image_url: string;
  template_id: string;
  confidence_score: number;
  created_at: string;
}

const OCRTaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<OCRTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [file, setFile] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>();
  
  // Results Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<OCRTask | null>(null);
  const [results, setResults] = useState<any>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchTemplates();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(apiUrl('/api/ocr/tasks'));
      setTasks(res.data);
    } catch (e) {
      message.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(apiUrl('/api/templates'));
      setTemplates(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!file) {
      message.error('Please select an image');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    if (selectedTemplate) {
      formData.append('template_id', selectedTemplate);
    }

    try {
      await axios.post(apiUrl('/api/ocr/tasks'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Task created');
      setCreateModalOpen(false);
      setFile(null);
      fetchTasks();
    } catch (e) {
      message.error('Failed to create task');
    }
  };

  const viewResults = async (task: OCRTask) => {
    setCurrentTask(task);
    setDrawerOpen(true);
    setResultsLoading(true);
    try {
      const res = await axios.get(apiUrl(`/api/ocr/tasks/${task.id}/results`));
      setResults(res.data);
    } catch (e) {
      message.error('Failed to load results');
    } finally {
      setResultsLoading(false);
    }
  };

  const columns = [
    {
      title: 'Task ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id.slice(0, 8)}...</span>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'completed') color = 'green';
        if (status === 'processing') color = 'blue';
        if (status === 'failed') color = 'red';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Template',
      dataIndex: 'template_id',
      key: 'template',
      render: (tid: string) => {
        const t = templates.find(tpl => tpl.id === tid);
        return t ? <Tag color="purple">{t.template_name}</Tag> : (tid ? tid.slice(0,8) : '-');
      }
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence_score',
      key: 'conf',
      render: (score: number) => score ? `${(score * 100).toFixed(1)}%` : '-'
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => d ? dayjs(d).format('MM-DD HH:mm') : '-'
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: OCRTask) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewResults(record)}>View</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title="OCR Tasks" 
        extra={
            <Space>
                <Button icon={<SyncOutlined />} onClick={fetchTasks} loading={loading}>Refresh</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>New Task</Button>
            </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={tasks} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Create New OCR Task"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
      >
        <div style={{ marginBottom: 16 }}>
          <p>Select Image:</p>
          <Upload 
            beforeUpload={(f) => { setFile(f); return false; }} 
            maxCount={1}
            onRemove={() => setFile(null)}
          >
            <Button icon={<UploadOutlined />}>Upload Image</Button>
          </Upload>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p>Select Template (Optional):</p>
          <Select 
            style={{ width: '100%' }} 
            allowClear 
            onChange={setSelectedTemplate}
            placeholder="Auto-detect if empty"
          >
            {templates.map(t => (
              <Option key={t.id} value={t.id}>{t.template_name} ({t.template_code})</Option>
            ))}
          </Select>
        </div>
      </Modal>

      <Drawer
        title="Task Results"
        width={600}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      >
        {currentTask && (
            <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{currentTask.id}</Descriptions.Item>
                <Descriptions.Item label="Status">{currentTask.status}</Descriptions.Item>
                <Descriptions.Item label="Confidence">{(currentTask.confidence_score * 100).toFixed(1)}%</Descriptions.Item>
            </Descriptions>
        )}
        <div style={{ marginTop: 24 }}>
            <h3>Structured Data</h3>
            <Table 
                loading={resultsLoading}
                dataSource={results?.structured || []}
                rowKey={(r, i) => i?.toString() || ''}
                pagination={false}
                size="small"
                columns={[
                    { title: 'Day', dataIndex: 'weekday', width: 60 },
                    { title: 'Time', render: (_, r: any) => `${r.start_time || ''}-${r.end_time || ''}` },
                    { title: 'Course', dataIndex: 'course' },
                    { title: 'Teacher', dataIndex: 'teacher' },
                    { title: 'Style', dataIndex: 'style' },
                ]}
            />
        </div>
        <div style={{ marginTop: 24 }}>
            <h3>Raw JSON</h3>
            <pre style={{ background: '#f5f5f5', padding: 8, overflow: 'auto', maxHeight: 300 }}>
                {JSON.stringify(results?.raw, null, 2)}
            </pre>
        </div>
      </Drawer>
    </div>
  );
};

export default OCRTaskManager;
