import React, { useEffect, useState } from 'react';
import { Upload, Button, message, Card, Form, Select, Row, Col, Image, Table, Tag, Space, Alert, Input, InputNumber, Modal } from 'antd';
import { DeleteOutlined, EditOutlined, RotateRightOutlined, SaveOutlined, UploadOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import axios from 'axios';
import { apiUrl } from '../lib/api';

interface OcrPreviewItem {
  weekday: string;
  time_range: string;
  teacher: string;
  course: string;
  style: string;
  level: number;
  raw_text: string;
  confidence?: number;
}

const ManualUpload: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [tableData, setTableData] = useState<OcrPreviewItem[]>([]);
  const [editingRow, setEditingRow] = useState<OcrPreviewItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(apiUrl('/api/configs/options'));
        setConfigs(res.data || []);
      } catch (e) {
        message.error('Failed to load configs');
      }
    };
    load();
  }, []);

  const handleUpload = async (values: any) => {
    if (fileList.length === 0) return;

    const formData = new FormData();
    const file = fileList[0];
    formData.append('file', file as any);
    
    if (values.studio) formData.append('studio', values.studio);
    if (values.branch) formData.append('branch', values.branch);
    if (values.config_id) formData.append('config_id', values.config_id);
    
    setUploading(true);
    setOcrResult(null);
    setTableData([]);
    
    try {
      const objectUrl = URL.createObjectURL(file as any);
      setPreviewImage(objectUrl);

      const res = await axios.post(apiUrl('/api/upload'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const data = res.data;
      if (data.success && data.data && data.data.length > 0) {
         setOcrResult(data.data[0]);
         setTableData(data.data[0].ocr_data?.preview || []);
         message.success('Upload & OCR successfully.');
      } else {
         message.warning('Upload success but no OCR data returned.');
         setOcrResult(data);
      }
      setFileList([]);
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditRow = (record: OcrPreviewItem) => {
    setEditingRow(record);
    editForm.setFieldsValue(record);
    setEditModalOpen(true);
  };

  const handleSaveRow = async () => {
    try {
      const values = await editForm.validateFields();
      const newData = [...tableData];
      const index = newData.findIndex(item => item === editingRow);
      if (index > -1) {
        newData[index] = { ...editingRow, ...values, confidence: 1.0 }; // Manually fixed means 100% confidence
        setTableData(newData);
        setEditModalOpen(false);
        setEditingRow(null);
      }
    } catch (err) {
      message.error('Validation failed');
    }
  };

  const handleDeleteRow = (record: OcrPreviewItem) => {
    Modal.confirm({
      title: 'Delete this row?',
      onOk: () => {
        setTableData(prev => prev.filter(item => item !== record));
      }
    });
  };

  const handleConfirmUpload = async () => {
    if (!ocrResult || tableData.length === 0) return;
    
    try {
      const payload = {
        studio: ocrResult.studio,
        branch: ocrResult.branch,
        month: ocrResult.ocr_data?.month, // Assuming month is in ocr_data
        schedules: tableData
      };
      
      await axios.post(apiUrl('/api/upload/confirm'), payload);
      message.success('Schedule data confirmed and saved to database!');
      // Optionally clear state or redirect
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed to save data');
    }
  };

  const uploadProps: UploadProps = {
    onRemove: (file) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      if (fileList.length <= 1) setPreviewImage('');
    },
    beforeUpload: (file) => {
      setFileList([file]); 
      const objectUrl = URL.createObjectURL(file);
      setPreviewImage(objectUrl);
      return false;
    },
    fileList,
    maxCount: 1,
    listType: 'picture',
  };

  const columns = [
    {
      title: 'Weekday',
      dataIndex: 'weekday',
      key: 'weekday',
      width: 80,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Time',
      dataIndex: 'time_range',
      key: 'time_range',
      width: 120,
    },
    {
      title: 'Course',
      dataIndex: 'course',
      key: 'course',
      render: (text: string, record: OcrPreviewItem) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          {record.level > 0 && <div style={{ fontSize: 12, color: '#faad14' }}>{'⭐'.repeat(record.level)}</div>}
        </div>
      ),
    },
    {
      title: 'Teacher',
      dataIndex: 'teacher',
      key: 'teacher',
      render: (text: string) => <Tag>{text || '-'}</Tag>,
    },
    {
      title: 'Style',
      dataIndex: 'style',
      key: 'style',
      render: (text: string) => (text ? <Tag color="geekblue">{text}</Tag> : '-'),
    },
    {
      title: 'Conf.',
      dataIndex: 'confidence',
      key: 'conf',
      width: 70,
      render: (val: number) => {
        if (val === undefined) return '-';
        const color = val > 0.8 ? 'green' : val > 0.5 ? 'orange' : 'red';
        return <Tag color={color}>{(val * 100).toFixed(0)}%</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_: any, record: OcrPreviewItem) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditRow(record)} />
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteRow(record)} />
        </Space>
      ),
    },
  ];

  const studioInfo = ocrResult ? `${ocrResult.studio || ''} ${ocrResult.branch || ''}` : '';

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Manual Upload & Correction</h2>
        <Space>
          <Form layout="inline" form={uploadForm} onFinish={handleUpload}>
             <Form.Item name="config_id" style={{ width: 200, marginBottom: 0 }}>
              <Select
                placeholder="Select Config (Optional)"
                allowClear
                options={configs.map((c: any) => ({
                  value: c.id,
                  label: `${c.studio || ''} ${c.branch || ''}`
                }))}
                onChange={(val) => {
                  const cfg = configs.find(c => c.id === val);
                  if (cfg) {
                    uploadForm.setFieldsValue({ studio: cfg.studio, branch: cfg.branch });
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="studio" style={{ width: 120, marginBottom: 0 }}>
              <Select placeholder="Studio" allowClear options={[...new Set(configs.map((c: any) => c.studio).filter(Boolean))].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="branch" style={{ width: 120, marginBottom: 0 }}>
              <Select placeholder="Branch" allowClear options={[...new Set(configs.map((c: any) => c.branch).filter(Boolean))].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Upload {...uploadProps} showUploadList={false}>
                <Button icon={<UploadOutlined />}>Image</Button>
              </Upload>
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" disabled={fileList.length === 0} loading={uploading}>
                {uploading ? 'Analyzing...' : 'Start OCR'}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </div>

      <Row gutter={24} style={{ flex: 1, overflow: 'hidden' }}>
        {/* Left Column: Image Preview */}
        <Col span={10} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title="Image Preview" 
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: '#f0f2f5' }}
          >
            {previewImage ? (
              <Image
                src={previewImage}
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                preview={{
                  toolbarRender: (
                    _,
                    { transform: { scale }, actions: { onFlipY, onFlipX, onRotateLeft, onRotateRight, onZoomOut, onZoomIn } },
                  ) => (
                    <Space size={12} className="toolbar-wrapper">
                      <ZoomOutOutlined onClick={onZoomOut} />
                      <ZoomInOutlined onClick={onZoomIn} />
                      <RotateRightOutlined onClick={onRotateRight} />
                    </Space>
                  ),
                }}
              />
            ) : (
              <div style={{ color: '#999', textAlign: 'center' }}>
                <UploadOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>Please select an image to start</p>
              </div>
            )}
          </Card>
        </Col>

        {/* Right Column: OCR Results */}
        <Col span={14} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <span>Parsed Results</span>
                  {studioInfo && <Tag color="blue">{studioInfo}</Tag>}
                </Space>
                {tableData.length > 0 && (
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleConfirmUpload}>
                    Confirm & Save to DB
                  </Button>
                )}
              </div>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
          >
            {ocrResult ? (
              tableData.length > 0 ? (
                <Table
                  dataSource={tableData}
                  columns={columns}
                  rowKey={(record) => `${record.weekday}-${record.time_range}-${record.course}`}
                  pagination={false}
                  size="small"
                  sticky
                  scroll={{ y: 'calc(100vh - 250px)' }}
                />
              ) : (
                <div style={{ padding: 24 }}>
                  <Alert
                    message="OCR Completed"
                    description="No course data extracted. This might be due to low image quality or unsupported format."
                    type="warning"
                    showIcon
                  />
                  <div style={{ marginTop: 16 }}>
                    <h4>Raw Debug Data:</h4>
                    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
                      {JSON.stringify(ocrResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                {uploading ? 'Analyzing image...' : 'No results yet'}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Edit Schedule"
        open={editModalOpen}
        onOk={handleSaveRow}
        onCancel={() => setEditModalOpen(false)}
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="weekday" label="Weekday" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="time_range" label="Time" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="course" label="Course" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="teacher" label="Teacher">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="style" label="Style">
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
          </Row>
          <Form.Item name="level" label="Level (Difficulty)">
            <InputNumber min={0} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ManualUpload;
