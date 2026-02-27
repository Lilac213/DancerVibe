import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, List, Modal, Row, Select, Statistic, Table, Tabs, Tag, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../lib/api';
import { useI18n } from '../lib/i18n';

const AdminSystem: React.FC = () => {
  const { t } = useI18n();
  const [token, setToken] = useState<string>(localStorage.getItem('adminToken') || '');
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [studios, setStudios] = useState<any[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [instances, setInstances] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [imagesTotal, setImagesTotal] = useState(0);
  const [imagesPage, setImagesPage] = useState(1);
  const [parsed, setParsed] = useState<any[]>([]);
  const [parsedTotal, setParsedTotal] = useState(0);
  const [parsedPage, setParsedPage] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const adminHeaders = useMemo(() => token ? { 'x-admin-token': token } : {}, [token]);

  const ensureToken = () => {
    if (!token) {
      setTokenModalOpen(true);
      return false;
    }
    return true;
  };

  const loadMonths = async () => {
    if (!ensureToken()) return;
    const res = await axios.get(apiUrl('/api/admin/months'), { headers: adminHeaders });
    setMonths(res.data || []);
    if (!selectedMonth && res.data?.length) {
      setSelectedMonth(res.data[0]);
    }
  };

  const loadStudios = async (month: string) => {
    if (!ensureToken() || !month) return;
    const res = await axios.get(apiUrl('/api/admin/studios'), { headers: adminHeaders, params: { month } });
    setStudios(res.data || []);
    setInstances(res.data || []);
  };

  const loadImages = async () => {
    if (!ensureToken() || !selectedMonth) return;
    const res = await axios.get(apiUrl('/api/admin/images'), {
      headers: adminHeaders,
      params: {
        month: selectedMonth,
        studio: selectedStudio || undefined,
        branch: selectedBranch || undefined,
        limit: 12,
        offset: (imagesPage - 1) * 12
      }
    });
    setImages(res.data?.items || []);
    setImagesTotal(res.data?.total || 0);
  };

  const loadParsed = async () => {
    if (!ensureToken() || !selectedMonth) return;
    const res = await axios.get(apiUrl('/api/admin/parsed'), {
      headers: adminHeaders,
      params: {
        month: selectedMonth,
        studio: selectedStudio || undefined,
        branch: selectedBranch || undefined,
        limit: 20,
        offset: (parsedPage - 1) * 20
      }
    });
    setParsed(res.data?.items || []);
    setParsedTotal(res.data?.total || 0);
  };

  const loadStats = async () => {
    if (!ensureToken() || !selectedMonth) return;
    const res = await axios.get(apiUrl('/api/admin/stats'), { headers: adminHeaders, params: { month: selectedMonth } });
    setStats(res.data || {});
  };

  const loadLogs = async () => {
    if (!ensureToken()) return;
    const res = await axios.get(apiUrl('/api/admin/logs'), { headers: adminHeaders, params: { limit: 50, offset: 0 } });
    setLogs(res.data?.items || []);
  };

  useEffect(() => {
    loadMonths();
  }, [token]);

  useEffect(() => {
    if (selectedMonth) {
      loadStudios(selectedMonth);
      loadImages();
      loadParsed();
      loadStats();
    }
  }, [selectedMonth, selectedStudio, selectedBranch, imagesPage, parsedPage]);

  useEffect(() => {
    loadLogs();
  }, [token]);

  const branches = useMemo(() => {
    return studios.filter(s => s.studio === selectedStudio).map(s => s.branch || '');
  }, [studios, selectedStudio]);

  const studioOptions = Array.from(new Set(studios.map(s => s.studio)));

  const doRestart = async (studio?: string, branch?: string) => {
    if (!ensureToken()) return;
    await axios.post(apiUrl('/api/admin/restart'), { month: selectedMonth, studio, branch }, { headers: adminHeaders });
    message.success(t('admin.restart'));
    await loadStudios(selectedMonth);
    await loadImages();
    await loadParsed();
    await loadStats();
  };

  const confirmRestart = (studio?: string, branch?: string) => {
    Modal.confirm({
      title: t('admin.confirm'),
      content: t('admin.confirmRestart'),
      onOk: () => doRestart(studio, branch)
    });
  };

  const exportParsed = () => {
    const headers = ['course_date', 'weekday', 'studio_name', 'branch_name', 'time_range', 'course_name', 'style', 'teacher_name'];
    const rows = parsed.map(p => headers.map(h => `${p[h] ?? ''}`.replace(/"/g, '""')));
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parsed_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = async () => {
    if (!ensureToken()) return;
    setBackupLoading(true);
    try {
      const res = await axios.get(apiUrl('/api/admin/backup'), { headers: adminHeaders });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_backup_${selectedMonth || 'all'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBackupLoading(false);
    }
  };

  const restoreBackup = async (file: any) => {
    if (!ensureToken()) return false;
    Modal.confirm({
      title: t('admin.confirm'),
      content: t('admin.confirmRestore'),
      onOk: async () => {
        setRestoreLoading(true);
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await axios.post(apiUrl('/api/admin/restore'), data, { headers: adminHeaders });
          await loadStudios(selectedMonth);
        } finally {
          setRestoreLoading(false);
        }
      }
    });
    return false;
  };

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{t('admin.title')}</h2>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Select
            placeholder={t('admin.month')}
            value={selectedMonth}
            onChange={(v) => { setSelectedMonth(v); setSelectedStudio(''); setSelectedBranch(''); }}
            options={months.map(m => ({ value: m, label: m }))}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} md={8}>
          <Select
            placeholder={t('admin.studio')}
            value={selectedStudio || undefined}
            onChange={(v) => { setSelectedStudio(v); setSelectedBranch(''); }}
            options={studioOptions.map(s => ({ value: s, label: s }))}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} md={8}>
          <Select
            placeholder={t('admin.branch')}
            value={selectedBranch || undefined}
            onChange={(v) => setSelectedBranch(v)}
            options={branches.map(b => ({ value: b, label: b || '-' }))}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'instances',
            label: t('admin.instances'),
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={instances.filter(i => !selectedStudio || i.studio === selectedStudio).filter(i => !selectedBranch || (i.branch || '') === (selectedBranch || ''))}
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: t('admin.studio'), dataIndex: 'studio' },
                    { title: t('admin.branch'), dataIndex: 'branch' },
                    { title: t('admin.completed'), dataIndex: 'completed', render: (v) => v ? <Tag color="green">Y</Tag> : <Tag color="red">N</Tag> },
                    { title: t('admin.failReason'), dataIndex: 'fail_reason', render: (v) => v ? <Tag color="red">{v}</Tag> : '-' },
                    {
                      title: t('admin.action'),
                      render: (_: any, record: any) => (
                        <Button size="small" onClick={() => confirmRestart(record.studio, record.branch)}>
                          {t('admin.restart')}
                        </Button>
                      )
                    }
                  ]}
                />
              </Card>
            )
          },
          {
            key: 'images',
            label: t('admin.images'),
            children: (
              <Card>
                <List
                  grid={{ gutter: 12, xs: 1, sm: 2, md: 3, lg: 4 }}
                  dataSource={images}
                  pagination={{
                    pageSize: 12,
                    total: imagesTotal,
                    current: imagesPage,
                    onChange: (p) => setImagesPage(p)
                  }}
                  renderItem={(item: any) => (
                    <List.Item>
                      <Card size="small" title={`${item.studio || ''} ${item.branch || ''}`}>
                        {item.image_url ? (
                          <img src={item.image_url} width="100%" alt="timetable" />
                        ) : (
                          <div style={{ height: 140, background: '#f5f5f5' }} />
                        )}
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <Tag color={item.ocr_status === 'success' ? 'green' : 'red'}>{item.ocr_status}</Tag>
                          {item.download_url && (
                            <a href={item.download_url} target="_blank" rel="noreferrer">{t('admin.download')}</a>
                          )}
                        </div>
                      </Card>
                    </List.Item>
                  )}
                />
              </Card>
            )
          },
          {
            key: 'parsed',
            label: t('admin.parsed'),
            children: (
              <Card extra={<Button onClick={exportParsed}>{t('admin.export')}</Button>}>
                <Table
                  rowKey="id"
                  dataSource={parsed}
                  pagination={{
                    pageSize: 20,
                    total: parsedTotal,
                    current: parsedPage,
                    onChange: (p) => setParsedPage(p)
                  }}
                  columns={[
                    { title: '日期', dataIndex: 'course_date' },
                    { title: '星期', dataIndex: 'weekday' },
                    { title: t('admin.studio'), dataIndex: 'studio_name' },
                    { title: t('admin.branch'), dataIndex: 'branch_name' },
                    { title: '时间', dataIndex: 'time_range' },
                    { title: '课程', dataIndex: 'course_name' },
                    { title: '风格', dataIndex: 'style' },
                    { title: '老师', dataIndex: 'teacher_name' }
                  ]}
                />
              </Card>
            )
          },
          {
            key: 'monitoring',
            label: t('admin.monitoring'),
            children: (
              <Row gutter={16}>
                <Col span={8}>
                  <Card onClick={() => setFailModalOpen(true)}>
                    <Statistic title={t('admin.totalStudios')} value={stats?.totalStudios || 0} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card onClick={() => setFailModalOpen(true)}>
                    <Statistic title={t('admin.completedStudios')} value={stats?.completed || 0} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card onClick={() => setFailModalOpen(true)}>
                    <Statistic title={t('admin.pendingStudios')} value={stats?.pending || 0} />
                  </Card>
                </Col>
                <Modal open={failModalOpen} onCancel={() => setFailModalOpen(false)} onOk={() => setFailModalOpen(false)} title={t('admin.failureList')}>
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={stats?.failures || []}
                    pagination={false}
                    columns={[
                      { title: t('admin.studio'), dataIndex: 'studio' },
                      { title: t('admin.branch'), dataIndex: 'branch' },
                      { title: t('admin.status'), dataIndex: 'status' }
                    ]}
                  />
                </Modal>
              </Row>
            )
          },
          {
            key: 'logs',
            label: t('admin.logs'),
            children: (
              <Card extra={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button loading={backupLoading} onClick={downloadBackup}>{t('admin.backup')}</Button>
                  <Upload beforeUpload={restoreBackup} showUploadList={false}>
                    <Button loading={restoreLoading} icon={<UploadOutlined />}>{t('admin.restore')}</Button>
                  </Upload>
                </div>
              }>
                <Table
                  rowKey="id"
                  dataSource={logs}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: '时间', dataIndex: 'created_at' },
                    { title: '动作', dataIndex: 'action' },
                    { title: '资源', dataIndex: 'resource_type' },
                    { title: 'ID', dataIndex: 'resource_id' }
                  ]}
                />
              </Card>
            )
          }
        ]}
      />

      <Modal
        title="管理员密钥"
        open={tokenModalOpen}
        onCancel={() => setTokenModalOpen(false)}
        onOk={() => {
          const value = (document.getElementById('admin-token-input') as HTMLInputElement)?.value || '';
          localStorage.setItem('adminToken', value);
          setToken(value);
          setTokenModalOpen(false);
        }}
      >
        <Input.Password id="admin-token-input" placeholder="输入 ADMIN_TOKEN" />
      </Modal>
    </div>
  );
};

export default AdminSystem;