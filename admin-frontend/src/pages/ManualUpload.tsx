import React, { useEffect, useState } from 'react';
import { Upload, Button, message, Card, Form, Select, Row, Col, Image, Table, Tag, Space, Alert } from 'antd';
import { UploadOutlined, ZoomInOutlined, ZoomOutOutlined, RotateRightOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import axios from 'axios';
import { apiUrl } from '../lib/api';

interface OcrPreviewItem {
  weekday: string;
  time_range: string;
  teacher: string;
  course: string;
  style: string;
  level: string;
  raw_text: string;
}

const ManualUpload: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [form] = Form.useForm();

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
    // Only take the first file for now as backend seems to handle single file per request logic or we need to loop
    // But UI shows single preview, so let's stick to one file for clarity or handle list
    const file = fileList[0];
    formData.append('file', file as any);
    
    if (values.studio) formData.append('studio', values.studio);
    if (values.branch) formData.append('branch', values.branch);
    if (values.config_id) formData.append('config_id', values.config_id);
    
    setUploading(true);
    setOcrResult(null);
    
    try {
      // Create local preview url
      const objectUrl = URL.createObjectURL(file as any);
      setPreviewImage(objectUrl);

      const res = await axios.post(apiUrl('/api/upload'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Handle response structure
      // Expected: { success: true, data: [ { ocr_data: { preview: [], ... }, ... } ] }
      const data = res.data;
      if (data.success && data.data && data.data.length > 0) {
         setOcrResult(data.data[0]);
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

  const uploadProps: UploadProps = {
    onRemove: (file) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      if (fileList.length <= 1) setPreviewImage('');
    },
    beforeUpload: (file) => {
      setFileList([file]); // Allow only one file for better UX in this split view
      // Create preview immediately
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
          {record.level && <div style={{ fontSize: 12, color: '#faad14' }}>{record.level}</div>}
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
  ];

  // Extract preview data safely
  const previewData: OcrPreviewItem[] = ocrResult?.ocr_data?.preview || [];
  const studioInfo = ocrResult ? `${ocrResult.studio || ''} ${ocrResult.branch || ''}` : '';

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Manual Upload & OCR Analysis</h2>
        <Space>
          <Form layout="inline" form={form} onFinish={handleUpload}>
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
                    form.setFieldsValue({ studio: cfg.studio, branch: cfg.branch });
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
                <Button icon={<UploadOutlined />}>Select Image</Button>
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
                <span>Analysis Results</span>
                {studioInfo && <Tag color="blue">{studioInfo}</Tag>}
              </div>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, overflow: 'auto', padding: 0 }}
          >
            {ocrResult ? (
              previewData.length > 0 ? (
                <Table
                  dataSource={previewData}
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
    </div>
  );
};

export default ManualUpload;
