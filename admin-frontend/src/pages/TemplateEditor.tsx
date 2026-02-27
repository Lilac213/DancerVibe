import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tabs, Upload, message, Switch } from 'antd';
import { UploadOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const phoenixTemplateDefaults = {
  name: 'p社-课表',
  studio: 'phoenix',
  branch: '世纪大道',
  crawler_rules_text: [
    'take_last_n: 1',
    'min_size_kb: 150',
    'ratio_min: 1.6',
    '只保留课表图片：选择文章中最后一张且高度明显大于宽度的图片',
    '如果有多张满足条件，取文件体积最大的那一张'
  ].join('\n'),
  fallback_template_name: '',
  ocr_teacher_rule: '(?m)^[A-Za-z·\\\\-\\\\u4e00-\\\\u9fa5]{2,}$',
  ocr_time_rule: '(\\\\d{1,2}:\\\\d{2}\\\\s*-\\\\s*\\\\d{1,2}:\\\\d{2})',
  ocr_course_rule: '(?i)(JAZZ|SWAG|HOUSE|HEELS|URBAN|K-POP|KPOP|POP|LOCKING|HIPHOP|WAACKING|VOGUE|编舞|基础班|进阶班)',
  ocr_other_rule: '',
  ocr_text_rule: [
    '全局信息：顶部大写英文是舞室名，下方中文是分店名，底部“二月常规”等字样是月份。',
    '表格结构：第一列为时间段，后续列为周一至周日；单元格右侧三行依次为课程类型、时间段、老师姓名。'
  ].join('\n'),
  description: 'Phoenix 二月常规课表 OCR 模板示例'
};

const TemplateEditor: React.FC = () => {
  const [token, setToken] = useState<string>(localStorage.getItem('adminToken') || '');
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [templateForm] = Form.useForm();
  const [configForm] = Form.useForm();

  const adminHeaders = useMemo(() => token ? { 'x-admin-token': token } : {}, [token]);

  const ensureToken = () => {
    if (!token) {
      setTokenModalOpen(true);
      return false;
    }
    return true;
  };

  const loadConfigs = async () => {
    const res = await axios.get(apiUrl('/api/configs'));
    setConfigs(res.data || []);
  };

  const loadTemplates = async () => {
    const res = await axios.get(apiUrl('/api/templates'));
    setTemplates(res.data || []);
  };

  useEffect(() => {
    loadConfigs();
    loadTemplates();
  }, []);

  const saveToken = (value: string) => {
    localStorage.setItem('adminToken', value);
    setToken(value);
    setTokenModalOpen(false);
  };

  const openConfigModal = (record?: any) => {
    setEditingConfig(record || null);
    configForm.setFieldsValue(record || { enabled: true });
    setConfigModalOpen(true);
  };

  const saveConfig = async () => {
    if (!ensureToken()) return;
    const values = await configForm.validateFields();
    if (editingConfig) {
      await axios.put(apiUrl(`/api/configs/${editingConfig.id}`), values, { headers: adminHeaders });
    } else {
      await axios.post(apiUrl('/api/configs'), values, { headers: adminHeaders });
    }
    setConfigModalOpen(false);
    await loadConfigs();
  };

  const deleteConfig = async (record: any) => {
    if (!ensureToken()) return;
    await axios.delete(apiUrl(`/api/configs/${record.id}`), { headers: adminHeaders });
    await loadConfigs();
  };

  const runConfig = async (record: any) => {
    if (!ensureToken()) return;
    await axios.post(apiUrl(`/api/configs/${record.id}/run`), {}, { headers: adminHeaders });
    message.success('已触发爬取');
  };

  const saveTemplate = async () => {
    if (!ensureToken()) return;
    const values = await templateForm.validateFields();
    const payload = {
      name: values.name,
      studio: values.studio,
      branch: values.branch,
      description: values.description,
      crawler_rules: { text: values.crawler_rules_text, fallback_template_name: values.fallback_template_name || null },
      ocr_rules: {
        teacher: values.ocr_teacher_rule,
        time: values.ocr_time_rule,
        course: values.ocr_course_rule,
        other: values.ocr_other_rule,
        text: values.ocr_text_rule
      }
    };
    const res = await axios.post(apiUrl('/api/templates'), payload, { headers: adminHeaders });
    setSelectedTemplate(res.data);
    await loadTemplates();
    message.success('模板已保存为新版本');
  };

  const setCurrentTemplate = async (record: any) => {
    if (!ensureToken()) return;
    await axios.post(apiUrl(`/api/templates/${record.id}/set-current`), {}, { headers: adminHeaders });
    await loadTemplates();
    message.success('已设为当前版本');
  };

  const exportTemplates = async () => {
    if (!ensureToken()) return;
    const res = await axios.get(apiUrl('/api/templates/export'), { headers: adminHeaders });
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'templates-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplates = async (file: any) => {
    if (!ensureToken()) return false;
    const text = await file.text();
    const data = JSON.parse(text);
    await axios.post(apiUrl('/api/templates/import'), { templates: data }, { headers: adminHeaders });
    await loadTemplates();
    message.success('模板导入成功');
    return false;
  };

  const preview = async (values: any) => {
    if (!ensureToken()) return;
    setPreviewLoading(true);
    try {
      if (fileList.length) {
        const formData = new FormData();
        formData.append('file', fileList[0]);
        formData.append('template_name', values.preview_template_name || '');
        formData.append('studio', values.preview_studio || '');
        formData.append('branch', values.preview_branch || '');
        const res = await axios.post(apiUrl('/api/templates/preview'), formData, { headers: { ...adminHeaders, 'Content-Type': 'multipart/form-data' } });
        setPreviewResult(res.data);
      } else {
        const res = await axios.post(apiUrl('/api/templates/preview'), {
          url: values.preview_url,
          template_name: values.preview_template_name,
          studio: values.preview_studio,
          branch: values.preview_branch
        }, { headers: adminHeaders });
        setPreviewResult(res.data);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const configColumns = [
    { title: '舞室', dataIndex: 'studio' },
    { title: '分店', dataIndex: 'branch' },
    { title: 'URL', dataIndex: 'wechat_url', ellipsis: true },
    { title: '模板', dataIndex: 'template_name' },
    { title: '启用', dataIndex: 'enabled', render: (v: boolean) => v ? '是' : '否' },
    { title: '失败次数', dataIndex: 'fail_count' },
    { title: '需手工', dataIndex: 'need_manual_upload', render: (v: boolean) => v ? '是' : '否' },
    {
      title: '操作',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
          <Button size="small" onClick={() => openConfigModal(record)}>编辑</Button>
          <Button size="small" onClick={() => runConfig(record)} icon={<PlayCircleOutlined />}>运行</Button>
          <Button size="small" danger type="text" onClick={() => deleteConfig(record)}>删除</Button>
        </div>
      )
    }
  ];

  const templateColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '版本', dataIndex: 'version' },
    { title: '舞室', dataIndex: 'studio' },
    { title: '分店', dataIndex: 'branch' },
    { title: '当前', dataIndex: 'is_current', render: (v: boolean) => v ? '是' : '否' },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => setCurrentTemplate(record)}>设为当前</Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>模板与爬虫配置</h2>
      <Tabs
        items={[
          {
            key: 'configs',
            label: '舞室与URL配置',
            children: (
              <Card
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openConfigModal()}>新增配置</Button>}
              >
                <Table
                  rowKey="id"
                  columns={configColumns}
                  dataSource={configs}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                />
              </Card>
            )
          },
          {
            key: 'templates',
            label: '模板与规则',
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Card title="模板列表" extra={<Button onClick={exportTemplates}>导出模板</Button>}>
                    <Upload beforeUpload={importTemplates} showUploadList={false}>
                      <Button icon={<UploadOutlined />}>导入模板</Button>
                    </Upload>
                    <Table rowKey="id" columns={templateColumns} dataSource={templates} pagination={{ pageSize: 8 }} style={{ marginTop: 12 }} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card
                    title="模板编辑"
                    extra={
                      <Button
                        size="small"
                        onClick={() => templateForm.setFieldsValue(phoenixTemplateDefaults)}
                      >
                        填入 Phoenix 示例模板
                      </Button>
                    }
                  >
                    <Form form={templateForm} layout="vertical">
                      <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Form.Item name="studio" label="舞室">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="branch" label="分店">
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="crawler_rules_text" label="爬虫规则（自然语言）" rules={[{ required: true }]}>
                        <Input.TextArea
                          rows={6}
                          placeholder={[
                            '示例：',
                            'take_last_n: 1',
                            'min_size_kb: 120',
                            'ratio_min: 1.6',
                            '只保留包含 timetable 或 课表 的图片'
                          ].join('\n')}
                        />
                      </Form.Item>
                      <Form.Item name="fallback_template_name" label="备用模板名称">
                        <Input />
                      </Form.Item>
                      <Form.Item name="ocr_teacher_rule" label="老师姓名识别规则" rules={[{ required: true }]}>
                        <Input placeholder="示例：(?m)^[A-Za-z·\\-\\u4e00-\\u9fa5]{2,}$" />
                      </Form.Item>
                      <Form.Item name="ocr_time_rule" label="课程时间解析规则" rules={[{ required: true }]}>
                        <Input placeholder="示例：(\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2})" />
                      </Form.Item>
                      <Form.Item name="ocr_course_rule" label="课程名称提取规则" rules={[{ required: true }]}>
                        <Input placeholder="示例：(?i)(JAZZ|SWAG|HOUSE|HEELS|URBAN|K-POP|POP|LOCKING)" />
                      </Form.Item>
                      <Form.Item name="ocr_other_rule" label="其他字段规则">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item name="ocr_text_rule" label="OCR补充说明">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item name="description" label="备注">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Button type="primary" onClick={saveTemplate}>保存为新版本</Button>
                    </Form>
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'preview',
            label: '实时预览',
            children: (
              <Card>
                <Form layout="vertical" onFinish={preview}>
                  <Row gutter={12}>
                    <Col xs={24} lg={8}>
                      <Form.Item name="preview_template_name" label="模板名称">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item name="preview_studio" label="舞室">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item name="preview_branch" label="分店">
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="preview_url" label="测试微信URL">
                    <Input />
                  </Form.Item>
                  <Upload
                    beforeUpload={(file) => { setFileList([file]); return false; }}
                    onRemove={() => setFileList([])}
                    fileList={fileList}
                  >
                    <Button icon={<UploadOutlined />}>选择图片（可选）</Button>
                  </Upload>
                  <Button type="primary" htmlType="submit" loading={previewLoading} style={{ marginTop: 12 }}>
                    预览效果
                  </Button>
                </Form>
                {previewResult && (
                  <Card title="预览结果" style={{ marginTop: 16 }}>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(previewResult, null, 2)}</pre>
                  </Card>
                )}
              </Card>
            )
          }
        ]}
      />

      <Modal
        title="管理员密钥"
        open={tokenModalOpen}
        onCancel={() => setTokenModalOpen(false)}
        onOk={() => saveToken((document.getElementById('admin-token-input') as HTMLInputElement)?.value || '')}
      >
        <Input.Password id="admin-token-input" placeholder="输入 ADMIN_TOKEN" />
      </Modal>

      <Modal
        title={editingConfig ? '编辑配置' : '新增配置'}
        open={configModalOpen}
        onCancel={() => setConfigModalOpen(false)}
        onOk={saveConfig}
      >
        <Form form={configForm} layout="vertical">
          <Form.Item name="studio" label="舞室" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="branch" label="分店">
            <Input />
          </Form.Item>
          <Form.Item name="wechat_url" label="微信URL" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="template_name" label="模板名称">
            <Input />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateEditor;
