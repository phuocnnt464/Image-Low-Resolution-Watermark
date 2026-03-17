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
        <!-- ✅ ref="videoRef" để expose ra ngoài cho WatermarkUploader capture frame -->
        <video
          ref="videoRef"
          :key="store.previewUrl"
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

      <!-- Bitrate preset -->
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

      <!-- ✅ Error và Download button đã chuyển ra App.vue — KHÔNG còn ở đây -->

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'

const store     = useVideoStore()
const fileInput = ref(null)
const videoRef  = ref(null)   // ← expose để App/WatermarkUploader dùng
const isDragging = ref(false)

// ── Expose videoRef ra ngoài ─────────────────────────────────────────────
defineExpose({ videoRef })

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
</style>