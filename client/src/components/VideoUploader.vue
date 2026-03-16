<template>
  <div class="video-section">

    <!-- ── Drop zone (khi chưa chọn video) ── -->
    <div
      v-if="!store.selectedFile"
      class="uploader"
      :class="{ 'uploader--drag': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInput.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept="video/*"
        style="display:none"
        @change="onFileChange"
      />
      <div class="uploader__icon">🎬</div>
      <p class="uploader__text">Kéo thả video vào đây hoặc <span class="uploader__link">chọn file</span></p>
      <p class="uploader__hint">MP4, MOV, AVI, MKV, WEBM — tối đa 2 GB</p>
    </div>

    <!-- ── Sau khi đã chọn video ── -->
    <div v-else class="video-preview">

      <!-- Video player — gọi .load() qua ref khi src thay đổi -->
      <div class="vp-wrap">
        <video
          ref="videoRef"
          :src="store.previewUrl"
          controls
          preload="metadata"
          class="vp-player"
        ></video>
        <button class="vp-remove" @click="store.clearVideo" title="Xóa video">✕</button>
      </div>
      <p class="vp-filename">
        📁 {{ store.selectedFile.name }}
        <span class="vp-filesize">({{ formatSize(store.selectedFile.size) }})</span>
      </p>

      <!-- ── Logo + Vị trí (giống hệt WatermarkUploader) ── -->
      <div class="wm-section">
        <div class="wm-header">
          <h3>Logo Optional</h3>
          <span class="wm-badge" :class="store.watermarkFile ? 'wm-badge--custom' : 'wm-badge--default'">
            {{ store.watermarkFile ? 'Tùy chỉnh' : 'Mặc định' }}
          </span>
        </div>

        <div class="wm-controls-row">
          <!-- 2/3: logo drop zone -->
          <div class="wm-body">
            <div
              class="wm-drop"
              :class="{ 'wm-drop--drag': isWmDragging, 'wm-drop--has': !!store.watermarkFile }"
              @dragover.prevent="isWmDragging = true"
              @dragleave.prevent="isWmDragging = false"
              @drop.prevent="onWmDrop"
              @click="wmInput.click()"
            >
              <input ref="wmInput" type="file" accept="image/jpeg,image/png,image/webp" style="display:none" @change="onWmChange" />
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

          <!-- 1/3: vị trí 3×3 icon grid -->
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
      </div>

      <!-- ── Bitrate preset ── -->
      <div class="resolution-control">
        <div class="resolution-control__header">
          <span class="resolution-control__title">📡 Preset Bitrate</span>
          <span class="resolution-control__selected">
            {{ selectedPreset.label }}
            <em>— {{ selectedPreset.desc }}</em>
          </span>
        </div>
        <div class="resolution-grid">
          <button
            v-for="preset in bitratePresets"
            :key="preset.value"
            class="res-btn"
            :class="{
              'res-btn--active': store.bitratePreset === preset.value,
              [`res-btn--tier-${preset.tier}`]: true,
            }"
            :title="preset.desc"
            @click="store.bitratePreset = preset.value"
          >
            <span class="res-btn__name">{{ preset.value }}</span>
            <span class="res-btn__sub">{{ preset.sub }}</span>
          </button>
        </div>
      </div>

      <!-- Error -->
      <p v-if="store.errorMessage" class="error">⚠️ {{ store.errorMessage }}</p>

      <!-- Download button -->
      <button
        class="btn btn--primary"
        :disabled="store.isProcessing"
        @click="store.processAndDownload"
      >
        <span v-if="store.isProcessing">⏳ Đang xử lý video...</span>
        <span v-else>⬇️ Xử lý & Tải xuống video</span>
      </button>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useVideoStore } from '../stores/videoStore'

const store      = useVideoStore()
const fileInput  = ref(null)
const wmInput    = ref(null)
const videoRef   = ref(null)   // ← ref trỏ vào <video>
const isDragging   = ref(false)
const isWmDragging = ref(false)

// ─��� Force browser reload video khi src thay đổi ───────────────────────────
// Cần thiết vì browser không tự reload khi src được gán lại bằng reactive
watch(
  () => store.previewUrl,
  async (url) => {
    if (!url) return
    await nextTick()          // chờ Vue update DOM
    videoRef.value?.load()    // báo browser load source mới
  }
)

// ── Bitrate presets ────────────────────────────────────────────────────────
const bitratePresets = [
  { value: 'Original', label: 'Gốc (Original)', sub: 'Giữ nguyên', desc: 'Không nén, giữ nguyên bitrate gốc',     tier: 'high' },
  { value: '4K',       label: '4K',             sub: '20 Mbps',    desc: '4K Ultra HD — chất lượng rất cao',       tier: 'high' },
  { value: '1080p',    label: '1080p',           sub: '8 Mbps',     desc: 'Full HD — tiêu chuẩn YouTube/streaming', tier: 'high' },
  { value: '720p',     label: '720p',            sub: '4 Mbps',     desc: 'HD — phổ biến, file vừa phải',           tier: 'mid'  },
  { value: '480p',     label: '480p',            sub: '2 Mbps',     desc: 'SD — nhẹ hơn, phù hợp mobile',          tier: 'mid'  },
  { value: '360p',     label: '360p',            sub: '1 Mbps',     desc: 'Low — rất nhẹ, chất lượng thấp',        tier: 'low'  },
  { value: '240p',     label: '240p',            sub: '500 Kbps',   desc: 'Very Low — tối thiểu, mạng chậm',       tier: 'low'  },
]

const selectedPreset = computed(
  () => bitratePresets.find(p => p.value === store.bitratePreset) ?? bitratePresets[3]
)

// ── Position grid ──────────────────────────────────────────────────────────
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

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Event handlers ─────────────────────────────────────────────────────────
const onFileChange = (e) => {
  const file = e.target.files[0]
  if (file) store.setVideo(file)
  e.target.value = ''
}

const onDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('video/')) store.setVideo(file)
}

const onWmChange = (e) => {
  const file = e.target.files[0]
  if (file) store.setWatermark(file)
  e.target.value = ''
}

const onWmDrop = (e) => {
  isWmDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) store.setWatermark(file)
}
</script>

<style scoped>
/* ── Drop zone ── */
.uploader {
  border: 2px dashed #94a3b8;
  border-radius: 12px;
  padding: 48px 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
}
.uploader:hover,
.uploader--drag {
  border-color: #3b82f6;
  background: #eff6ff;
}
.uploader__icon { font-size: 48px; margin-bottom: 12px; }
.uploader__text { font-size: 16px; color: #475569; margin: 0 0 4px; }
.uploader__link { color: #3b82f6; font-weight: 500; }
.uploader__hint { font-size: 13px; color: #94a3b8; margin: 0; }

/* ── Video preview wrapper ── */
.video-preview { display: flex; flex-direction: column; gap: 8px; }

/* ── Video player ── */
.vp-wrap {
  position: relative;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}
.vp-player {
  width: 100%;
  /* KHÔNG đặt max-height cứng — để browser tự tính theo aspect ratio */
  max-height: 480px;
  display: block;
  /* object-fit: contain giữ đúng tỉ lệ gốc, padding đen 2 bên nếu cần */
  object-fit: contain;
}
.vp-remove {
  position: absolute;
  top: 8px; right: 8px;
  background: rgba(0,0,0,0.65);
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px; height: 28px;
  font-size: 13px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
.vp-remove:hover { background: #ef4444; }
.vp-filename { font-size: 13px; color: #475569; }
.vp-filesize { color: #94a3b8; }

/* ── Logo section ── */
.wm-section {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  background: #fafafa;
}
.wm-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.wm-header h3 { margin: 0; font-size: 15px; color: #1e293b; }
.wm-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.wm-badge--default { background: #f1f5f9; color: #64748b; }
.wm-badge--custom  { background: #dbeafe; color: #2563eb; }

.wm-controls-row { display: flex; gap: 12px; align-items: flex-start; }
.wm-body { flex: 2; min-width: 0; display: flex; flex-direction: column; }

.wm-drop {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  min-height: 110px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.wm-drop:hover, .wm-drop--drag { border-color: #3b82f6; background: #eff6ff; }
.wm-drop--has { border-style: solid; border-color: #3b82f6; }
.wm-drop__icon  { font-size: 24px; margin-bottom: 4px; }
.wm-drop__text  { font-size: 12px; color: #475569; margin: 0 0 3px; }
.wm-drop__link  { color: #3b82f6; font-weight: 600; }
.wm-drop__hint  { font-size: 11px; color: #94a3b8; margin: 0; }
.wm-drop__preview { max-height: 52px; max-width: 100px; object-fit: contain; margin-bottom: 4px; }
.wm-drop__name  { font-size: 11px; color: #64748b; margin: 0; }

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

.wm-position-section {
  flex: 1; min-width: 0;
  padding: 12px; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px;
  display: flex; flex-direction: column; align-items: center;
}
.wm-position-label { font-size: 12px; color: #475569; margin: 0 0 8px; align-self: flex-start; }
.wm-position-grid {
  display: grid;
  grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px);
  gap: 3px; width: fit-content;
}
.wm-pos-btn {
  width: 28px; height: 28px;
  border: 1px solid #cbd5e1; border-radius: 5px;
  background: white; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; padding: 0; color: #64748b;
}
.wm-pos-btn:hover { background: #eff6ff; border-color: #3b82f6; color: #3b82f6; }
.wm-pos-btn--active { background: #3b82f6; border-color: #3b82f6; color: white; }
.wm-position-name { margin: 6px 0 0; font-size: 11px; color: #3b82f6; font-weight: 600; text-align: center; }

/* ── Bitrate preset ── */
.resolution-control {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}
.resolution-control__header {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.resolution-control__title  { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; }
.resolution-control__selected { font-size: 12px; color: #3b82f6; font-weight: 600; }
.resolution-control__selected em { font-style: normal; font-weight: 400; color: #64748b; }

.resolution-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
@media (max-width: 480px) { .resolution-grid { grid-template-columns: repeat(2, 1fr); } }

.res-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 4px; border-radius: 7px; border: 1.5px solid #e2e8f0;
  background: white; cursor: pointer; transition: all 0.15s; gap: 2px; line-height: 1.2;
}
.res-btn:hover { border-color: #93c5fd; background: #eff6ff; }
.res-btn__name { font-size: 13px; font-weight: 700; color: #1e293b; }
.res-btn__sub  { font-size: 10px; color: #94a3b8; }

.res-btn--active.res-btn--tier-high { border-color: #22c55e; background: #f0fdf4; }
.res-btn--active.res-btn--tier-high .res-btn__name { color: #16a34a; }
.res-btn--active.res-btn--tier-mid  { border-color: #3b82f6; background: #eff6ff; }
.res-btn--active.res-btn--tier-mid  .res-btn__name { color: #2563eb; }
.res-btn--active.res-btn--tier-low  { border-color: #f97316; background: #fff7ed; }
.res-btn--active.res-btn--tier-low  .res-btn__name { color: #ea580c; }

.res-btn--tier-high .res-btn__sub { color: #86efac; }
.res-btn--tier-mid  .res-btn__sub { color: #93c5fd; }
.res-btn--tier-low  .res-btn__sub { color: #fdba74; }

/* ── Shared ── */
.error { color: #ef4444; font-size: 14px; }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s;
}
.btn--primary { background: #3b82f6; color: white; width: 100%; justify-content: center; }
.btn--primary:hover:not(:disabled) { background: #2563eb; }
.btn--primary:disabled { background: #93c5fd; cursor: not-allowed; }
</style>