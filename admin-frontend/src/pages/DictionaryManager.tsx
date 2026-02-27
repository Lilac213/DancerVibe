import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tabs, message, Tag, InputNumber, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const DictionaryManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('course');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  const token = localStorage.getItem('adminToken');
  const headers = useMemo(() => token ? { 'x-admin-token': token } : {}, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(apiUrl(`/api/dict/${activeTab}`), { headers });
      setData(res.data || []);
    } catch (err) {
      message.error('Failed to load dictionary data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Construct payload for sys_dicts (category, key, value)
      const payload = {
        category: activeTab,
        key: values.key,
        sort_order: values.sort_order,
        value: {
           // Store other fields in value JSONB
           label: values.label,
           alias: values.alias,
           ...(activeTab === 'course' ? { 
             difficulty_level: values.difficulty_level,
             description: values.description 
           } : {}),
           ...(activeTab === 'teacher' ? { 
             main_styles: values.main_styles 
           } : {}),
           ...(activeTab === 'style' ? { 
             category: values.category 
           } : {})
        }
      };

      if (editingItem) {
        await axios.put(apiUrl(`/api/dict/${editingItem.id}`), payload, { headers });
        message.success('Updated successfully');
      } else {
        await axios.post(apiUrl(`/api/dict/${activeTab}`), payload, { headers });
        message.success('Created successfully');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      message.error('Operation failed');
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Are you sure?',
      content: 'This will soft delete the item.',
      onOk: async () => {
        try {
          await axios.delete(apiUrl(`/api/dict/${id}`), { headers });
          message.success('Deleted successfully');
          loadData();
        } catch (err) {
          message.error('Delete failed');
        }
      }
    });
  };

  const openModal = (item?: any) => {
    setEditingItem(item || null);
    if (item) {
      // Flatten value for form
      form.setFieldsValue({
        key: item.key,
        sort_order: item.sort_order,
        label: item.value?.label || item.key, // Fallback
        alias: item.value?.alias,
        difficulty_level: item.value?.difficulty_level,
        description: item.value?.description,
        main_styles: item.value?.main_styles,
        category: item.value?.category
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ sort_order: 0, difficulty_level: 1 });
    }
    setModalOpen(true);
  };

  const columns = [
    { title: 'Key', dataIndex: 'key', key: 'key', width: 150, render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'Label', key: 'label', width: 150, render: (_: any, r: any) => r.value?.label || '-' },
    { title: 'Alias', key: 'alias', render: (_: any, r: any) => r.value?.alias ? r.value.alias.split(',').map((a: string) => <Tag key={a}>{a.trim()}</Tag>) : '-' },
    
    ...(activeTab === 'course' ? [
      { title: 'Level', key: 'level', width: 100, render: (_: any, r: any) => '⭐'.repeat(r.value?.difficulty_level || 0) },
    ] : []),
    
    { title: 'Updated By', dataIndex: 'update_person', key: 'updater', width: 120, render: (t: string) => <Tag>{t || '-'}</Tag> },
    { title: 'Updated At', dataIndex: 'update_time', key: 'time', width: 180, render: (t: string) => new Date(t).toLocaleString() },
    
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <>
          <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Dictionary Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Item</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'course', label: 'Courses' },
          { key: 'teacher', label: 'Teachers' },
          { key: 'style', label: 'Styles' },
          { key: 'studio', label: 'Studios' }
        ]}
      />

      <Table
        loading={loading}
        dataSource={data}
        columns={columns}
        rowKey="id"
      />

      <Modal
        title={`${editingItem ? 'Edit' : 'Add'} ${activeTab}`}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
             <Col span={12}>
                <Form.Item name="key" label="Unique Key" rules={[{ required: true }]}>
                  <Input placeholder="e.g. JAZZ_FUNK" disabled={!!editingItem} />
                </Form.Item>
             </Col>
             <Col span={12}>
                <Form.Item name="label" label="Display Name" rules={[{ required: true }]}>
                  <Input placeholder="e.g. Jazz Funk" />
                </Form.Item>
             </Col>
          </Row>

          <Form.Item name="alias" label="Alias (comma separated)">
            <Input placeholder="e.g. JF, JazzFunk" />
          </Form.Item>
          
          <Form.Item name="sort_order" label="Sort Order">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          
          <Divider />
          
          {activeTab === 'course' && (
            <>
              <Form.Item name="difficulty_level" label="Difficulty Level">
                <InputNumber min={1} max={5} />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea />
              </Form.Item>
            </>
          )}
          
          {activeTab === 'teacher' && (
            <Form.Item name="main_styles" label="Main Styles">
              <Input />
            </Form.Item>
          )}
          
          {activeTab === 'style' && (
            <Form.Item name="category" label="Category">
              <Select options={[
                { value: 'Street', label: 'Street' },
                { value: 'Urban', label: 'Urban' },
                { value: 'Jazz', label: 'Jazz' },
                { value: 'K-Pop', label: 'K-Pop' },
                { value: 'Contemporary', label: 'Contemporary' },
                { value: 'Other', label: 'Other' }
              ]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DictionaryManager;
