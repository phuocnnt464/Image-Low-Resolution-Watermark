<template>
  <div class="wm-section">

    <!-- Header -->
    <div class="wm-header">
      <h3>Logo Optional</h3>
      <span class="wm-badge" :class="store.watermarkFile ? 'wm-badge--custom' : 'wm-badge--default'">
        {{ store.watermarkFile ? 'Tùy chỉnh' : 'Mặc định' }}
      </span>
    </div>

    <!-- Logo upload + vị trí -->
    <div class="wm-controls-row">

      <!-- Drop zone logo -->
      <div class="wm-body">
        <div
          class="wm-drop"
          :class="{ 'wm-drop--drag': isDragging, 'wm-drop--has': !!store.watermarkFile }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" style="display:none" @change="onFileChange" />

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

      <!-- Grid chọn vị trí -->
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
          >{{ pos.icon }}</button>
        </div>
        <p class="wm-position-name">{{ currentPositionLabel }}</p>
      </div>
    </div>

    <!-- Preview ảnh -->
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

    <!-- Preview video -->
    <div v-if="isVideo && store.selectedFile" class="wm-preview-section">
      <p class="wm-preview-title">👁 Preview video với Logo:</p>

      <!-- Video ẩn để decode frame (visibility:hidden thay vì display:none — browser mới decode được) -->
      <video
        ref="videoEl"
        :src="store.previewUrl"
        preload="auto"
        style="position:absolute; visibility:hidden; width:1px; height:1px;"
        @canplay="onVideoReady"
        crossorigin="anonymous"
      ></video>

      <!-- Canvas hiển thị frame + logo, có thanh controls bên dưới -->
      <div class="vc-wrap">
        <canvas ref="canvasRef" class="vc-canvas"></canvas>

        <div v-if="videoReady" class="vc-controls">
          <button class="vc-btn" @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</button>

          <input class="vc-seek" type="range" min="0" :max="duration" step="0.01"
            :value="currentTime" @input="onSeek" />

          <span class="vc-time">{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>

          <button class="vc-btn" @click="toggleMute">{{ isMuted ? '🔇' : '🔊' }}</button>
          <input class="vc-volume" type="range" min="0" max="1" step="0.01"
            :value="isMuted ? 0 : volume" @input="onVolume" />
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

// Phân biệt image store hay video store
const isVideo = computed(() => 'selectedFile' in store && !('selectedFiles' in store))

// ─── State ────────────────────────────────────────────────────────────────────
const fileInput  = ref(null)
const canvasRef  = ref(null)
const videoEl    = ref(null)
const isDragging = ref(false)
const imgIndex   = ref(0)

// Video player state
const videoReady  = ref(false)
const isPlaying   = ref(false)
const isMuted     = ref(false)
const volume      = ref(1)
const currentTime = ref(0)
const duration    = ref(0)

// RAF loop & watermark image cache
let rafId  = null
let wmImg  = null   // HTMLImageElement đã load
let wmSrc  = ''     // src đã load để tránh reload lại

// ─── Constants ────────────────────────────────────────────────────────────────
const POSITIONS = [
  { value: 'top-left',      label: 'Trên trái',   icon: '↖' },
  { value: 'top-center',    label: 'Trên giữa',   icon: '↑' },
  { value: 'top-right',     label: 'Trên phải',   icon: '↗' },
  { value: 'center-left',   label: 'Giữa trái',   icon: '←' },
  { value: 'center',        label: 'Giữa',         icon: '⊙' },
  { value: 'center-right',  label: 'Giữa phải',   icon: '→' },
  { value: 'bottom-left',   label: 'Dưới trái',   icon: '↙' },
  { value: 'bottom-center', label: 'Dưới giữa',   icon: '↓' },
  { value: 'bottom-right',  label: 'Dưới phải',   icon: '↘' },
]

const currentPositionLabel = computed(
  () => POSITIONS.find(p => p.value === store.watermarkPosition)?.label ?? ''
)

// ─── Logo upload ──────────────────────────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────────────────────
// Format giây → "1:23"
const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Tính toạ độ vẽ logo dựa vào vị trí đã chọn
const getLogoPosition = (pos, cW, cH, wmW, wmH, pad) => {
  const cx = Math.round((cW - wmW) / 2)
  const cy = Math.round((cH - wmH) / 2)
  const map = {
    'top-left':      [pad,            pad],
    'top-center':    [cx,             pad],
    'top-right':     [cW - wmW - pad, pad],
    'center-left':   [pad,            cy],
    'center':        [cx,             cy],
    'center-right':  [cW - wmW - pad, cy],
    'bottom-left':   [pad,            cH - wmH - pad],
    'bottom-center': [cx,             cH - wmH - pad],
    'bottom-right':  [cW - wmW - pad, cH - wmH - pad],
  }
  const [x, y] = map[pos] || map['bottom-left']
  return { x: Math.max(0, x), y: Math.max(0, y) }
}

// Load watermark image, dùng cache để không load lại mỗi frame
const getWmImg = () => new Promise((resolve) => {
  const src = store.watermarkUrl || '/assets/watermark.png'
  if (wmSrc === src && wmImg) return resolve(wmImg)   // đã cache
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload  = () => { wmImg = img; wmSrc = src; resolve(img) }
  img.onerror = () => { wmImg = null; wmSrc = ''; resolve(null) }
  img.src = src
})

// Vẽ source (HTMLImageElement hoặc HTMLVideoElement) + logo lên canvas
const drawToCanvas = async (source, sourceW, sourceH) => {
  const canvas = canvasRef.value
  if (!canvas || !sourceW || !sourceH) return

  const MAX_WIDTH = 700
  const scale = Math.min(1, MAX_WIDTH / sourceW)
  const dispW = Math.round(sourceW * scale)
  const dispH = Math.round(sourceH * scale)

  if (canvas.width !== dispW)  canvas.width  = dispW
  if (canvas.height !== dispH) canvas.height = dispH

  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, dispW, dispH)

  const wm = await getWmImg()
  if (!wm) return

  const wmW = Math.round(dispW * 0.20)              // logo = 20% chiều rộng
  const wmH = Math.round(wmW / wm.naturalWidth * wm.naturalHeight)
  const pad = Math.max(8, Math.round(15 * scale))
  const { x, y } = getLogoPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, pad)
  ctx.drawImage(wm, x, y, wmW, wmH)
}

// ─── Image preview ────────────────────────────────────────────────────────────
const drawImagePreview = async () => {
  await nextTick()
  const url = store.previewUrls?.[imgIndex.value]
  if (!url) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => drawToCanvas(img, img.naturalWidth, img.naturalHeight)
  img.src = url
}

// ─── Video preview (RAF loop) ─────────────────────────────────────────────────
const stopLoop = () => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

// Loop chạy sync (không async) để không bỏ lỡ frame
const startLoop = () => {
  stopLoop()
  // Preload watermark image trước khi loop bắt đầu
  getWmImg().then(() => {
    const tick = () => {
      const video  = videoEl.value
      const canvas = canvasRef.value
      if (video && canvas && video.videoWidth) {
        const MAX_WIDTH = 700
        const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
        const dispW = Math.round(video.videoWidth  * scale)
        const dispH = Math.round(video.videoHeight * scale)

        if (canvas.width  !== dispW) canvas.width  = dispW
        if (canvas.height !== dispH) canvas.height = dispH

        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, dispW, dispH)

        // Vẽ logo từ cache (sync, không await)
        if (wmImg) {
          const wmW = Math.round(dispW * 0.12)
          const wmH = Math.round(wmW / wmImg.naturalWidth * wmImg.naturalHeight)
          const pad = Math.max(8, Math.round(15 * scale))
          const { x, y } = getLogoPosition(store.watermarkPosition, dispW, dispH, wmW, wmH, pad)
          ctx.drawImage(wmImg, x, y, wmW, wmH)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })
}

// ─── Video events ─────────────────────────────────────────────────────────────
const bindVideoEvents = () => {
  const v = videoEl.value
  if (!v) return
  v.addEventListener('timeupdate',    () => { currentTime.value = v.currentTime })
  v.addEventListener('durationchange',() => { duration.value    = v.duration })
  v.addEventListener('play',          () => { isPlaying.value   = true  })
  v.addEventListener('pause',         () => { isPlaying.value   = false })
  v.addEventListener('ended',         () => { isPlaying.value   = false })
  v.addEventListener('volumechange',  () => { volume.value = v.volume; isMuted.value = v.muted })
}

const onVideoReady = () => {
  const v = videoEl.value
  if (!v) return
  videoReady.value = true
  duration.value   = v.duration || 0
  volume.value     = v.volume
  isMuted.value    = v.muted
  startLoop()
}

// ─── Video controls ───────────────────────────────────────────────────────────
const togglePlay  = () => { const v = videoEl.value; if (!v) return; v.paused ? v.play() : v.pause() }
const toggleMute  = () => { const v = videoEl.value; if (!v) return; v.muted = !v.muted }
const onSeek      = (e) => { const v = videoEl.value; if (!v) return; v.currentTime = +e.target.value }
const onVolume    = (e) => {
  const v = videoEl.value
  if (!v) return
  v.volume = +e.target.value
  v.muted  = v.volume === 0
}

// ─── Watchers ─────────────────────────────────────────────────────────────────
// Ảnh: vẽ lại khi danh sách ảnh thay đổi
watch(() => store.previewUrls?.length, (len) => {
  if (!isVideo.value && len > 0) drawImagePreview()
})

// Cả hai: vẽ lại khi đổi logo hoặc đổi vị trí
watch(() => store.watermarkUrl, () => {
  wmImg = null; wmSrc = ''    // xoá cache để load logo mới
  if (!isVideo.value) drawImagePreview()
})
watch(() => store.watermarkPosition, () => {
  if (!isVideo.value) drawImagePreview()
  // video: loop tự re-draw frame tiếp theo
})

// Ảnh: vẽ lại khi chuyển trang
watch(imgIndex, () => {
  if (!isVideo.value) drawImagePreview()
})

// Ảnh: giữ imgIndex trong giới hạn khi bớt ảnh
watch(() => store.selectedFiles?.length, (len) => {
  if (len !== undefined && imgIndex.value >= len)
    imgIndex.value = Math.max(0, len - 1)
})

// Video: reset khi chọn video mới
watch(() => store.previewUrl, async () => {
  if (!isVideo.value) return
  stopLoop()
  videoReady.value  = false
  isPlaying.value   = false
  currentTime.value = 0
  duration.value    = 0
  await nextTick()
  bindVideoEvents()
  // @canplay sẽ tự gọi onVideoReady khi video sẵn sàng
})

onUnmounted(() => stopLoop())
</script>

<style scoped>
/* ── Layout section ── */
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

/* ── Controls row ── */
.wm-controls-row { display: flex; gap: 12px; align-items: flex-start; }
.wm-body { flex: 2; min-width: 0; display: flex; flex-direction: column; }

/* ── Drop zone ── */
.wm-drop {
  border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px 12px;
  text-align: center; cursor: pointer; transition: all 0.2s; background: white;
  min-height: 120px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; flex: 1;
}
.wm-drop:hover,
.wm-drop--drag  { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--has   { border-style: solid; border-color: #3b82f6; }
.wm-drop__icon    { font-size: 24px; margin-bottom: 4px; }
.wm-drop__text    { font-size: 12px; color: #475569; margin: 0 0 3px; }
.wm-drop__link    { color: #3b82f6; font-weight: 600; }
.wm-drop__hint    { font-size: 11px; color: #94a3b8; margin: 0; }
.wm-drop__preview { max-height: 52px; max-width: 100px; object-fit: contain; margin-bottom: 4px; }
.wm-drop__name    { font-size: 11px; color: #64748b; margin: 0; }

.wm-clear {
  margin-top: 6px; width: 100%; background: transparent;
  border: 1px solid #fca5a5; color: #ef4444; border-radius: 6px;
  padding: 5px; font-size: 12px; cursor: pointer; transition: background 0.2s;
}
.wm-clear:hover { background: #fef2f2; }

/* ── Position grid ── */
.wm-position-section {
  flex: 1; min-width: 0; padding: 12px; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center;
}
.wm-position-label { font-size: 12px; color: #475569; margin: 0 0 8px; align-self: flex-start; }
.wm-position-grid {
  display: grid; grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px); gap: 3px;
}
.wm-pos-btn {
  width: 28px; height: 28px; border: 1px solid #cbd5e1; border-radius: 5px;
  background: white; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; padding: 0; color: #64748b;
}
.wm-pos-btn:hover          { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
.wm-pos-btn--active        { background: #3b82f6; border-color: #3b82f6; color: white; }
.wm-position-name { margin: 6px 0 0; font-size: 11px; color: #3b82f6; font-weight: 600; }

/* ── Preview chung ── */
.wm-preview-section { margin-top: 16px; }
.wm-preview-title   { font-size: 12px; color: #64748b; margin: 0 0 8px; }
.wm-preview-header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.wm-preview-filename {
  font-size: 11px; color: #94a3b8; margin: 0 0 8px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wm-preview-nav { display: flex; align-items: center; gap: 6px; }
.wm-nav-btn {
  background: #e2e8f0; border: none; border-radius: 50%; width: 26px; height: 26px;
  font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #475569; padding: 0; transition: background 0.15s;
}
.wm-nav-btn:hover:not(:disabled) { background: #3b82f6; color: white; }
.wm-nav-btn:disabled { opacity: 0.3; cursor: default; }
.wm-nav-counter { font-size: 12px; color: #64748b; font-weight: 600; min-width: 36px; text-align: center; }

/* Canvas ảnh */
.wm-canvas {
  max-width: 50%; border-radius: 6px; margin: 0 auto;
  border: 1px solid #e2e8f0; display: block;
}

/* ── Video canvas + controls ── */
.vc-wrap   { background: #fff; border-radius: 10px; overflow: hidden;  }
.vc-canvas { width: 50%; border-radius: 15px; padding: 6px; margin: 0 auto; display: block; }
.vc-controls {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
}
.vc-btn {
  background: none; border: none; color: white; cursor: pointer;
  font-size: 16px; padding: 0 2px; flex-shrink: 0;
}
.vc-seek   { flex: 1; height: 4px; accent-color: #3b82f6; cursor: pointer; }
.vc-time   { font-size: 11px; color: #cbd5e1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vc-volume { width: 60px; height: 4px; accent-color: #3b82f6; cursor: pointer; flex-shrink: 0; }
</style>