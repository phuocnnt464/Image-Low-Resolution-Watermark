<template>
  <div class="wm-section">

    <!-- Header -->
    <div class="wm-header">
      <h3>Logo Optional</h3>
      <span class="wm-badge" :class="store.watermarkFile ? 'wm-badge--custom' : 'wm-badge--default'">
        {{ store.watermarkFile ? 'Tùy chỉnh' : 'Mặc định' }}
      </span>
    </div>

    <!-- Logo upload + chọn vị trí -->
    <div class="wm-controls-row">

      <!-- Drop zone để upload logo -->
      <div class="wm-body">
        <div
          class="wm-drop"
          :class="{ 'wm-drop--drag': isDragging, 'wm-drop--has': !!store.watermarkFile }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="onFileChange"
          />

          <template v-if="!store.watermarkFile">
            <div class="wm-drop__icon">🏷️</div>
            <p class="wm-drop__text">Kéo thả hoặc <span class="wm-drop__link">chọn logo</span></p>
            <p class="wm-drop__hint">Nếu không upload, logo mặc định sẽ được dùng</p>
          </template>
          <template v-else>
            <img :src="store.watermarkUrl" class="wm-drop__preview" alt="Logo preview" />
            <p class="wm-drop__name">{{ store.watermarkFile.name }}</p>
          </template>
        </div>

        <button v-if="store.watermarkFile" class="wm-clear" @click.stop="store.clearWatermark()">
          🗑 Dùng Logo mặc định
        </button>
      </div>

      <!-- Grid 3x3 chọn vị trí logo -->
      <div class="wm-position-section">
        <p class="wm-position-label">📍 Vị trí:</p>
        <div class="wm-position-grid">
          <button
            v-for="pos in POSITIONS"
            :key="pos.value"
            class="wm-pos-btn"
            :class="{ 'wm-pos-btn--active': store.watermarkPosition === pos.value }"
            :title="pos.label"
            @click="store.watermarkPosition = pos.value"
          >
            {{ pos.icon }}
          </button>
        </div>
        <p class="wm-position-name">{{ currentPositionLabel }}</p>
      </div>
    </div>

    <!-- Preview ảnh (chỉ hiện khi dùng image store) -->
    <div v-if="!isVideo && store.previewUrls?.length > 0" class="wm-preview-section">
      <div class="wm-preview-header">
        <p class="wm-preview-title">👁 Preview ảnh với Logo:</p>
        <div class="wm-preview-nav">
          <button class="wm-nav-btn" :disabled="imgIndex === 0" @click="imgIndex--">‹</button>
          <span class="wm-nav-counter">{{ imgIndex + 1 }} / {{ store.selectedFiles.length }}</span>
          <button class="wm-nav-btn" :disabled="imgIndex === store.selectedFiles.length - 1" @click="imgIndex++">›</button>
        </div>
      </div>
      <p class="wm-preview-filename">{{ store.selectedFiles[imgIndex]?.name }}</p>
      <canvas ref="canvasRef" class="wm-canvas"></canvas>
    </div>

    <!-- Preview video (chỉ hiện khi dùng video store) -->
    <div v-if="isVideo && store.selectedFile" class="wm-preview-section">
      <p class="wm-preview-title">👁 Preview video với Logo:</p>

      <video
        ref="videoEl"
        :src="store.previewUrl"
        preload="auto"
        crossorigin="anonymous"
        style="position: absolute; visibility: hidden; width: 1px; height: 1px;"
        @canplay="onVideoReady"
      ></video>

      <!-- Canvas vẽ frame + logo, controls nằm bên dưới -->
      <div class="vc-wrap">
        <canvas ref="canvasRef" class="vc-canvas"></canvas>

        <div v-if="videoReady" class="vc-controls">
          <button class="vc-btn" @click="togglePlay">
            {{ isPlaying ? '⏸' : '▶' }}
          </button>

          <input
            class="vc-seek"
            type="range"
            min="0"
            :max="duration"
            step="0.01"
            :value="currentTime"
            @input="onSeek"
          />

          <span class="vc-time">{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>

          <button class="vc-btn" @click="toggleMute">
            {{ isMuted ? '🔇' : '🔊' }}
          </button>
          <input
            class="vc-volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="isMuted ? 0 : volume"
            @input="onVolume"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  store: { type: Object, required: true },
})
const store = props.store

const isVideo = computed(() => {
  return 'selectedFile' in store && !('selectedFiles' in store)
})

// ─── Reactive state ───────────────────────────────────────────────────────────
const fileInput  = ref(null)
const canvasRef  = ref(null)
const videoEl    = ref(null)
const isDragging = ref(false)
const imgIndex   = ref(0)

// Trạng thái video player
const videoReady  = ref(false)
const isPlaying   = ref(false)
const isMuted     = ref(false)
const volume      = ref(1)
const currentTime = ref(0)
const duration    = ref(0)

// Cache watermark image để RAF loop không phải load lại mỗi frame
let rafId         = null
let cachedWmImage = null
let cachedWmSrc   = ''

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const POSITIONS = [
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

const currentPositionLabel = computed(() => {
  const found = POSITIONS.find(p => p.value === store.watermarkPosition)
  return found ? found.label : ''
})

// ─── Upload logo ──────────────────────────────────────────────────────────────
function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) store.setWatermark(file)
  event.target.value = ''
}

function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer.files?.[0]
  if (file) store.setWatermark(file)
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const secs    = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${minutes}:${secs}`
}

const fmt = formatTime

function getLogoXY(position, canvasW, canvasH, logoW, logoH, padding) {
  const centerX = Math.round((canvasW - logoW) / 2)
  const centerY = Math.round((canvasH - logoH) / 2)

  const positionMap = {
    'top-left':      { x: padding,                   y: padding },
    'top-center':    { x: centerX,                   y: padding },
    'top-right':     { x: canvasW - logoW - padding, y: padding },
    'center-left':   { x: padding,                   y: centerY },
    'center':        { x: centerX,                   y: centerY },
    'center-right':  { x: canvasW - logoW - padding, y: centerY },
    'bottom-left':   { x: padding,                   y: canvasH - logoH - padding },
    'bottom-center': { x: centerX,                   y: canvasH - logoH - padding },
    'bottom-right':  { x: canvasW - logoW - padding, y: canvasH - logoH - padding },
  }

  const result = positionMap[position] || positionMap['bottom-left']
  return {
    x: Math.max(0, result.x),
    y: Math.max(0, result.y),
  }
}

function loadWatermarkImage() {
  return new Promise((resolve) => {
    const src = store.watermarkUrl || '/watermark.png'

    if (cachedWmSrc === src && cachedWmImage) {
      return resolve(cachedWmImage)
    }

    const img       = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      cachedWmImage = img
      cachedWmSrc   = src
      resolve(img)
    }

    img.onerror = () => {
      cachedWmImage = null
      cachedWmSrc   = src
      resolve(null)
    }

    img.src = src
  })
}

// Vẽ source (ảnh hoặc frame video) + logo lên canvas
async function drawToCanvas(source, sourceWidth, sourceHeight) {
  const canvas = canvasRef.value
  if (!canvas || !sourceWidth || !sourceHeight) return

  // Thu nhỏ để hiển thị vừa khung, không upscale
  const MAX_DISPLAY_WIDTH = 700
  const scaleFactor = Math.min(1, MAX_DISPLAY_WIDTH / sourceWidth)
  const displayW    = Math.round(sourceWidth  * scaleFactor)
  const displayH    = Math.round(sourceHeight * scaleFactor)

  if (canvas.width  !== displayW) canvas.width  = displayW
  if (canvas.height !== displayH) canvas.height = displayH

  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, displayW, displayH)

  const logoImage = await loadWatermarkImage()
  if (!logoImage) return

  // Dùng cạnh lớn nhất để tính kích thước logo — đúng cho cả ảnh ngang lẫn dọc
  const maxDim  = Math.max(displayW, displayH)
  const logoW   = Math.round(maxDim * 0.22)
  const logoH   = Math.round(logoW * logoImage.naturalHeight / logoImage.naturalWidth)
  const padding = Math.round(maxDim * 0.02)

  const { x, y } = getLogoXY(store.watermarkPosition, displayW, displayH, logoW, logoH, padding)
  ctx.drawImage(logoImage, x, y, logoW, logoH)
}

// ─── Image preview ────────────────────────────────────────────────────────────
async function drawImagePreview() {
  await nextTick()

  const url = store.previewUrls?.[imgIndex.value]
  if (!url) return

  const img       = new Image()
  img.crossOrigin = 'anonymous'
  img.onload      = () => drawToCanvas(img, img.naturalWidth, img.naturalHeight)
  img.src         = url
}

// ─── Video preview — RAF loop ─────────────────────────────────────────────────
function stopRafLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function startRafLoop() {
  stopRafLoop()

  loadWatermarkImage().then(() => {
    function tick() {
      const video  = videoEl.value
      const canvas = canvasRef.value

      if (video && canvas && video.videoWidth > 0) {
        const MAX_DISPLAY_WIDTH = 700
        const scaleFactor = Math.min(1, MAX_DISPLAY_WIDTH / video.videoWidth)
        const displayW    = Math.round(video.videoWidth  * scaleFactor)
        const displayH    = Math.round(video.videoHeight * scaleFactor)

        if (canvas.width  !== displayW) canvas.width  = displayW
        if (canvas.height !== displayH) canvas.height = displayH

        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, displayW, displayH)

        // Dùng cạnh lớn nhất để tính kích thước logo — đúng cho cả video ngang lẫn dọc
        if (cachedWmImage) {
          const maxDim  = Math.max(displayW, displayH)
          const logoW   = Math.round(maxDim * 0.22)
          const logoH   = Math.round(logoW * cachedWmImage.naturalHeight / cachedWmImage.naturalWidth)
          const padding = Math.round(maxDim * 0.02)
          const { x, y } = getLogoXY(store.watermarkPosition, displayW, displayH, logoW, logoH, padding)
          ctx.drawImage(cachedWmImage, x, y, logoW, logoH)
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
  })
}

// ─── Gắn event listeners cho video element ───────────────────────────────────
function bindVideoEvents() {
  const video = videoEl.value
  if (!video) return

  video.addEventListener('timeupdate',     () => { currentTime.value = video.currentTime })
  video.addEventListener('durationchange', () => { duration.value    = video.duration })
  video.addEventListener('play',           () => { isPlaying.value   = true })
  video.addEventListener('pause',          () => { isPlaying.value   = false })
  video.addEventListener('ended',          () => { isPlaying.value   = false })
  video.addEventListener('volumechange',   () => {
    volume.value  = video.volume
    isMuted.value = video.muted
  })
}

function onVideoReady() {
  const video = videoEl.value
  if (!video) return

  videoReady.value = true
  duration.value   = video.duration || 0
  volume.value     = video.volume
  isMuted.value    = video.muted

  startRafLoop()
}

// ─── Video controls ───────────────────────────────────────────────────────────
function togglePlay() {
  const video = videoEl.value
  if (!video) return
  if (video.paused) { video.play() } else { video.pause() }
}

function toggleMute() {
  const video = videoEl.value
  if (!video) return
  video.muted = !video.muted
}

function onSeek(event) {
  const video = videoEl.value
  if (!video) return
  video.currentTime = Number(event.target.value)
}

function onVolume(event) {
  const video = videoEl.value
  if (!video) return
  video.volume = Number(event.target.value)
  video.muted  = video.volume === 0
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(() => store.previewUrls?.length, (newLength) => {
  if (!isVideo.value && newLength > 0) drawImagePreview()
})

watch(() => store.watermarkUrl, () => {
  cachedWmImage = null
  cachedWmSrc   = ''
  if (!isVideo.value) {
    drawImagePreview()
  } else {
    loadWatermarkImage()
  }
})

watch(() => store.watermarkPosition, () => {
  if (!isVideo.value) drawImagePreview()
})

watch(imgIndex, () => {
  if (!isVideo.value) drawImagePreview()
})

watch(() => store.selectedFiles?.length, (newLength) => {
  if (newLength !== undefined && imgIndex.value >= newLength) {
    imgIndex.value = Math.max(0, newLength - 1)
  }
})

watch(() => store.previewUrl, async () => {
  if (!isVideo.value) return

  stopRafLoop()
  videoReady.value  = false
  isPlaying.value   = false
  currentTime.value = 0
  duration.value    = 0

  await nextTick()
  bindVideoEvents()
})

onUnmounted(() => stopRafLoop())
</script>

<style scoped>
/* ── Section wrapper ── */
.wm-section {
  margin-top: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
}

/* ── Header ── */
.wm-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.wm-header h3 {
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}
.wm-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
}
.wm-badge--default { background: #f1f5f9; color: #64748b; }
.wm-badge--custom  { background: #dbeafe; color: #2563eb; }

/* ── Controls row (drop zone + vị trí) ── */
.wm-controls-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.wm-body {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ── Drop zone upload logo ── */
.wm-drop {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}
.wm-drop:hover      { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--drag      { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--has       { border-style: solid; border-color: #3b82f6; }
.wm-drop__icon      { font-size: 24px; margin-bottom: 4px; }
.wm-drop__text      { font-size: 12px; color: #475569; margin: 0 0 3px; }
.wm-drop__link      { color: #3b82f6; font-weight: 600; }
.wm-drop__hint      { font-size: 11px; color: #94a3b8; margin: 0; }
.wm-drop__preview   { max-height: 52px; max-width: 100px; object-fit: contain; margin-bottom: 4px; }
.wm-drop__name      { font-size: 11px; color: #64748b; margin: 0; }

.wm-clear {
  margin-top: 6px;
  width: 100%;
  background: transparent;
  border: 1px solid #fca5a5;
  color: #ef4444;
  border-radius: 6px;
  padding: 5px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.wm-clear:hover { background: #fef2f2; }

/* ── Grid chọn vị trí 3x3 ── */
.wm-position-section {
  flex: 1;
  min-width: 0;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wm-position-label {
  font-size: 12px;
  color: #475569;
  margin: 0 0 8px;
  align-self: flex-start;
}
.wm-position-grid {
  display: grid;
  grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px);
  gap: 3px;
}
.wm-pos-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
  color: #64748b;
}
.wm-pos-btn:hover   { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
.wm-pos-btn--active { background: #3b82f6; border-color: #3b82f6; color: white; }
.wm-position-name {
  margin: 6px 0 0;
  font-size: 11px;
  color: #3b82f6;
  font-weight: 600;
}

/* ── Preview section (dùng chung cho ảnh và video) ── */
.wm-preview-section { margin-top: 16px; }
.wm-preview-title {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 8px;
}

/* Header của image preview */
.wm-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.wm-preview-filename {
  font-size: 11px;
  color: #94a3b8;
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Nút điều hướng ảnh ‹ / › */
.wm-preview-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wm-nav-btn {
  background: #e2e8f0;
  border: none;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Canvas hiển thị preview ảnh */
.wm-canvas {
  max-width: 100%;
  border-radius: 6px;
  margin: 0 auto;
  border: 1px solid #e2e8f0;
  display: block;
}

/* ── Video canvas + thanh controls ── */
.vc-wrap {
  background: #cbd5e1;
  border-radius: 10px;
  overflow: hidden;
}
.vc-canvas {
  max-height: 480px;
  margin: 12px auto 5px;
  border-radius: 5px;
  display: block;
  object-fit: contain;
}
.vc-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
.vc-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  flex-shrink: 0;
}
.vc-seek {
  flex: 1;
  height: 4px;
  accent-color: #3b82f6;
  cursor: pointer;
}
.vc-time {
  font-size: 11px;
  color: #cbd5e1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.vc-volume {
  width: 60px;
  height: 4px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
}
</style>