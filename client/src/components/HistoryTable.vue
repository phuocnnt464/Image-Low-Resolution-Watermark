<template>
  <div class="history-section">
    <div class="history-header">
      <h3>Lịch sử xử lý</h3>
      <button class="btn-refresh" @click="store.fetchHistory">🔄 Làm mới</button>
    </div>

    <div v-if="store.history.length === 0" class="history-empty">
      Chưa có lịch sử nào
    </div>

    <div v-else class="history-table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th>Tên file gốc</th>
            <th>Kích thước gốc</th>
            <th>Kích thước mới</th>
            <th>Resolution</th>
            <th>Scale</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.history" :key="item.id">
            <td class="filename">{{ item.original_filename }}</td>
            <td>{{ formatSize(item.original_size) }}</td>
            <td>{{ formatSize(item.processed_size) }}</td>
            <td>
              <span v-if="item.processed_width">
                {{ item.processed_width }}×{{ item.processed_height }}
              </span>
              <span v-else>—</span>
            </td>
            <td>{{ item.scale_percent }}%</td>
            <td>
              <span class="badge" :class="`badge--${item.status}`">
                {{ statusLabel(item.status) }}
              </span>
            </td>
            <td>{{ formatDate(item.created_at) }}</td>
            <td>
              <button class="btn-delete" @click="store.removeHistory(item.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { useImageStore } from '../stores/imageStore'

const store = useImageStore()

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('vi-VN')
}

const statusLabel = (status) => {
  const map = { pending: '⏳ Đang xử lý', done: '✅ Success', failed: '❌ Failed' }
  return map[status] ?? status
}
</script>

<style scoped>
.history-section { margin-top: 40px; }
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.history-header h3 { margin: 0; color: #1e293b; }

.btn-refresh {
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
}
.btn-refresh:hover { background: #f1f5f9; }

.history-empty {
  text-align: center;
  padding: 32px;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
}

.history-table-wrap { overflow-x: auto; }
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.history-table th {
  background: #f1f5f9;
  padding: 10px 12px;
  text-align: left;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}
.history-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.history-table tr:hover td { background: #f8fafc; }
.filename {
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 500;
}
.badge--done    { background: #dcfce7; color: #16a34a; }
.badge--pending { background: #fef9c3; color: #ca8a04; }
.badge--failed  { background: #fee2e2; color: #dc2626; }

.btn-delete {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.5;
  transition: opacity 0.2s;
}
.btn-delete:hover { opacity: 1; }
</style>