<template>
  <div class="dashboard-container">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">{{ $t('dashboard.welcome') }}</h1>
        <p class="hero-subtitle">{{ $t('dashboard.description') }}</p>
        <div class="hero-stats">
          <a-statistic :title="$t('dashboard.totalStudios')" :value="stats.totalStudios" />
          <a-statistic :title="$t('dashboard.todayCourses')" :value="stats.todayCourses" />
          <a-statistic :title="$t('dashboard.activeTasks')" :value="stats.activeTasks" />
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions-section">
      <h2 class="section-title">{{ $t('dashboard.quickActions') }}</h2>
      <div class="quick-actions-grid">
        <router-link
          v-for="action in quickActions"
          :key="action.path"
          :to="action.path"
          class="quick-action-card"
        >
          <div class="action-icon" :class="action.iconClass">
            <component :is="action.icon" />
          </div>
          <div class="action-content">
            <h3 class="action-title">{{ action.title }}</h3>
            <p class="action-description">{{ action.description }}</p>
          </div>
          <div class="action-arrow">
            <ArrowRightOutlined />
          </div>
        </router-link>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="recent-activity-section">
      <div class="activity-header">
        <h2 class="section-title">{{ $t('dashboard.recentActivity') }}</h2>
        <a-button type="link" @click="refreshActivity">{{ $t('common.refresh') }}</a-button>
      </div>
      <div class="activity-list">
        <div
          v-for="activity in recentActivity"
          :key="activity.id"
          class="activity-item"
        >
          <div class="activity-icon" :class="getActivityIconClass(activity.type)">
            <component :is="getActivityIcon(activity.type)" />
          </div>
          <div class="activity-content">
            <div class="activity-title">{{ activity.title }}</div>
            <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
          </div>
          <div class="activity-status" :class="activity.status">
            <a-badge :status="getBadgeStatus(activity.status)" :text="activity.statusText" />
          </div>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div class="system-status-section">
      <h2 class="section-title">{{ $t('dashboard.systemStatus') }}</h2>
      <div class="status-cards">
        <div class="status-card" :class="{ 'status-healthy': systemStatus.database }">
          <div class="status-icon">
            <DatabaseOutlined />
          </div>
          <div class="status-info">
            <div class="status-label">{{ $t('dashboard.database') }}</div>
            <div class="status-value">{{ systemStatus.database ? $t('common.healthy') : $t('common.error') }}</div>
          </div>
        </div>
        <div class="status-card" :class="{ 'status-healthy': systemStatus.ocrService }">
          <div class="status-icon">
            <RobotOutlined />
          </div>
          <div class="status-info">
            <div class="status-label">{{ $t('dashboard.ocrService') }}</div>
            <div class="status-value">{{ systemStatus.ocrService ? $t('common.healthy') : $t('common.error') }}</div>
          </div>
        </div>
        <div class="status-card" :class="{ 'status-healthy': systemStatus.crawlerService }">
          <div class="status-icon">
            <CloudSyncOutlined />
          </div>
          <div class="status-info">
            <div class="status-label">{{ $t('dashboard.crawlerService') }}</div>
            <div class="status-value">{{ systemStatus.crawlerService ? $t('common.healthy') : $t('common.error') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  RobotOutlined,
  CheckSquareOutlined,
  ProfileOutlined,
  SyncOutlined,
  DashboardOutlined,
  ArrowRightOutlined,
  DatabaseOutlined,
  CloudSyncOutlined
} from '@ant-design/icons-vue'
import { http } from '../services/http'
import { hasPermission } from '../services/permissions'

interface Stats {
  totalStudios: number
  todayCourses: number
  activeTasks: number
}

interface QuickAction {
  path: string
  title: string
  description: string
  icon: any
  iconClass: string
  permission?: string
}

interface Activity {
  id: string
  type: 'template' | 'ocr' | 'audit' | 'error'
  title: string
  timestamp: string
  status: 'success' | 'warning' | 'error'
  statusText: string
}

interface SystemStatus {
  database: boolean
  ocrService: boolean
  crawlerService: boolean
}

const { t } = useI18n()

const stats = ref<Stats>({
  totalStudios: 0,
  todayCourses: 0,
  activeTasks: 0
})

const recentActivity = ref<Activity[]>([])
const systemStatus = ref<SystemStatus>({
  database: true,
  ocrService: true,
  crawlerService: true
})

const quickActions = computed<QuickAction[]>(() => [
  {
    path: '/templates',
    title: t('dashboard.manageTemplates'),
    description: t('dashboard.manageTemplatesDesc'),
    icon: AppstoreOutlined,
    iconClass: 'templates',
    permission: 'templates.read'
  },
  {
    path: '/ocr-tasks',
    title: t('dashboard.ocrTasks'),
    description: t('dashboard.ocrTasksDesc'),
    icon: RobotOutlined,
    iconClass: 'ocr',
    permission: 'ocr.read'
  },
  {
    path: '/audit',
    title: t('dashboard.auditWorkbench'),
    description: t('dashboard.auditWorkbenchDesc'),
    icon: CheckSquareOutlined,
    iconClass: 'audit',
    permission: 'audit.read'
  },
  {
    path: '/dictionary',
    title: t('dashboard.dictionary'),
    description: t('dashboard.dictionaryDesc'),
    icon: ProfileOutlined,
    iconClass: 'dictionary',
    permission: 'dictionary.read'
  },
  {
    path: '/mapping-rules',
    title: t('dashboard.mappingRules'),
    description: t('dashboard.mappingRulesDesc'),
    icon: SyncOutlined,
    iconClass: 'mapping',
    permission: 'rules.read'
  },
  {
    path: '/quality',
    title: t('dashboard.qualityMonitor'),
    description: t('dashboard.qualityMonitorDesc'),
    icon: DashboardOutlined,
    iconClass: 'quality',
    permission: 'quality.read'
  }
].filter(action => !action.permission || hasPermission(action.permission)))

const fetchStats = async () => {
  try {
    const [studiosRes, coursesRes, tasksRes] = await Promise.all([
      http.get('/api/stats/studios'),
      http.get('/api/stats/today-courses'),
      http.get('/api/ocr/tasks', { params: { status: 'pending' } })
    ])
    
    stats.value = {
      totalStudios: studiosRes.data?.length || 0,
      todayCourses: coursesRes.data?.count || 0,
      activeTasks: tasksRes.data?.length || 0
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const fetchRecentActivity = async () => {
  try {
    const response = await http.get('/api/stats/recent-activity')
    recentActivity.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch recent activity:', error)
  }
}

const checkSystemStatus = async () => {
  try {
    const [dbRes, ocrRes, crawlerRes] = await Promise.allSettled([
      http.get('/health'),
      http.get('/api/ocr/health'),
      http.get('/api/crawler/health')
    ])
    
    systemStatus.value = {
      database: dbRes.status === 'fulfilled',
      ocrService: ocrRes.status === 'fulfilled',
      crawlerService: crawlerRes.status === 'fulfilled'
    }
  } catch (error) {
    console.error('Failed to check system status:', error)
  }
}

const refreshActivity = () => {
  fetchRecentActivity()
  message.success(t('common.refreshSuccess'))
}

const formatTime = (timestamp: string) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

const getActivityIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    template: AppstoreOutlined,
    ocr: RobotOutlined,
    audit: CheckSquareOutlined,
    error: DashboardOutlined
  }
  return iconMap[type] || DashboardOutlined
}

const getActivityIconClass = (type: string) => {
  return `activity-${type}`
}

const getBadgeStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    success: 'success',
    warning: 'warning',
    error: 'error'
  }
  return statusMap[status] || 'default'
}

onMounted(() => {
  fetchStats()
  fetchRecentActivity()
  checkSystemStatus()
  
  // 定期刷新数据
  const interval = setInterval(() => {
    fetchStats()
    fetchRecentActivity()
  }, 30000)
  
  // 清理定时器
  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<style scoped lang="less">
.dashboard-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 48px;
  margin-bottom: 32px;
  color: white;
  text-align: center;

  .hero-title {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .hero-subtitle {
    font-size: 16px;
    opacity: 0.9;
    margin-bottom: 32px;
  }

  .hero-stats {
    display: flex;
    justify-content: center;
    gap: 48px;
    flex-wrap: wrap;

    :deep(.ant-statistic) {
      .ant-statistic-title {
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
      }
      
      .ant-statistic-content {
        color: white;
        font-size: 28px;
        font-weight: 600;
      }
    }
  }
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1a1a1a;
}

.quick-actions-section {
  margin-bottom: 32px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.quick-action-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  text-decoration: none;
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border-color: #667eea;
  }

  .action-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    font-size: 20px;
    color: white;

    &.templates { background: linear-gradient(135deg, #667eea, #764ba2); }
    &.ocr { background: linear-gradient(135deg, #f093fb, #f5576c); }
    &.audit { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    &.dictionary { background: linear-gradient(135deg, #43e97b, #38f9d7); }
    &.mapping { background: linear-gradient(135deg, #fa709a, #fee140); }
    &.quality { background: linear-gradient(135deg, #a8edea, #fed6e3); }
  }

  .action-content {
    flex: 1;
    
    .action-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    
    .action-description {
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }
  }

  .action-arrow {
    color: #ccc;
    font-size: 16px;
    transition: color 0.3s ease;
  }

  &:hover .action-arrow {
    color: #667eea;
  }
}

.recent-activity-section {
  margin-bottom: 32px;

  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .activity-list {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 16px;
  }

  .activity-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .activity-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      font-size: 14px;
      color: white;

      &.activity-template { background: linear-gradient(135deg, #667eea, #764ba2); }
      &.activity-ocr { background: linear-gradient(135deg, #f093fb, #f5576c); }
      &.activity-audit { background: linear-gradient(135deg, #4facfe, #00f2fe); }
      &.activity-error { background: linear-gradient(135deg, #ff6b6b, #ee5a52); }
    }

    .activity-content {
      flex: 1;
      
      .activity-title {
        font-size: 14px;
        color: #1a1a1a;
        margin-bottom: 4px;
      }
      
      .activity-time {
        font-size: 12px;
        color: #999;
      }
    }
  }
}

.system-status-section {
  .status-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .status-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 20px;
    display: flex;
    align-items: center;
    border: 1px solid #f0f0f0;
    transition: all 0.3s ease;

    &.status-healthy {
      border-color: #52c41a;
      
      .status-icon {
        color: #52c41a;
      }
    }

    .status-icon {
      font-size: 24px;
      margin-right: 12px;
      color: #999;
    }

    .status-info {
      flex: 1;
      
      .status-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 4px;
      }
      
      .status-value {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }

  .hero-section {
    padding: 32px 24px;
    
    .hero-stats {
      gap: 24px;
    }
  }

  .quick-actions-grid {
    grid-template-columns: 1fr;
  }

  .status-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .hero-section {
    .hero-title {
      font-size: 24px;
    }
    
    .hero-stats {
      flex-direction: column;
      gap: 16px;
    }
  }
}
</style>