<template>
  <div class="video-section">

    <!-- Drop zone -->
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

    <!-- Sau khi đã chọn video -->
    <div v-else class="video-preview">

      <div class="vp-wrap">
        <video
          ref="videoRef"
          :key="store.previewUrl"
          :src="store.previewUrl"
          controls
          preload="auto"
          class="vp-player"
        ></video>
        <button class="vp-remove" @click="store.clearVideo" title="Xóa video">✕</button>
      </div>

      <p class="vp-filename">
        📁 {{ store.selectedFile.name }}
        <span class="vp-filesize">({{ formatSize(store.selectedFile.size) }})</span>
      </p>

      <!-- ── Bước 1: Chọn Preset Resolution ── -->
      <div class="resolution-control">
        <div class="resolution-control__header">
          <span class="resolution-control__title"> Preset Optional</span>
          <span class="resolution-control__selected">
            {{ selectedPreset.label }}
            <em>— {{ selectedPreset.desc }}</em>
          </span>
        </div>
        <div class="resolution-grid">
          <button
            v-for="preset in resolutionPresets"
            :key="preset.value"
            class="res-btn"
            :class="{
              'res-btn--active': store.bitratePreset === preset.value,
              [`res-btn--tier-${preset.tier}`]: true,
            }"
            :title="preset.desc"
            @click="onSelectPreset(preset.value)"
          >
            <span class="res-btn__name">{{ preset.label }}</span>
            <span class="res-btn__sub">{{ preset.sub }}</span>
          </button>
        </div>
      </div>

      <!-- ── Bước 2: Chọn Bitrate cho preset đang chọn ── -->
      <div v-if="currentBitrateOptions.length > 1" class="bitrate-control">
        <div class="bitrate-control__header">
          <span class="bitrate-control__title">📡 Video Bitrate</span>
          <span class="bitrate-control__hint">
            Cao hơn = sắc nét hơn, file lớn hơn
          </span>
        </div>
        <div class="bitrate-grid">
          <button
            v-for="opt in currentBitrateOptions"
            :key="opt.value"
            class="br-btn"
            :class="{ 'br-btn--active': store.videoBitrate === opt.value }"
            :title="opt.hint"
            @click="store.videoBitrate = opt.value"
          >
            <span class="br-btn__label">{{ opt.label }}</span>
            <span class="br-btn__hint">{{ opt.hint }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'

const store      = useVideoStore()
const fileInput  = ref(null)
const videoRef   = ref(null)
const isDragging = ref(false)

defineExpose({ videoRef })

// ── Danh sách preset resolution ───────────────────────────────────────────────
const resolutionPresets = [
  { value: 'Original', label: 'Original', sub: 'Giữ nguyên', desc: 'Không đổi resolution, giữ nguyên',          tier: 'high' },
  { value: '4K',       label: '4K',       sub: '3840px',     desc: '4K Ultra HD — rất sắc nét',                 tier: 'high' },
  { value: '1080p',    label: '1080p',    sub: '1920px',     desc: 'Full HD — tiêu chuẩn YouTube/streaming',    tier: 'high' },
  { value: '720p',     label: '720p',     sub: '1280px',     desc: 'HD — phổ biến, file vừa phải',              tier: 'mid'  },
  { value: '480p',     label: '480p',     sub: '854px',      desc: 'SD — nhẹ hơn, phù hợp mobile',             tier: 'mid'  },
  { value: '360p',     label: '360p',     sub: '640px',      desc: 'Low — rất nhẹ, chất lượng thấp',           tier: 'low'  },
  { value: '240p',     label: '240p',     sub: '426px',      desc: 'Very Low — tối thiểu, mạng chậm',          tier: 'low'  },
]

// ── Bảng bitrate theo preset (phải khớp với BITRATE_OPTIONS ở server) ─────────
const BITRATE_OPTIONS = {
  'Original': [
    { value: 'auto',    label: 'Auto',    hint: 'Giữ nguyên bitrate gốc' },
  ],
  '4K': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 18 — chất lượng cao nhất' },
    { value: '40000k',  label: '40 Mbps', hint: 'Rất cao — master / archive' },
    { value: '20000k',  label: '20 Mbps', hint: 'Cao — streaming 4K chuẩn' },
    { value: '10000k',  label: '10 Mbps', hint: 'Vừa — 4K nén nhẹ' },
  ],
  '1080p': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 20 — chất lượng tốt' },
    { value: '12000k',  label: '12 Mbps', hint: 'Rất cao — phim / chụp màn hình' },
    { value: '8000k',   label: '8 Mbps',  hint: 'Cao — tiêu chuẩn YouTube 1080p' },
    { value: '4000k',   label: '4 Mbps',  hint: 'Vừa — streaming tiết kiệm' },
  ],
  '720p': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 22 — mặc định cân bằng' },
    { value: '6000k',   label: '6 Mbps',  hint: 'Cao — YouTube 720p60' },
    { value: '4000k',   label: '4 Mbps',  hint: 'Chuẩn — YouTube 720p30' },
    { value: '2000k',   label: '2 Mbps',  hint: 'Nhẹ — stream / upload nhanh' },
  ],
  '480p': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 24' },
    { value: '3000k',   label: '3 Mbps',  hint: 'Cao — 480p sắc nét' },
    { value: '2000k',   label: '2 Mbps',  hint: 'Chuẩn — phổ biến' },
    { value: '1000k',   label: '1 Mbps',  hint: 'Nhẹ — mobile / mạng yếu' },
  ],
  '360p': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 26' },
    { value: '1500k',   label: '1.5 Mbps',hint: 'Cao' },
    { value: '1000k',   label: '1 Mbps',  hint: 'Chuẩn' },
    { value: '600k',    label: '600 Kbps',hint: 'Nhẹ' },
  ],
  '240p': [
    { value: 'auto',    label: 'Auto',    hint: 'CRF 28' },
    { value: '700k',    label: '700 Kbps',hint: 'Cao' },
    { value: '500k',    label: '500 Kbps',hint: 'Chuẩn' },
    { value: '300k',    label: '300 Kbps',hint: 'Nhẹ nhất' },
  ],
}

// Danh sách bitrate của preset đang chọn
const currentBitrateOptions = computed(
  () => BITRATE_OPTIONS[store.bitratePreset] ?? BITRATE_OPTIONS['720p']
)

const selectedPreset = computed(
  () => resolutionPresets.find(p => p.value === store.bitratePreset) ?? resolutionPresets[3]
)

// Khi đổi preset → reset về 'auto' để tránh gửi bitrate không hợp lệ
function onSelectPreset(value) {
  store.bitratePreset = value
  store.videoBitrate  = 'auto'
}

// ── Các hàm tiện ích ──────────────────────────────────────────────────────────
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
</script>

<style scoped>
.uploader {
  border: 2px dashed #94a3b8;
  border-radius: 12px;
  padding: 48px 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
}
.uploader:hover, .uploader--drag { border-color: #3b82f6; background: #eff6ff; }
.uploader__icon { font-size: 48px; margin-bottom: 12px; }
.uploader__text { font-size: 16px; color: #475569; margin: 0 0 4px; }
.uploader__link { color: #3b82f6; font-weight: 500; }
.uploader__hint { font-size: 13px; color: #94a3b8; margin: 0; }

.video-preview { display: flex; flex-direction: column; gap: 12px; }

.vp-wrap {
  position: relative;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}
.vp-player {
  width: 100%;
  max-height: 480px;
  display: block;
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

/* ── Resolution preset ── */
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

/* ── Bitrate selector ── */
.bitrate-control {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 14px 16px;
}
.bitrate-control__header {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
}
.bitrate-control__title { font-size: 13px; font-weight: 600; color: #0369a1; white-space: nowrap; }
.bitrate-control__hint  { font-size: 11px; color: #64748b; }

.bitrate-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
@media (max-width: 480px) { .bitrate-grid { grid-template-columns: repeat(2, 1fr); } }

.br-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 6px; border-radius: 7px; border: 1.5px solid #e0f2fe;
  background: white; cursor: pointer; transition: all 0.15s; gap: 3px; line-height: 1.3;
  text-align: center;
}
.br-btn:hover { border-color: #38bdf8; background: #e0f2fe; }

.br-btn__label {
  font-size: 13px;
  font-weight: 700;
  color: #0369a1;
}
.br-btn__hint {
  font-size: 10px;
  color: #94a3b8;
}

.br-btn--active {
  border-color: #0284c7;
  background: #0284c7;
}
.br-btn--active .br-btn__label { color: white; }
.br-btn--active .br-btn__hint  { color: #bae6fd; }
</style>