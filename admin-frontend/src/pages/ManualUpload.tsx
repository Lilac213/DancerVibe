import React, { useEffect, useState } from 'react';
import { Upload, Button, message, Card, Form, Select } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const ManualUpload: React.FC = () => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const res = await axios.get(apiUrl('/api/configs/options'));
      setConfigs(res.data || []);
    };
    load();
  }, []);

  const handleUpload = async (values: any) => {
    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append('file', file);
    });
    if (values.studio) formData.append('studio', values.studio);
    if (values.branch) formData.append('branch', values.branch);
    if (values.config_id) formData.append('config_id', values.config_id);
    
    setUploading(true);
    
    try {
      const res = await axios.post(apiUrl('/api/upload'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFileList([]);
      setResult(res.data);
      message.success('Upload successfully.');
    } catch (err) {
      setResult(null);
      message.error('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const props: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      setFileList([...fileList, file]);
      return false;
    },
    fileList,
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Manual Upload Timetable</h2>
      <Card>
        <Form layout="vertical" onFinish={handleUpload}>
          <Form.Item name="config_id" label="配置">
            <Select
              allowClear
              options={configs.map((c: any) => ({
                value: c.id,
                label: `${c.studio || ''} ${c.branch || ''} ${c.wechat_url || ''}`
              }))}
            />
          </Form.Item>
          <Form.Item name="studio" label="舞室">
            <Select allowClear options={[...new Set(configs.map((c: any) => c.studio).filter(Boolean))].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="branch" label="分店">
            <Select allowClear options={[...new Set(configs.map((c: any) => c.branch).filter(Boolean))].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Upload {...props} listType="picture">
            <Button icon={<UploadOutlined />}>Select Image</Button>
          </Upload>
          <Button
            type="primary"
            htmlType="submit"
            disabled={fileList.length === 0}
            loading={uploading}
            style={{ marginTop: 16 }}
          >
            {uploading ? 'Uploading' : 'Start Upload'}
          </Button>
        </Form>
        {result && (
          <Card title="OCR结果" style={{ marginTop: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default ManualUpload;
