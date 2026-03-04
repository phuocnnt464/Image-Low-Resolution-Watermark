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
            <th>Dung lượng gốc</th>
            <th>Dung lượng mới</th>
            <th>Resolution</th>
            <th>Preset</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.history" :key="item.id">
            <td class="filename" :title="item.original_filename">
              {{ item.original_filename }}
            </td>
            <td>{{ formatSize(item.original_size) }}</td>
            <td>
              <span :class="sizeClass(item.original_size, item.processed_size)">
                {{ formatSize(item.processed_size) }}
              </span>
            </td>
            <td>
              <span v-if="item.processed_width">
                {{ item.processed_width }}×{{ item.processed_height }}
              </span>
              <span v-else>—</span>
            </td>
            <td>
              <span class="preset-badge" :class="`preset-badge--${tierOf(item.resolution_preset)}`">
                {{ item.resolution_preset || '—' }}
              </span>
            </td>
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
  const map = { pending: '⏳ Đang xử lý', done: '✅ Xong', failed: '❌ Thất bại' }
  return map[status] ?? status
}

// Phân nhóm màu badge theo preset tier
const tierOf = (preset) => {
  if (!preset || preset === 'Original' || preset === '4K' || preset === 'QHD') return 'high'
  if (preset === 'FHD' || preset === 'HD') return 'mid'
  return 'low'  // SD, LD, Tiny
}

// Màu dung lượng mới so với gốc
const sizeClass = (orig, processed) => {
  if (!orig || !processed) return ''
  const ratio = processed / orig
  if (ratio < 0.4) return 'size--much-smaller'
  if (ratio < 0.8) return 'size--smaller'
  return 'size--similar'
}
</script>

<style scoped>
.history-section { margin-top: 20px; }
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

/* ── Preset badge ── */
.preset-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.preset-badge--high { background: #dcfce7; color: #16a34a; }
.preset-badge--mid  { background: #dbeafe; color: #2563eb; }
.preset-badge--low  { background: #fff7ed; color: #ea580c; }

/* ── Status badge ── */
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

/* ── Size comparison ── */
.size--much-smaller { color: #16a34a; font-weight: 600; }
.size--smaller      { color: #2563eb; }
.size--similar      { color: #94a3b8; }

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