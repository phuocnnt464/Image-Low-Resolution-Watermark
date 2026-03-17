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
      <p class="wm-preview-title">👁 Preview video với Logo:</p>

      <!--
        Video ẩn: browser decode frame liên tục nhờ visibility:hidden
        Canvas bên dưới sẽ render lại mỗi frame từ video này
      -->
      <video
        ref="hiddenVideoRef"
        :src="store.previewUrl"
        preload="auto"
        style="position:absolute; visibility:hidden; width:1px; height:1px; pointer-events:none;"
        @canplay="onVideoCanPlay"
        crossorigin="anonymous"
      ></video>

      <!-- Canvas có controls tự làm (play/pause/seek/volume) -->
      <div class="vc-wrap">
        <canvas ref="canvasRef" class="wm-canvas vc-canvas"></canvas>

        <!-- Controls bar -->
        <div class="vc-controls" v-if="videoReady">
          <!-- Play/Pause -->
          <button class="vc-btn" @click="togglePlay">
            {{ isPlaying ? '⏸' : '▶' }}
          </button>

          <!-- Seekbar -->
          <input
            class="vc-seek"
            type="range"
            min="0"
            :max="duration"
            step="0.01"
            :value="currentTime"
            @input="onSeek"
          />

          <!-- Time -->
          <span class="vc-time">{{ fmtTime(currentTime) }} / {{ fmtTime(duration) }}</span>

          <!-- Volume -->
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

const props = defineProps({
  store:    { type: Object, required: true },
  videoRef: { type: Object, default: null },
})
const store = props.store

const isVideo = computed(() => 'selectedFile' in store && !('selectedFiles' in store))

const inputRef       = ref(null)
const canvasRef      = ref(null)
const hiddenVideoRef = ref(null)
const isDragging     = ref(false)
const currentIndex   = ref(0)

// Video player state
const videoReady  = ref(false)
const isPlaying   = ref(false)
const isMuted     = ref(false)
const volume      = ref(1)
const currentTime = ref(0)
const duration    = ref(0)

// RAF loop handle
let rafId = null
// watermark image cache
let wmImg = null
let wmImgSrc = ''

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

// ── File handlers ─────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtTime = (s) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload  = () => resolve(img)
  img.onerror = reject
  img.src = src
})

const getWmImg = async () => {
  const src = store.watermarkUrl || '/assets/watermark.png'
  if (wmImgSrc === src && wmImg) return wmImg
  try {
    wmImg = await loadImage(src)
    wmImgSrc = src
  } catch { wmImg = null }
  return wmImg
}

const calcWmPosition = (position, cW, cH, wmW, wmH, padding) => {
  const cx = Math.round((cW - wmW) / 2)
  const cy = Math.round((cH - wmH) / 2)
  const map = {
    'top-left':      { left: padding,          top: padding },
    'top-center':    { left: cx,               top: padding },
    'top-right':     { left: cW - wmW - padding, top: padding },
    'center-left':   { left: padding,          top: cy },
    'center':        { left: cx,               top: cy },
    'center-right':  { left: cW - wmW - padding, top: cy },
    'bottom-left':   { left: padding,          top: cH - wmH - padding },
    'bottom-center': { left: cx,               top: cH - wmH - padding },
    'bottom-right':  { left: cW - wmW - padding, top: cH - wmH - padding },
  }
  const p = map[position] || map['bottom-left']
  return { left: Math.max(0, p.left), top: Math.max(0, p.top) }
}

// ── IMAGE preview ─────────────────────────────────────────────────────────
const drawImagePreview = async () => {
  await nextTick()
  const imgUrl = store.previewUrls?.[currentIndex.value]
  if (!imgUrl) return
  const canvas = canvasRef.value
  if (!canvas) return
  try {
    const img   = await loadImage(imgUrl)
    const maxW  = 700
    const scale = Math.min(1, maxW / img.naturalWidth)
    const dispW = Math.round(img.naturalWidth  * scale)
    const dispH = Math.round(img.naturalHeight * scale)
    canvas.width  = dispW
    canvas.height = dispH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, dispW, dispH)
    const wm = await getWmImg()
    if (wm) {
      const wmMaxW  = Math.round(dispW * 0.15)
      const wmScale = wmMaxW / wm.naturalWidth
      const wmW     = Math.round(wm.naturalWidth  * wmScale)
      const wmH     = Math.round(wm.naturalHeight * wmScale)
      const pad     = Math.max(8, Math.round(15 * scale))
      const { left, top } = calcWmPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, pad)
      ctx.drawImage(wm, left, top, wmW, wmH)
    }
  } catch (err) { console.error('drawImagePreview:', err) }
}

// ── VIDEO render loop ─────────────────────────────────────────────────────
const stopRaf = () => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

const drawVideoFrame = async () => {
  const video  = hiddenVideoRef.value
  const canvas = canvasRef.value
  if (!video || !canvas || !video.videoWidth) return

  const maxW  = 700
  const scale = Math.min(1, maxW / video.videoWidth)
  const dispW = Math.round(video.videoWidth  * scale)
  const dispH = Math.round(video.videoHeight * scale)

  if (canvas.width !== dispW)  canvas.width  = dispW
  if (canvas.height !== dispH) canvas.height = dispH

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, dispW, dispH)

  const wm = await getWmImg()
  if (wm) {
    const wmMaxW  = Math.round(dispW * 0.15)
    const wmScale = wmMaxW / wm.naturalWidth
    const wmW     = Math.round(wm.naturalWidth  * wmScale)
    const wmH     = Math.round(wm.naturalHeight * wmScale)
    const pad     = Math.max(8, Math.round(15 * scale))
    const { left, top } = calcWmPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, pad)
    ctx.drawImage(wm, left, top, wmW, wmH)
  }
}

const startRafLoop = () => {
  stopRaf()
  const loop = async () => {
    await drawVideoFrame()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

// ── Video event handlers ──────────────────────────────────────────────────
const onVideoCanPlay = () => {
  const video = hiddenVideoRef.value
  if (!video) return
  videoReady.value  = true
  duration.value    = video.duration || 0
  volume.value      = video.volume
  isMuted.value     = video.muted
  startRafLoop()
}

// Sync time display
const setupVideoEvents = () => {
  const video = hiddenVideoRef.value
  if (!video) return
  video.addEventListener('timeupdate', () => { currentTime.value = video.currentTime })
  video.addEventListener('durationchange', () => { duration.value = video.duration })
  video.addEventListener('play',  () => { isPlaying.value = true  })
  video.addEventListener('pause', () => { isPlaying.value = false })
  video.addEventListener('ended', () => { isPlaying.value = false })
  video.addEventListener('volumechange', () => {
    volume.value  = video.volume
    isMuted.value = video.muted
  })
}

// ── Controls ──────────────────────────────────────────────────────────────
const togglePlay = () => {
  const video = hiddenVideoRef.value
  if (!video) return
  video.paused ? video.play() : video.pause()
}

const onSeek = (e) => {
  const video = hiddenVideoRef.value
  if (!video) return
  video.currentTime = parseFloat(e.target.value)
}

const toggleMute = () => {
  const video = hiddenVideoRef.value
  if (!video) return
  video.muted = !video.muted
}

const onVolume = (e) => {
  const video = hiddenVideoRef.value
  if (!video) return
  video.volume = parseFloat(e.target.value)
  video.muted  = video.volume === 0
}

// ── Watches ───────────────────────────────────────────────────────────────
watch(() => store.previewUrls?.length, (len) => {
  if (!isVideo.value && len > 0) drawImagePreview()
})

watch(() => store.watermarkUrl, async () => {
  wmImg = null; wmImgSrc = ''   // invalidate cache
  if (!isVideo.value && store.previewUrls?.[currentIndex.value]) drawImagePreview()
  // video loop tự re-draw frame tiếp theo với wm mới
})

watch(() => store.watermarkPosition, () => {
  if (!isVideo.value && store.previewUrls?.[currentIndex.value]) drawImagePreview()
  // video loop tự re-draw
})

watch(currentIndex, () => {
  if (!isVideo.value && store.previewUrls?.[currentIndex.value]) drawImagePreview()
})

watch(() => store.selectedFiles?.length, (len) => {
  if (len !== undefined && currentIndex.value >= len)
    currentIndex.value = Math.max(0, len - 1)
})

// Reset khi video mới
watch(() => store.previewUrl, async (url) => {
  if (!isVideo.value) return
  stopRaf()
  videoReady.value  = false
  isPlaying.value   = false
  currentTime.value = 0
  duration.value    = 0
  await nextTick()
  setupVideoEvents()
  // @canplay sẽ tự fire khi video sẵn sàng
})

onUnmounted(() => stopRaf())
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
.wm-preview-section { margin-top: 16px; }
.wm-preview-title { font-size: 12px; color: #64748b; margin: 0 0 8px; }

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
.wm-preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.wm-preview-filename {
  font-size: 11px; color: #94a3b8; margin: 0 0 8px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wm-canvas {
  max-width: 50%; border-radius: 6px; margin: 0 auto;
  border: 1px solid #e2e8f0; display: block;
}

/* Video canvas wrapper + custom controls */
.vc-wrap {
  position: relative;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}
.vc-canvas {
  width: 100%;
  border: none;
  border-radius: 0;
  display: block;
}
.vc-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
}
.vc-btn {
  background: none; border: none; color: #ffffff; cursor: pointer;
  font-size: 16px; padding: 0 2px; line-height: 1;
  flex-shrink: 0;
}
.vc-seek {
  flex: 1;
  height: 4px;
  accent-color: #ffffff;
  cursor: pointer;
}
.vc-time {
  font-size: 11px;
  color: #cbd5e1;
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.vc-volume {
  width: 60px;
  height: 4px;
  accent-color: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
}
</style>