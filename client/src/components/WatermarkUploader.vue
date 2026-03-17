<template>
  <div class="wm-section">
    <div class="wm-header">
      <h3>Logo Optional</h3>
      <span class="wm-badge" :class="store.watermarkFile ? 'wm-badge--custom' : 'wm-badge--default'">
        {{ store.watermarkFile ? 'Tùy chỉnh' : 'Mặc định' }}
      </span>
    </div>

    <div class="wm-controls-row">
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
            <p class="wm-drop__text">Kéo thả hoặc <span class="wm-drop__link">chọn logo</span></p>
            <p class="wm-drop__hint">Nếu không upload, logo mặc định sẽ được dùng</p>
          </template>
          <template v-else>
            <img :src="store.watermarkUrl" class="wm-drop__preview" alt="Watermark preview" />
            <p class="wm-drop__name">{{ store.watermarkFile.name }}</p>
          </template>
        </div>
        <button v-if="store.watermarkFile" class="wm-clear" @click.stop="store.clearWatermark()">
          🗑 Dùng Logo mặc định
        </button>
      </div>

      <!-- Position grid -->
      <div class="wm-position-section">
        <p class="wm-position-label">📍 Vị trí:</p>
        <div class="wm-position-grid">
          <button
            v-for="pos in positionGrid"
            :key="pos.value"
            class="wm-pos-btn"
            :class="{ 'wm-pos-btn--active': store.watermarkPosition === pos.value }"
            :title="pos.label"
            @click="store.watermarkPosition = pos.value"
          >{{ pos.icon }}</button>
        </div>
        <p class="wm-position-name">{{ currentPositionLabel }}</p>
      </div>
    </div>

    <!-- IMAGE preview -->
    <div v-if="!isVideo && store.previewUrls?.length > 0" class="wm-preview-section">
      <div class="wm-preview-header">
        <p class="wm-preview-title">👁 Preview ảnh với Logo:</p>
        <div class="wm-preview-nav">
          <button class="wm-nav-btn" :disabled="currentIndex === 0" @click="currentIndex--">‹</button>
          <span class="wm-nav-counter">{{ currentIndex + 1 }} / {{ store.selectedFiles.length }}</span>
          <button class="wm-nav-btn" :disabled="currentIndex === store.selectedFiles.length - 1" @click="currentIndex++">›</button>
        </div>
      </div>
      <p class="wm-preview-filename">{{ store.selectedFiles[currentIndex]?.name }}</p>
      <canvas ref="canvasRef" class="wm-canvas"></canvas>
    </div>

    <!-- VIDEO preview -->
    <div v-if="isVideo && store.selectedFile" class="wm-preview-section">
      <div class="wm-preview-header">
        <p class="wm-preview-title">👁 Preview frame với Logo:</p>
        <button class="wm-refresh-btn" @click="onRefreshFrame">
          🔄 Cập nhật frame
        </button>
      </div>
      <p class="wm-preview-hint">▶ Tua video đến frame muốn xem rồi nhấn "Cập nhật frame"</p>

      <!--
        ✅ Video ẩn đúng cách:
        - visibility:hidden + position:absolute → browser VẪN decode frame
        - display:none → browser KHÔNG decode frame (bug gốc)
        - width/height > 0 bắt buộc để browser xử lý
      -->
      <video
        ref="hiddenVideoRef"
        :src="store.previewUrl"
        preload="auto"
        style="position:absolute; visibility:hidden; width:1px; height:1px; pointer-events:none;"
        @canplay="onVideoCanPlay"
        crossorigin="anonymous"
      ></video>

      <canvas ref="canvasRef" class="wm-canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  store:    { type: Object, required: true },
  // Giữ prop này để không break App.vue, nhưng không dùng nữa
  videoRef: { type: Object, default: null },
})
const store = props.store

// Phát hiện image hay video store
const isVideo = computed(() => 'selectedFile' in store && !('selectedFiles' in store))

const inputRef       = ref(null)
const canvasRef      = ref(null)
const hiddenVideoRef = ref(null)
const isDragging     = ref(false)
const currentIndex   = ref(0)
const videoReady     = ref(false)  // true khi video đã decode được frame

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

// ── Canvas helpers ────────────────────────────────────────────────────────
const calcWmPosition = (position, canvasW, canvasH, wmW, wmH, padding) => {
  const cx = Math.round((canvasW - wmW) / 2)
  const cy = Math.round((canvasH - wmH) / 2)
  const map = {
    'top-left':      { left: padding,                 top: padding },
    'top-center':    { left: cx,                      top: padding },
    'top-right':     { left: canvasW - wmW - padding, top: padding },
    'center-left':   { left: padding,                 top: cy },
    'center':        { left: cx,                      top: cy },
    'center-right':  { left: canvasW - wmW - padding, top: cy },
    'bottom-left':   { left: padding,                 top: canvasH - wmH - padding },
    'bottom-center': { left: cx,                      top: canvasH - wmH - padding },
    'bottom-right':  { left: canvasW - wmW - padding, top: canvasH - wmH - padding },
  }
  const pos = map[position] || map['bottom-left']
  return { left: Math.max(0, pos.left), top: Math.max(0, pos.top) }
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload  = () => resolve(img)
  img.onerror = reject
  img.src = src
})

const drawLogoOnCanvas = async (source, sourceW, sourceH) => {
  const canvas = canvasRef.value
  if (!canvas || !sourceW || !sourceH) return
  const wmUrl = store.watermarkUrl || '/assets/watermark.png'
  const maxW  = 700
  const scale = Math.min(1, maxW / sourceW)
  const dispW = Math.round(sourceW * scale)
  const dispH = Math.round(sourceH * scale)
  canvas.width  = dispW
  canvas.height = dispH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, dispW, dispH)
  try {
    const wm      = await loadImage(wmUrl)
    const wmMaxW  = Math.round(dispW * 0.15)
    const wmScale = wmMaxW / wm.naturalWidth
    const wmW     = Math.round(wm.naturalWidth  * wmScale)
    const wmH     = Math.round(wm.naturalHeight * wmScale)
    const padding = Math.max(8, Math.round(15 * scale))
    const { left, top } = calcWmPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, padding)
    ctx.drawImage(wm, left, top, wmW, wmH)
  } catch (err) {
    console.error('drawLogoOnCanvas error:', err)
  }
}

// ── IMAGE preview ─────────────────────────────────────────────────────────
const drawImagePreview = async () => {
  await nextTick()
  const imgUrl = store.previewUrls?.[currentIndex.value]
  if (!imgUrl) return
  try {
    const img = await loadImage(imgUrl)
    await drawLogoOnCanvas(img, img.naturalWidth, img.naturalHeight)
  } catch (err) {
    console.error('drawImagePreview error:', err)
  }
}

// ── VIDEO preview ───────────────────────────────────────────────────��─────
const captureVideoFrame = async () => {
  await nextTick()
  const video = hiddenVideoRef.value
  if (!video || !video.videoWidth || !video.videoHeight) {
    console.warn('captureVideoFrame: video chưa sẵn sàng', video?.readyState)
    return
  }
  await drawLogoOnCanvas(video, video.videoWidth, video.videoHeight)
}

// Event handler khi video decode được frame đầu tiên
const onVideoCanPlay = async () => {
  videoReady.value = true
  await captureVideoFrame()
}

// Nút "Cập nhật frame" — người dùng tua rồi bấm
const onRefreshFrame = async () => {
  const video = hiddenVideoRef.value
  if (!video) return
  // Đồng bộ currentTime của hidden video với video đang hiển thị ở VideoUploader
  // (không cần vì cả 2 dùng cùng src, nhưng hidden video có thể ở frame khác)
  // → capture thẳng frame hiện tại của hidden video
  await captureVideoFrame()
}

// ── Watches ───────────────────────────────────────────────────────────────
watch(() => store.previewUrls?.length, (len) => {
  if (!isVideo.value && len > 0) drawImagePreview()
})

watch(() => store.watermarkUrl, () => {
  if (isVideo.value) { if (videoReady.value) captureVideoFrame() }
  else               { if (store.previewUrls?.[currentIndex.value]) drawImagePreview() }
})

watch(() => store.watermarkPosition, () => {
  if (isVideo.value) { if (videoReady.value) captureVideoFrame() }
  else               { if (store.previewUrls?.[currentIndex.value]) drawImagePreview() }
})

watch(currentIndex, () => {
  if (!isVideo.value && store.previewUrls?.[currentIndex.value]) drawImagePreview()
})

watch(() => store.selectedFiles?.length, (len) => {
  if (len !== undefined && currentIndex.value >= len)
    currentIndex.value = Math.max(0, len - 1)
})

// Reset khi video mới được chọn
watch(() => store.previewUrl, (url) => {
  if (!isVideo.value) return
  videoReady.value = false
  // hiddenVideoRef sẽ tự load src mới vì bind :src
  // event @canplay sẽ tự fire khi ready
})
</script>

<style scoped>
.wm-section {
  margin-top: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
}
.wm-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.wm-header h3 { margin: 0; font-size: 15px; color: #1e293b; }
.wm-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.wm-badge--default { background: #f1f5f9; color: #64748b; }
.wm-badge--custom  { background: #dbeafe; color: #2563eb; }

.wm-controls-row { display: flex; gap: 12px; align-items: flex-start; }
.wm-body { flex: 2; min-width: 0; display: flex; flex-direction: column; }

.wm-drop {
  border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px 12px;
  text-align: center; cursor: pointer; transition: all 0.2s; background: white;
  min-height: 120px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; flex: 1;
}
.wm-drop:hover, .wm-drop--drag { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--has { border-style: solid; border-color: #3b82f6; }
.wm-drop__icon { font-size: 24px; margin-bottom: 4px; }
.wm-drop__text { font-size: 12px; color: #475569; margin: 0 0 3px; }
.wm-drop__link { color: #3b82f6; font-weight: 600; }
.wm-drop__hint { font-size: 11px; color: #94a3b8; margin: 0; }
.wm-drop__preview { max-height: 52px; max-width: 100px; object-fit: contain; margin-bottom: 4px; }
.wm-drop__name { font-size: 11px; color: #64748b; margin: 0; }

.wm-clear {
  margin-top: 6px; width: 100%; background: transparent;
  border: 1px solid #fca5a5; color: #ef4444; border-radius: 6px;
  padding: 5px; font-size: 12px; cursor: pointer; transition: background 0.2s;
}
.wm-clear:hover { background: #fef2f2; }

.wm-position-section {
  flex: 1; min-width: 0; padding: 12px; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center;
}
.wm-position-label { font-size: 12px; color: #475569; margin: 0 0 8px; align-self: flex-start; }
.wm-position-grid {
  display: grid; grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px); gap: 3px; width: fit-content;
}
.wm-pos-btn {
  width: 28px; height: 28px; border: 1px solid #cbd5e1; border-radius: 5px;
  background: white; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; padding: 0; color: #64748b;
}
.wm-pos-btn:hover { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
.wm-pos-btn--active { background: #3b82f6; border-color: #3b82f6; color: white; }
.wm-position-name { margin: 6px 0 0; font-size: 11px; color: #3b82f6; font-weight: 600; text-align: center; }

/* Preview */
.wm-preview-section { margin-top: 16px; position: relative; }
.wm-preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.wm-preview-title { font-size: 12px; color: #64748b; margin: 0; }
.wm-refresh-btn {
  background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.15s;
}
.wm-refresh-btn:hover { background: #3b82f6; color: white; border-color: #3b82f6; }
.wm-preview-hint { font-size: 11px; color: #94a3b8; margin: 0 0 8px; }

.wm-preview-nav { display: flex; align-items: center; gap: 6px; }
.wm-nav-btn {
  background: #e2e8f0; border: none; border-radius: 50%; width: 26px; height: 26px;
  font-size: 16px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #475569; padding: 0; transition: background 0.15s;
}
.wm-nav-btn:hover:not(:disabled) { background: #3b82f6; color: white; }
.wm-nav-btn:disabled { opacity: 0.3; cursor: default; }
.wm-nav-counter { font-size: 12px; color: #64748b; font-weight: 600; min-width: 36px; text-align: center; }
.wm-preview-filename {
  font-size: 11px; color: #94a3b8; margin: 0 0 8px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wm-canvas {
  max-width: 100%; border-radius: 6px; margin: 0 auto;
  border: 1px solid #e2e8f0; display: block;
}
</style>