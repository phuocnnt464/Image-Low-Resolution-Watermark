<template>
  <div class="wm-section">
    <div class="wm-header">
      <h3>💧 Watermark</h3>
      <span class="wm-badge" :class="store.watermarkFile ? 'wm-badge--custom' : 'wm-badge--default'">
        {{ store.watermarkFile ? 'Tùy chỉnh' : 'Mặc định' }}
      </span>
    </div>

    <div class="wm-body">
      <div
        class="wm-drop"
        :class="{ 'wm-drop--drag': isDragging, 'wm-drop--has': !!store.watermarkFile }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="inputRef?.click()"
      >
        <input
          ref="inputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style="display:none"
          @change="onFileChange"
        />
        <template v-if="!store.watermarkFile">
          <div class="wm-drop__icon">🏷️</div>
          <p class="wm-drop__text">Kéo thả hoặc <span class="wm-drop__link">chọn logo/watermark</span></p>
          <p class="wm-drop__hint">Nếu không upload, watermark mặc định sẽ được dùng</p>
        </template>
        <template v-else>
          <img :src="store.watermarkUrl" class="wm-drop__preview" alt="Watermark preview" />
          <p class="wm-drop__name">{{ store.watermarkFile.name }}</p>
        </template>
      </div>

      <button
        v-if="store.watermarkFile"
        class="wm-clear"
        @click.stop="store.clearWatermark()"
      >
        🗑 Dùng watermark mặc định
      </button>
    </div>

    <!-- Preview ảnh đã chèn watermark (Canvas) -->
    <div v-if="store.selectedFiles.length > 0 && store.watermarkUrl" class="wm-preview-section">
      <!-- Header + navigation -->
      <div class="wm-preview-header">
        <p class="wm-preview-title">👁 Preview ảnh với watermark:</p>
        <div class="wm-preview-nav">
          <button
            class="wm-nav-btn"
            :disabled="currentIndex === 0"
            @click="currentIndex--"
          >‹</button>
          <span class="wm-nav-counter">{{ currentIndex + 1 }} / {{ store.selectedFiles.length }}</span>
          <button
            class="wm-nav-btn"
            :disabled="currentIndex === store.selectedFiles.length - 1"
            @click="currentIndex++"
          >›</button>
        </div>
      </div>

      <p class="wm-preview-filename">{{ store.selectedFiles[currentIndex]?.name }}</p>
      <canvas ref="canvasRef" class="wm-canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'

const store      = useImageStore()
const inputRef   = ref(null)
const canvasRef  = ref(null)
const isDragging = ref(false)
const currentIndex = ref(0)

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (file) store.setWatermark(file)
  e.target.value = ''
}

const onDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) store.setWatermark(file)
}

const drawPreview = async () => {
  await nextTick()

  const canvas = canvasRef.value
  if (!canvas) return

  const imgUrl = store.previewUrls[currentIndex.value]  // ← dùng currentIndex
  const wmUrl  = store.watermarkUrl
  if (!imgUrl || !wmUrl) return

  const ctx = canvas.getContext('2d')

  // Load ảnh gốc
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imgUrl
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })

  // Tính kích thước canvas (max 600px rộng)
  const maxW  = 600
  const scale = Math.min(1, maxW / img.naturalWidth)
  const dispW = Math.round(img.naturalWidth  * scale)
  const dispH = Math.round(img.naturalHeight * scale)

  canvas.width  = dispW
  canvas.height = dispH

  // Vẽ ảnh gốc
  ctx.drawImage(img, 0, 0, dispW, dispH)

  // Load watermark
  const wm = new Image()
  wm.crossOrigin = 'anonymous'
  wm.src = wmUrl
  await new Promise((resolve, reject) => {
    wm.onload = resolve
    wm.onerror = reject
  })

  // Tính kích thước watermark: 15% chiều rộng canvas
  const wmMaxW  = Math.round(dispW * 0.15)
  const wmScale = wmMaxW / wm.naturalWidth
  const wmW     = Math.round(wm.naturalWidth  * wmScale)
  const wmH     = Math.round(wm.naturalHeight * wmScale)

  const padding = Math.max(8, Math.round(15 * scale))
  const left    = padding
  const top     = Math.max(0, dispH - wmH - padding)

  ctx.drawImage(wm, left, top, wmW, wmH)
}

// Vẽ lại khi đổi watermark, đổi ảnh upload, hoặc chuyển index
watch(
  () => [store.watermarkUrl, store.previewUrls[currentIndex.value], currentIndex.value],
  ([newWmUrl, newImgUrl]) => {
    if (newWmUrl && newImgUrl) drawPreview()
  }
)

// Reset index về 0 nếu xóa bớt ảnh và index vượt quá
watch(
  () => store.selectedFiles.length,
  (len) => {
    if (currentIndex.value >= len) currentIndex.value = Math.max(0, len - 1)
  }
)
</script>

<style scoped>
.wm-section {
  margin-top: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
}
.wm-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wm-header h3 { margin: 0; font-size: 15px; color: #1e293b; }

.wm-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
}
.wm-badge--default { background: #f1f5f9; color: #64748b; }
.wm-badge--custom  { background: #dbeafe; color: #2563eb; }

.wm-drop {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.wm-drop:hover, .wm-drop--drag { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--has { border-style: solid; border-color: #3b82f6; }

.wm-drop__icon { font-size: 28px; margin-bottom: 6px; }
.wm-drop__text { font-size: 13px; color: #475569; margin: 0 0 4px; }
.wm-drop__link { color: #3b82f6; font-weight: 600; }
.wm-drop__hint { font-size: 11px; color: #94a3b8; margin: 0; }
.wm-drop__preview {
  max-height: 60px;
  max-width: 120px;
  object-fit: contain;
  margin-bottom: 6px;
}
.wm-drop__name { font-size: 11px; color: #64748b; margin: 0; }

.wm-clear {
  margin-top: 8px;
  width: 100%;
  background: transparent;
  border: 1px solid #fca5a5;
  color: #ef4444;
  border-radius: 6px;
  padding: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.wm-clear:hover { background: #fef2f2; }

/* ── Preview section ── */
.wm-preview-section { margin-top: 16px; }

.wm-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.wm-preview-title {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

/* Navigation */
.wm-preview-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wm-nav-btn {
  background: #e2e8f0;
  border: none;
  border-radius: 50%;
  width: 26px; height: 26px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #475569;
  padding: 0;
  transition: background 0.15s;
}
.wm-nav-btn:hover:not(:disabled) { background: #3b82f6; color: white; }
.wm-nav-btn:disabled { opacity: 0.3; cursor: default; }
.wm-nav-counter {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  min-width: 36px;
  text-align: center;
}

.wm-preview-filename {
  font-size: 11px;
  color: #94a3b8;
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wm-canvas {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: block;
}
</style>