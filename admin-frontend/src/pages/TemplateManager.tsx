import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Tag, Drawer, Form, Input, Select, Switch, message, Space, Tabs, Row, Col, Divider, Modal, Tooltip, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const { Option } = Select;
const { TextArea } = Input;

// New V2 Interface
interface TemplateV2 {
  id: string;
  template_code: string;
  template_name: string;
  studio: string;
  source_type: string;
  layout_type: string;
  version: string;
  status: string;
  created_at: string;
  updated_at: string;
  latest_config?: any; // The full JSON config
}

const DEFAULT_CONFIG_JSON = {
  template_meta: {
    template_id: "",
    template_name: "",
    studio: "",
    source_type: "image",
    layout_type: "grid",
    version: "1.0.0",
    status: "active"
  },
  page_structure: {
    header_keywords: [],
    footer_keywords: [],
    month_pattern: "\\d{1,2}月",
    store_extract_pattern: "(.*?)店",
    branch_extract_pattern: "(.*?)分店"
  },
  grid_structure: {
    weekday_format: "Mon",
    weekday_mapping: {
      "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 7
    },
    has_weekday_header: true,
    time_column_position: "left",
    time_pattern: "\\d{1,2}:\\d{2}"
  },
  cell_structure: {
    layout_type: "vertical",
    fields_order: ["time", "course", "teacher"],
    difficulty_detection: {
      type: "dot_count",
      position: "left_bottom"
    }
  },
  field_extraction_rules: {
    course_clean_rules: ["去除多余空格", "统一大写"],
    teacher_clean_rules: ["去除'老师'字样"]
  },
  mapping_rules: {
    course_to_style_mapping: {}
  },
  confidence_rules: {
    base_score: 0.5,
    field_weights: {
      time: 0.1, course: 0.2, teacher: 0.2, style: 0.2, difficulty: 0.1
    },
    threshold_auto_pass: 0.9,
    threshold_manual_review: 0.75
  }
};

const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateV2 | null>(null);
  const [form] = Form.useForm();
  
  const [configJson, setConfigJson] = useState<string>('');
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get(apiUrl('/api/templates'));
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
      message.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (record: TemplateV2) => {
    setEditingTemplate(record);
    try {
      const res = await axios.get(apiUrl(`/api/templates/${record.id}`));
      const fullTemplate = res.data;
      setEditingTemplate(fullTemplate);
      
      form.setFieldsValue({
        ...fullTemplate,
      });
      
      // Load config or default
      const config = fullTemplate.latest_config || DEFAULT_CONFIG_JSON;
      // Ensure template_meta matches basic info
      config.template_meta = {
        ...config.template_meta,
        template_id: fullTemplate.template_code,
        template_name: fullTemplate.template_name,
        studio: fullTemplate.studio,
        source_type: fullTemplate.source_type,
        layout_type: fullTemplate.layout_type,
        version: fullTemplate.version,
        status: fullTemplate.status
      };
      
      setConfigJson(JSON.stringify(config, null, 2));
      
    } catch (e) {
      console.error(e);
    }
    setDrawerOpen(true);
    setActiveTab('basic');
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'active',
      version: 'v1',
      source_type: 'image',
      layout_type: 'grid'
    });
    setConfigJson(JSON.stringify(DEFAULT_CONFIG_JSON, null, 2));
    setDrawerOpen(true);
    setActiveTab('basic');
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Delete this template?',
      content: 'This will verify remove the template and all its versions.',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(apiUrl(`/api/templates/${id}`));
          message.success('Template deleted');
          fetchTemplates();
        } catch (e) {
          message.error('Failed to delete');
        }
      }
    });
  };

  const onFinish = async (values: any) => {
    try {
      // Basic Payload
      const payload: any = { ...values };
      
      // Also try to validate and include config if creating
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(configJson);
      } catch (e) {
        message.error('Invalid JSON Config');
        return;
      }
      
      // Update template_meta inside config to match form
      payload.initial_config = {
        ...parsedConfig,
        template_meta: {
            ...(parsedConfig as any).template_meta,
            template_id: values.template_code,
            template_name: values.template_name,
            studio: values.studio,
            source_type: values.source_type,
            layout_type: values.layout_type,
            version: values.version,
            status: values.status
        }
      };

      if (editingTemplate) {
        // Update Basic Info
        await axios.put(apiUrl(`/api/templates/${editingTemplate.id}`), payload);
        // Update Config separately to create new version
        await axios.put(apiUrl(`/api/templates/${editingTemplate.id}/config`), payload.initial_config);
        message.success('Template updated');
      } else {
        await axios.post(apiUrl('/api/templates'), payload);
        message.success('Template created');
      }
      
      setDrawerOpen(false);
      fetchTemplates();
    } catch (e: any) {
      console.error(e);
      message.error(e.response?.data?.detail || 'Operation failed');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'template_code',
      key: 'code',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: 'Name',
      dataIndex: 'template_name',
      key: 'name',
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: 'Studio',
      dataIndex: 'studio',
      key: 'studio',
    },
    {
      title: 'Type',
      dataIndex: 'layout_type',
      key: 'layout_type',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>{status?.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: TemplateV2) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title="Crawler Template System (V2)" 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>New Template</Button>}
      >
        <Table 
          columns={columns} 
          dataSource={templates} 
          rowKey="id" 
          loading={loading}
        />
      </Card>

      <Drawer
        title={editingTemplate ? `Edit: ${editingTemplate.template_name}` : "New Template"}
        width={800}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        bodyStyle={{ paddingBottom: 80 }}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button onClick={() => form.submit()} type="primary">
              Save All
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            {/* Tab 1: Basic Meta */}
            <Tabs.TabPane tab="Basic Info" key="basic">
              <Alert message="Basic info defines how the system identifies and routes tasks to this template." type="info" showIcon style={{marginBottom: 16}} />
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="template_code" label="Template Code (Unique ID)" rules={[{ required: true }]}>
                    <Input placeholder="e.g. phoenix_v1" disabled={!!editingTemplate} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="template_name" label="Template Name" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Phoenix Schedule Template" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="studio" label="Studio" rules={[{ required: true }]}>
                    <Input placeholder="Phoenix" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="source_type" label="Source Type">
                    <Select>
                      <Option value="image">Image</Option>
                      <Option value="wechat">WeChat Article</Option>
                      <Option value="web">Web Page</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="layout_type" label="Layout Type">
                     <Select>
                      <Option value="grid">Grid (Timetable)</Option>
                      <Option value="list">List</Option>
                      <Option value="poster">Poster</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="version" label="Version">
                    <Input placeholder="1.0.0" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="status" label="Status">
                    <Select>
                      <Option value="active">Active</Option>
                      <Option value="inactive">Inactive</Option>
                      <Option value="draft">Draft</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Tabs.TabPane>
            
            {/* Tab 2: JSON Config */}
            <Tabs.TabPane tab="Advanced Config (JSON)" key="config">
              <div style={{ marginBottom: 16 }}>
                 <Space>
                    <Tooltip title="Reset to default template structure">
                        <Button size="small" onClick={() => setConfigJson(JSON.stringify(DEFAULT_CONFIG_JSON, null, 2))}>Load Default</Button>
                    </Tooltip>
                    <Tooltip title="Copy current JSON">
                        <Button size="small" icon={<CopyOutlined />} onClick={() => {navigator.clipboard.writeText(configJson); message.success('Copied');}} />
                    </Tooltip>
                 </Space>
              </div>
              <Form.Item help="Edit the full configuration JSON. This includes Page Structure, Grid Structure, Cell Parsing Rules, etc.">
                <TextArea 
                  rows={25} 
                  value={configJson} 
                  onChange={(e) => setConfigJson(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
            </Tabs.TabPane>
          </Tabs>
        </Form>
      </Drawer>
    </div>
  );
};

export default TemplateManager;
