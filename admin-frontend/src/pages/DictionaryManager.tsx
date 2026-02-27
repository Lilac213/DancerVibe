import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tabs, message, Tag, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const DictionaryManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('course');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogs, setChangelogs] = useState<any[]>([]);
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
      if (editingItem) {
        await axios.put(apiUrl(`/api/dict/${activeTab}/${editingItem.id}`), values, { headers });
        message.success('Updated successfully');
      } else {
        await axios.post(apiUrl(`/api/dict/${activeTab}`), values, { headers });
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
      onOk: async () => {
        try {
          await axios.delete(apiUrl(`/api/dict/${activeTab}/${id}`), { headers });
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
    form.setFieldsValue(item || { difficulty_level: 1 });
    setModalOpen(true);
  };

  const loadChangelogs = async () => {
    try {
      const res = await axios.get(apiUrl('/api/dict/changelog/list'), { headers });
      setChangelogs(res.data || []);
      setChangelogOpen(true);
    } catch (err) {
      message.error('Failed to load logs');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200 },
    { title: 'Alias', dataIndex: 'alias', key: 'alias', render: (t: string) => t ? t.split(',').map(a => <Tag key={a}>{a.trim()}</Tag>) : '-' },
    ...(activeTab === 'course' ? [
      { title: 'Level', dataIndex: 'difficulty_level', key: 'level', width: 100, render: (v: number) => '⭐'.repeat(v) },
      { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true }
    ] : []),
    ...(activeTab === 'teacher' ? [
      { title: 'Main Styles', dataIndex: 'main_styles', key: 'styles' }
    ] : []),
    ...(activeTab === 'style' ? [
      { title: 'Category', dataIndex: 'category', key: 'cat' }
    ] : []),
    {
      title: 'Action',
      key: 'action',
      width: 150,
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
        <div>
          <Button icon={<HistoryOutlined />} onClick={loadChangelogs} style={{ marginRight: 8 }}>Changelog</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Item</Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'course', label: 'Courses' },
          { key: 'teacher', label: 'Teachers' },
          { key: 'style', label: 'Styles' }
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
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="alias" label="Alias (comma separated)">
            <Input placeholder="e.g. Hip Hop, Hip-Hop" />
          </Form.Item>
          
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

      <Modal
        title="Changelog"
        open={changelogOpen}
        onCancel={() => setChangelogOpen(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={changelogs}
          rowKey="id"
          columns={[
            { title: 'Time', dataIndex: 'created_at', render: (t) => new Date(t).toLocaleString() },
            { title: 'Type', dataIndex: 'dict_type' },
            { title: 'Action', dataIndex: 'action_type', render: (t) => <Tag color={t === 'delete' ? 'red' : 'green'}>{t}</Tag> },
            { title: 'Operator', dataIndex: 'operator' },
            { title: 'Details', render: (_, r) => (
              <div style={{ maxHeight: 100, overflow: 'auto', fontSize: 12 }}>
                {r.action_type === 'update' ? (
                  <>Old: {JSON.stringify(r.old_value)}<br/>New: {JSON.stringify(r.new_value)}</>
                ) : JSON.stringify(r.new_value || r.old_value)}
              </div>
            )}
          ]}
        />
      </Modal>
    </div>
  );
};

export default DictionaryManager;
