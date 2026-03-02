import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Form, Input, Modal, Row, Col, Space, message, Tag, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const { TabPane } = Tabs;

interface MappingRule {
  id: string;
  rule_type: string; // 'course_to_style', 'teacher_alias', etc.
  source_value: string;
  target_value: string;
  studio?: string;
  priority: number;
}

const MappingRuleManager: React.FC = () => {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);
  const [activeType, setActiveType] = useState('course_to_style');
  const [form] = Form.useForm();

  // Temporary mock data until backend is ready
  const MOCK_RULES = [
    { id: '1', rule_type: 'course_to_style', source_value: 'JAZZ FUNK', target_value: 'JAZZ', priority: 10 },
    { id: '2', rule_type: 'course_to_style', source_value: 'BASIC SWAG', target_value: 'SWAG', priority: 10 },
    { id: '3', rule_type: 'course_to_style', source_value: 'HIPHOP基础', target_value: 'HIPHOP', priority: 10 },
  ];

  useEffect(() => {
    fetchRules();
  }, [activeType]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const res = await axios.get(apiUrl(`/api/rules?type=${activeType}`));
      // setRules(res.data);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setRules(MOCK_RULES.filter(r => r.rule_type === activeType));
    } catch (e) {
      message.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: MappingRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ rule_type: activeType, priority: 10 });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Delete this rule?',
      onOk: async () => {
        message.success('Rule deleted (Mock)');
        fetchRules();
      }
    });
  };

  const onFinish = async (values: any) => {
    try {
      // TODO: Replace with actual API call
      console.log('Saving rule:', values);
      message.success('Rule saved (Mock)');
      setModalOpen(false);
      fetchRules();
    } catch (e) {
      message.error('Failed to save rule');
    }
  };

  const columns = [
    {
      title: 'Source Value',
      dataIndex: 'source_value',
      key: 'source',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Target Value',
      dataIndex: 'target_value',
      key: 'target',
      render: (text: string) => <Tag color="green">{text}</Tag>
    },
    {
      title: 'Studio Scope',
      dataIndex: 'studio',
      key: 'studio',
      render: (text: string) => text || <Tag>Global</Tag>
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: MappingRule) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title="Mapping Rules Manager" 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>New Rule</Button>}
      >
        <Tabs activeKey={activeType} onChange={setActiveType}>
          <TabPane tab="Course -> Style" key="course_to_style" />
          <TabPane tab="Teacher Alias" key="teacher_alias" />
          <TabPane tab="Studio Name Normalization" key="studio_name" />
        </Tabs>

        <Table 
          columns={columns} 
          dataSource={rules} 
          rowKey="id" 
          loading={loading}
        />
      </Card>

      <Modal
        title={editingRule ? "Edit Rule" : "New Rule"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="rule_type" hidden><Input /></Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_value" label="Source Value (Match)" rules={[{ required: true }]}>
                <Input placeholder="e.g. JAZZ FUNK" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_value" label="Target Value (Map To)" rules={[{ required: true }]}>
                <Input placeholder="e.g. JAZZ" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="studio" label="Studio Scope (Optional)">
            <Input placeholder="Leave empty for Global rule" />
          </Form.Item>

          <Form.Item name="priority" label="Priority">
            <Input type="number" placeholder="Higher number = higher priority" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MappingRuleManager;
