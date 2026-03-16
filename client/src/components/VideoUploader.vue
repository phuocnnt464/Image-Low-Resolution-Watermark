<template>
  <div class="video-section">

    <!-- Drop zone (khi chưa có video) -->
    <div
      v-if="!store.selectedFile"
      class="video-dropzone"
      :class="{ 'video-dropzone--drag': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInput.click()"
    >
      <span class="video-dropzone__icon">🎬</span>
      <p class="video-dropzone__text">Kéo thả video vào đây hoặc <strong>bấm để chọn</strong></p>
      <p class="video-dropzone__hint">MP4, MOV, AVI, MKV, WEBM — tối đa 2 GB</p>
      <input
        ref="fileInput"
        type="file"
        accept="video/*"
        style="display:none"
        @change="onFileChange"
      />
    </div>

    <!-- Preview + controls (khi đã có video) -->
    <div v-else class="video-preview">

      <!-- Video player -->
      <div class="video-player-wrap">
        <video
          :src="store.previewUrl"
          controls
          class="video-player"
        />
        <button class="video-remove" @click="store.clearVideo" title="Xóa video">✕</button>
      </div>

      <p class="video-filename">📁 {{ store.selectedFile.name }}
        <span class="video-filesize">({{ formatSize(store.selectedFile.size) }})</span>
      </p>

      <!-- Watermark image (tuỳ chọn) -->
      <div class="wm-row">
        <label class="wm-label">🖼 Watermark ảnh (tuỳ chọn):</label>
        <div class="wm-pick">
          <button class="btn btn--ghost btn--sm" @click="wmInput.click()">
            {{ store.watermarkFile ? '🔄 Đổi watermark' : '+ Chọn watermark' }}
          </button>
          <button v-if="store.watermarkFile" class="btn btn--ghost btn--sm btn--danger" @click="store.setWatermark(null)">✕</button>
          <img v-if="store.watermarkUrl" :src="store.watermarkUrl" class="wm-thumb" />
          <input ref="wmInput" type="file" accept="image/*" style="display:none" @change="onWmChange" />
        </div>
      </div>

      <!-- Vị trí watermark -->
      <div class="pos-section">
        <p class="pos-label">📍 Vị trí watermark:</p>
        <div class="pos-grid">
          <button
            v-for="p in positions"
            :key="p.value"
            class="pos-btn"
            :class="{ 'pos-btn--active': store.watermarkPosition === p.value }"
            @click="store.watermarkPosition = p.value"
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Bitrate preset -->
      <div class="bitrate-control">
        <div class="bitrate-control__header">
          <span class="bitrate-control__title">📡 Preset Bitrate</span>
          <span class="bitrate-control__selected">
            {{ selectedPreset.label }}
            <em>— {{ selectedPreset.desc }}</em>
          </span>
        </div>
        <div class="bitrate-grid">
          <button
            v-for="preset in bitratePresets"
            :key="preset.value"
            class="br-btn"
            :class="{
              'br-btn--active': store.bitratePreset === preset.value,
              [`br-btn--tier-${preset.tier}`]: true,
            }"
            :title="preset.desc"
            @click="store.bitratePreset = preset.value"
          >
            <span class="br-btn__name">{{ preset.value }}</span>
            <span class="br-btn__sub">{{ preset.sub }}</span>
          </button>
        </div>
      </div>

      <!-- Error -->
      <p v-if="store.errorMessage" class="error">⚠️ {{ store.errorMessage }}</p>

      <!-- Progress bar (khi đang xử lý) -->
      <div v-if="store.isProcessing" class="progress-wrap">
        <div class="progress-bar" :style="{ width: store.progress + '%' }"></div>
        <span class="progress-text">
          {{ store.progress < 50 ? '⬆️ Đang upload...' : '⚙️ FFmpeg đang xử lý, vui lòng đợi...' }}
        </span>
      </div>

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
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'

const store    = useVideoStore()
const fileInput = ref(null)
const wmInput   = ref(null)
const isDragging = ref(false)

const bitratePresets = [
  { value: 'Original', label: 'Gốc (Original)', sub: 'Giữ nguyên', desc: 'Không nén, giữ nguyên bitrate gốc',        tier: 'high' },
  { value: '4K',       label: '4K',             sub: '20 Mbps',    desc: '4K Ultra HD — chất lượng rất cao',          tier: 'high' },
  { value: '1080p',    label: '1080p',           sub: '8 Mbps',     desc: 'Full HD — tiêu chuẩn YouTube/streaming',    tier: 'high' },
  { value: '720p',     label: '720p',            sub: '4 Mbps',     desc: 'HD — phổ biến, file vừa phải',              tier: 'mid'  },
  { value: '480p',     label: '480p',            sub: '2 Mbps',     desc: 'SD — nhẹ hơn, phù hợp mobile',             tier: 'mid'  },
  { value: '360p',     label: '360p',            sub: '1 Mbps',     desc: 'Low — rất nhẹ, chất lượng thấp',           tier: 'low'  },
  { value: '240p',     label: '240p',            sub: '500 Kbps',   desc: 'Very Low — tối thiểu, mạng chậm',          tier: 'low'  },
]

const positions = [
  { value: 'top-left',      label: '↖ Trên trái'    },
  { value: 'top-center',    label: '↑ Trên giữa'    },
  { value: 'top-right',     label: '↗ Trên phải'    },
  { value: 'center-left',   label: '← Giữa trái'   },
  { value: 'center',        label: '✛ Chính giữa'   },
  { value: 'center-right',  label: '→ Giữa phải'   },
  { value: 'bottom-left',   label: '↙ Dưới trái'   },
  { value: 'bottom-center', label: '↓ Dưới giữa'   },
  { value: 'bottom-right',  label: '↘ Dưới phải'   },
]

const selectedPreset = computed(
  () => bitratePresets.find(p => p.value === store.bitratePreset) ?? bitratePresets[3]
)

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

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
</script>

<style scoped>
/* ── Drop zone ── */
.video-dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
}
.video-dropzone:hover,
.video-dropzone--drag {
  border-color: #3b82f6;
  background: #eff6ff;
}
.video-dropzone__icon { font-size: 40px; display: block; margin-bottom: 12px; }
.video-dropzone__text { font-size: 15px; color: #475569; margin-bottom: 6px; }
.video-dropzone__hint { font-size: 12px; color: #94a3b8; }

/* ── Preview ── */
.video-preview { display: flex; flex-direction: column; gap: 16px; }

.video-player-wrap {
  position: relative;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}
.video-player {
  width: 100%;
  max-height: 360px;
  display: block;
  object-fit: contain;
}
.video-remove {
  position: absolute;
  top: 8px; right: 8px;
  background: rgba(0,0,0,0.65);
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px; height: 30px;
  font-size: 14px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.video-remove:hover { background: #ef4444; }

.video-filename { font-size: 13px; color: #475569; }
.video-filesize { color: #94a3b8; }

/* ── Watermark row ── */
.wm-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wm-label { font-size: 13px; color: #475569; white-space: nowrap; }
.wm-pick  { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wm-thumb { height: 36px; border-radius: 4px; border: 1px solid #e2e8f0; }

/* ── Position grid ── */
.pos-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
.pos-label { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; }
.pos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}
.pos-btn {
  padding: 6px 4px;
  font-size: 11px;
  border-radius: 6px;
  border: 1.5px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.pos-btn:hover { border-color: #93c5fd; background: #eff6ff; }
.pos-btn--active { border-color: #3b82f6; background: #eff6ff; color: #2563eb; font-weight: 700; }

/* ── Bitrate preset ── */
.bitrate-control {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}
.bitrate-control__header {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.bitrate-control__title { font-size: 13px; font-weight: 600; color: #1e293b; }
.bitrate-control__selected { font-size: 12px; color: #3b82f6; font-weight: 600; }
.bitrate-control__selected em { font-style: normal; font-weight: 400; color: #64748b; }

.bitrate-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
@media (max-width: 480px) { .bitrate-grid { grid-template-columns: repeat(2, 1fr); } }

.br-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 4px; border-radius: 7px; border: 1.5px solid #e2e8f0;
  background: white; cursor: pointer; transition: all 0.15s; gap: 2px; line-height: 1.2;
}
.br-btn:hover { border-color: #93c5fd; background: #eff6ff; }
.br-btn__name { font-size: 13px; font-weight: 700; color: #1e293b; }
.br-btn__sub  { font-size: 10px; color: #94a3b8; }

.br-btn--active.br-btn--tier-high { border-color: #22c55e; background: #f0fdf4; }
.br-btn--active.br-btn--tier-high .br-btn__name { color: #16a34a; }
.br-btn--active.br-btn--tier-mid  { border-color: #3b82f6; background: #eff6ff; }
.br-btn--active.br-btn--tier-mid  .br-btn__name { color: #2563eb; }
.br-btn--active.br-btn--tier-low  { border-color: #f97316; background: #fff7ed; }
.br-btn--active.br-btn--tier-low  .br-btn__name { color: #ea580c; }

.br-btn--tier-high .br-btn__sub { color: #86efac; }
.br-btn--tier-mid  .br-btn__sub { color: #93c5fd; }
.br-btn--tier-low  .br-btn__sub { color: #fdba74; }

/* ── Progress ── */
.progress-wrap {
  background: #f1f5f9;
  border-radius: 8px;
  height: 36px;
  position: relative;
  overflow: hidden;
}
.progress-bar {
  position: absolute; inset-block: 0; left: 0;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  transition: width 0.4s ease;
  border-radius: 8px;
}
.progress-text {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: #1e293b; z-index: 1;
}

/* ── Shared buttons ── */
.error { color: #ef4444; font-size: 14px; }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s;
}
.btn--primary { background: #3b82f6; color: white; width: 100%; justify-content: center; }
.btn--primary:hover:not(:disabled) { background: #2563eb; }
.btn--primary:disabled { background: #93c5fd; cursor: not-allowed; }
.btn--ghost { background: transparent; color: #475569; border: 1px solid #e2e8f0; padding: 6px 12px; font-size: 13px; }
.btn--ghost:hover { background: #f1f5f9; }
.btn--danger { color: #ef4444; border-color: #fecaca; }
.btn--danger:hover { background: #fef2f2; }
.btn--sm { padding: 5px 10px; font-size: 12px; }
</style>