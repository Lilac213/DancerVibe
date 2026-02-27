import React, { useEffect, useState } from 'react';
import { Card, DatePicker, Input, Select, Table } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import { apiUrl } from '../lib/api';

const { RangePicker } = DatePicker;

const OcrResults: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [studio, setStudio] = useState<string | undefined>();
  const [teacher, setTeacher] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (studio) params.studio = studio;
      if (teacher) params.teacher = teacher;
      if (keyword) params.q = keyword;
      if (dateRange) {
        params.from = dateRange[0].format('YYYY-MM-DD');
        params.to = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await axios.get(apiUrl('/api/stats/schedules'), { params });
      setData(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    { title: '日期', dataIndex: 'course_date' },
    { title: '星期', dataIndex: 'weekday' },
    { title: '舞室', dataIndex: 'studio_name' },
    { title: '分店', dataIndex: 'branch_name' },
    { title: '时间', dataIndex: 'time_range' },
    { title: '课程', dataIndex: 'course_name' },
    { title: '风格', dataIndex: 'style' },
    { title: '老师', dataIndex: 'teacher_name' },
  ];

  return (
    <Card title="课表提取结果">
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索课程/老师/风格"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={loadData}
          style={{ width: 200 }}
        />
        <Input
          placeholder="舞室"
          value={studio}
          onChange={(e) => setStudio(e.target.value || undefined)}
          style={{ width: 140 }}
        />
        <Input
          placeholder="老师"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value || undefined)}
          style={{ width: 140 }}
        />
        <RangePicker
          onChange={(val) => setDateRange(val as any)}
        />
        <a onClick={loadData}>刷新</a>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
      />
    </Card>
  );
};

export default OcrResults;

