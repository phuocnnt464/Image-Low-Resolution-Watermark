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

    <!-- ── Chọn vị trí watermark ── -->
    <div class="wm-position-section">
      <p class="wm-position-label">📍 Vị trí watermark:</p>
      <div class="wm-position-grid">
        <button
          v-for="pos in positions"
          :key="pos.value"
          class="wm-pos-btn"
          :class="{ 'wm-pos-btn--active': store.watermarkPosition === pos.value }"
          :title="pos.label"
          @click="store.watermarkPosition = pos.value"
        >{{ pos.icon }}</button>
      </div>
      <p class="wm-position-name">{{ currentPositionLabel }}</p>
    </div>

    <!-- Preview ảnh đã chèn watermark (Canvas) -->
    <div v-if="store.selectedFiles.length > 0 && store.watermarkUrl" class="wm-preview-section">
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
import { ref, computed, watch, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'

const store      = useImageStore()
const inputRef   = ref(null)
const canvasRef  = ref(null)
const isDragging = ref(false)
const currentIndex = ref(0)

// ── Danh sách vị trí ─────────────────────────────────────────────────────
const positions = [
  { value: 'top-left',      label: 'Trên trái',      icon: '↖' },
  { value: 'top-center',    label: 'Trên giữa',      icon: '↑' },
  { value: 'top-right',     label: 'Trên phải',      icon: '↗' },
  { value: 'center-left',   label: 'Giữa trái',      icon: '←' },
  { value: 'center',        label: 'Giữa',           icon: '⊙' }, 
  { value: 'center-right',  label: 'Giữa phải',      icon: '→' }, 
  { value: 'bottom-left',   label: 'Dưới trái',      icon: '↙' },
  { value: 'bottom-center', label: 'Dưới giữa',      icon: '↓' },
  { value: 'bottom-right',  label: 'Dưới phải',      icon: '↘' },
]

// Layout đúng: 3 hàng × 3 cột
const positionGrid = [
  { value: 'top-left',      label: 'Trên trái',  icon: '↖' },
  { value: 'top-center',    label: 'Trên giữa',  icon: '↑' },
  { value: 'top-right',     label: 'Trên phải',  icon: '↗' },
  { value: 'center-left',   label: 'Giữa trái',  icon: '←' },
  { value: 'center',        label: 'Giữa',        icon: '⊙' },
  { value: 'center-right',  label: 'Giữa phải',  icon: '→' },
  { value: 'bottom-left',   label: 'Dưới trái',  icon: '↙' },
  { value: 'bottom-center', label: 'Dưới giữa',  icon: '↓' },
  { value: 'bottom-right',  label: 'Dưới phải',  icon: '↘' },
]

const currentPositionLabel = computed(
  () => positionGrid.find(p => p.value === store.watermarkPosition)?.label ?? ''
)

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

// ── Tính tọa độ watermark theo position ──────────────────────────────────
const calcWmPosition = (position, canvasW, canvasH, wmW, wmH, padding) => {
  const cx = Math.round((canvasW - wmW) / 2)
  const cy = Math.round((canvasH - wmH) / 2)

  const map = {
    'top-left':      { left: padding,               top: padding },
    'top-center':    { left: cx,                    top: padding },
    'top-right':     { left: canvasW - wmW - padding, top: padding },
    'center-left':   { left: padding,               top: cy },
    'center':        { left: cx,                    top: cy },
    'center-right':  { left: canvasW - wmW - padding, top: cy },
    'bottom-left':   { left: padding,               top: canvasH - wmH - padding },
    'bottom-center': { left: cx,                    top: canvasH - wmH - padding },
    'bottom-right':  { left: canvasW - wmW - padding, top: canvasH - wmH - padding },
  }

  const pos = map[position] || map['bottom-left']
  return { left: Math.max(0, pos.left), top: Math.max(0, pos.top) }
}

const drawPreview = async () => {
  await nextTick()

  const canvas = canvasRef.value
  if (!canvas) return

  const imgUrl = store.previewUrls[currentIndex.value]
  const wmUrl  = store.watermarkUrl
  if (!imgUrl || !wmUrl) return

  const ctx = canvas.getContext('2d')

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imgUrl
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })

  const maxW  = 600
  const scale = Math.min(1, maxW / img.naturalWidth)
  const dispW = Math.round(img.naturalWidth  * scale)
  const dispH = Math.round(img.naturalHeight * scale)

  canvas.width  = dispW
  canvas.height = dispH
  ctx.drawImage(img, 0, 0, dispW, dispH)

  const wm = new Image()
  wm.crossOrigin = 'anonymous'
  wm.src = wmUrl
  await new Promise((resolve, reject) => { wm.onload = resolve; wm.onerror = reject })

  const wmMaxW  = Math.round(dispW * 0.15)
  const wmScale = wmMaxW / wm.naturalWidth
  const wmW     = Math.round(wm.naturalWidth  * wmScale)
  const wmH     = Math.round(wm.naturalHeight * wmScale)

  const padding = Math.max(8, Math.round(15 * scale))
  const { left, top } = calcWmPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, padding)

  ctx.drawImage(wm, left, top, wmW, wmH)
}

// Vẽ lại khi đổi watermark hoặc danh sách ảnh thay đổi
watch(
  () => [store.watermarkUrl, store.previewUrls.length],
  ([newWmUrl]) => {
    if (newWmUrl && store.previewUrls.length > 0) drawPreview()
  }
)

// Vẽ lại khi chuyển index
watch(currentIndex, () => {
  if (store.watermarkUrl && store.previewUrls[currentIndex.value]) drawPreview()
})

// Vẽ lại khi đổi vị trí
watch(() => store.watermarkPosition, () => {
  if (store.watermarkUrl && store.previewUrls[currentIndex.value]) drawPreview()
})

// Reset index nếu xóa ảnh
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

/* ── Position picker ── */
.wm-position-section {
  margin-top: 14px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.wm-position-label {
  font-size: 12px;
  color: #475569;
  margin: 0 0 8px;
}
.wm-position-grid {
  display: grid;
  grid-template-columns: repeat(3, 32px);
  grid-template-rows: repeat(3, 32px);
  gap: 4px;
  width: fit-content;
}
.wm-pos-btn {
  width: 32px; height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  padding: 0;
  color: #64748b;
}
.wm-pos-btn:hover { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
.wm-pos-btn--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}
.wm-position-name {
  margin: 6px 0 0;
  font-size: 11px;
  color: #3b82f6;
  font-weight: 600;
}

/* ── Preview section ── */
.wm-preview-section { margin-top: 16px; }

.wm-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.wm-preview-title { font-size: 12px; color: #64748b; margin: 0; }

.wm-preview-nav { display: flex; align-items: center; gap: 6px; }
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