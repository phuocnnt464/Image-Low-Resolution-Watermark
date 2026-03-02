<template>
  <div v-if="store.selectedFiles.length > 0" class="preview-section">
    <div class="preview-header">
      <h3>Ảnh đã chọn ({{ store.selectedFiles.length }})</h3>
      <button class="btn btn--ghost" @click="store.clearFiles">Xóa tất cả</button>
    </div>

    <div class="preview-grid">
      <div
        v-for="(url, index) in store.previewUrls"
        :key="index"
        class="preview-item"
      >
        <img :src="url" :alt="store.selectedFiles[index]?.name" />
        <button class="preview-item__remove" @click="store.removeFile(index)">✕</button>
        <p class="preview-item__name">{{ store.selectedFiles[index]?.name }}</p>
      </div>
    </div>

    <!-- Scale control -->
    <div class="scale-control">
    <label>
        Mức độ giảm resolution:
        <strong>{{ store.scalePercent }}%</strong>
        <span class="scale-desc">
        — {{ store.scalePercent <= 25 ? 'Ít mất chi tiết' : store.scalePercent <= 60 ? 'Vừa phải' : 'Mất nhiều chi tiết' }}
        </span>
    </label>
    <input
        type="range"
        min="10"
        max="90"
        step="5"
        v-model.number="store.scalePercent"
    />
    <div class="scale-ticks">
        <span>10% (ít)</span>
        <span>50%</span>
        <span>90% (nhiều)</span>
    </div>
    </div>
    <!-- Error message -->
    <p v-if="store.errorMessage" class="error">⚠️ {{ store.errorMessage }}</p>

    <!-- Download button -->
    <button
      class="btn btn--primary"
      :disabled="store.isProcessing"
      @click="store.processAndDownload"
    >
      <span v-if="store.isProcessing">⏳ Đang xử lý...</span>
      <span v-else>⬇️ Tải xuống ({{ store.selectedFiles.length }} ảnh)</span>
    </button>
  </div>
</template>

<script setup>
import { useImageStore } from '../stores/imageStore'
const store = useImageStore()
</script>

<style scoped>
.preview-section { margin-top: 24px; }

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.preview-header h3 { margin: 0; color: #1e293b; }

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.preview-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}
.preview-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.preview-item__remove {
  position: absolute;
  top: 4px; right: 4px;
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px; height: 22px;
  cursor: pointer;
  font-size: 11px;
  line-height: 22px;
  text-align: center;
  padding: 0;
}
.preview-item__remove:hover { background: #ef4444; }
.preview-item__name {
  font-size: 11px;
  color: #64748b;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.scale-control {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.scale-control label { display: block; margin-bottom: 8px; color: #475569; }
.scale-control input[type="range"] { width: 100%; accent-color: #3b82f6; }
.scale-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.error { color: #ef4444; font-size: 14px; margin-bottom: 12px; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn--primary {
  background: #3b82f6;
  color: white;
  width: 100%;
  justify-content: center;
}
.btn--primary:hover:not(:disabled) { background: #2563eb; }
.btn--primary:disabled { background: #93c5fd; cursor: not-allowed; }
.btn--ghost {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fecaca;
  padding: 6px 14px;
  font-size: 13px;
}
.btn--ghost:hover { background: #fef2f2; }
</style>