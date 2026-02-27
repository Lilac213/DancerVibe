import React, { createContext, useContext, useMemo, useState } from 'react';

type Lang = 'zh' | 'en';

const messages: Record<Lang, Record<string, string>> = {
  zh: {
    'menu.crawler': '微信公众号爬虫',
    'menu.upload': '手动上传',
    'menu.adminSystem': '配置管理系统',
    'admin.title': '配置管理系统',
    'admin.month': '月份',
    'admin.studio': '舞室',
    'admin.branch': '分店',
    'admin.restart': '重启',
    'admin.restartAll': '一键重启全部',
    'admin.instances': '爬虫实例',
    'admin.completed': '已完成',
    'admin.pending': '未完成',
    'admin.failReason': '失败原因',
    'admin.images': '图片结果',
    'admin.parsed': '解析结果',
    'admin.monitoring': '数据监控',
    'admin.rules': '规则管理',
    'admin.logs': '操作日志',
    'admin.backup': '备份',
    'admin.restore': '恢复',
    'admin.confirm': '确认操作',
    'admin.confirmRestart': '确认重启并覆盖当月数据？',
    'admin.confirmDelete': '确认删除？',
    'admin.confirmRestore': '确认恢复备份数据？',
    'admin.export': '导出',
    'admin.download': '下载',
    'admin.search': '搜索',
    'admin.imagePreview': '图片预览',
    'admin.ruleName': '规则名称',
    'admin.targetUrl': '目标URL',
    'admin.fieldMapping': '字段映射',
    'admin.updateFrequency': '更新频率',
    'admin.exceptionPolicy': '异常处理',
    'admin.current': '当前版本',
    'admin.setCurrent': '设为当前',
    'admin.createRule': '新增规则',
    'admin.save': '保存',
    'admin.edit': '编辑',
    'admin.delete': '删除',
    'admin.cancel': '取消',
    'admin.totalStudios': '舞室总数',
    'admin.completedStudios': '完成数量',
    'admin.pendingStudios': '未完成数量',
    'admin.failureList': '失败列表',
    'admin.status': '状态',
    'admin.action': '操作',
    'admin.reload': '刷新'
  },
  en: {
    'menu.crawler': 'WeChat Crawler',
    'menu.upload': 'Manual Upload',
    'menu.adminSystem': 'Admin Config',
    'admin.title': 'Admin Config System',
    'admin.month': 'Month',
    'admin.studio': 'Studio',
    'admin.branch': 'Branch',
    'admin.restart': 'Restart',
    'admin.restartAll': 'Restart All',
    'admin.instances': 'Crawler Instances',
    'admin.completed': 'Completed',
    'admin.pending': 'Pending',
    'admin.failReason': 'Failure Reason',
    'admin.images': 'Image Results',
    'admin.parsed': 'Parsed Results',
    'admin.monitoring': 'Monitoring',
    'admin.rules': 'Rules',
    'admin.logs': 'Operation Logs',
    'admin.backup': 'Backup',
    'admin.restore': 'Restore',
    'admin.confirm': 'Confirm',
    'admin.confirmRestart': 'Restart and overwrite this month?',
    'admin.confirmDelete': 'Confirm delete?',
    'admin.confirmRestore': 'Confirm restore backup data?',
    'admin.export': 'Export',
    'admin.download': 'Download',
    'admin.search': 'Search',
    'admin.imagePreview': 'Image Preview',
    'admin.ruleName': 'Rule Name',
    'admin.targetUrl': 'Target URL',
    'admin.fieldMapping': 'Field Mapping',
    'admin.updateFrequency': 'Update Frequency',
    'admin.exceptionPolicy': 'Exception Policy',
    'admin.current': 'Current',
    'admin.setCurrent': 'Set Current',
    'admin.createRule': 'Create Rule',
    'admin.save': 'Save',
    'admin.edit': 'Edit',
    'admin.delete': 'Delete',
    'admin.cancel': 'Cancel',
    'admin.totalStudios': 'Total Studios',
    'admin.completedStudios': 'Completed',
    'admin.pendingStudios': 'Pending',
    'admin.failureList': 'Failure List',
    'admin.status': 'Status',
    'admin.action': 'Action',
    'admin.reload': 'Reload'
  }
};

const I18nContext = createContext({
  lang: 'zh' as Lang,
  setLang: (_: Lang) => {},
  t: (key: string) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem('adminLang') as Lang) || 'zh');
  const setLang = (l: Lang) => {
    localStorage.setItem('adminLang', l);
    setLangState(l);
  };
  const t = (key: string) => messages[lang][key] || key;
  const value = useMemo(() => ({ lang, setLang, t }), [lang]);
  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useI18n = () => useContext(I18nContext);