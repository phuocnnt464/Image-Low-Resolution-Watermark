<template>
  <div v-if="store.selectedFiles.length > 0" class="preview-section">
    <div class="preview-header">
      <h3>Ảnh đã chọn ({{ store.selectedFiles.length }})</h3>
      <button class="btn btn--ghost" @click="store.clearFiles">Xóa tất cả</button>
    </div>

    <div class="preview-grid">
      <div
        v-for="(url, index) in store.previewUrls"
        :key="index"
        class="preview-item"
      >
        <img :src="url" :alt="store.selectedFiles[index]?.name" />
        <button class="preview-item__remove" @click="store.removeFile(index)">✕</button>
        <p class="preview-item__name">{{ store.selectedFiles[index]?.name }}</p>
      </div>
    </div>

    <!-- Resolution preset picker -->
    <div class="resolution-control">
      <div class="resolution-control__header">
        <span class="resolution-control__title">🎛 Mức độ giảm chất lượng</span>
        <span class="resolution-control__selected">
          {{ selectedPreset.label }}
          <em>— {{ selectedPreset.desc }}</em>
        </span>
      </div>

      <div class="resolution-grid">
        <button
          v-for="preset in presets"
          :key="preset.value"
          class="res-btn"
          :class="{
            'res-btn--active': store.resolutionPreset === preset.value,
            [`res-btn--tier-${preset.tier}`]: true,
          }"
          :title="preset.desc"
          @click="store.resolutionPreset = preset.value"
        >
          <span class="res-btn__name">{{ preset.value }}</span>
          <span class="res-btn__sub">{{ preset.sub }}</span>
        </button>
      </div>

      <!-- ── Bit Depth picker (xuất hiện dưới preset) ── -->
      <div class="bitdepth-row">
        <span class="bitdepth-label">🎨 Bit Depth:</span>
        <div class="bitdepth-options">
          <button
            v-for="bd in bitDepthOptions"
            :key="bd.value"
            class="bd-btn"
            :class="{
              'bd-btn--active':    store.bitDepth === bd.value,
              [`bd-btn--${bd.color}`]: true,
            }"
            :title="bd.desc"
            @click="store.bitDepth = bd.value"
          >
            <span class="bd-btn__name">{{ bd.label }}</span>
            <span class="bd-btn__sub">{{ bd.sub }}</span>
          </button>
        </div>
        <span class="bitdepth-desc">{{ selectedBitDepth.desc }}</span>
      </div>
    </div>

    <!-- Error message -->
    <p v-if="store.errorMessage" class="error">⚠️ {{ store.errorMessage }}</p>

    <!-- Download button -->
    <button
      class="btn btn--primary"
      :disabled="store.isProcessing"
      @click="store.processAndDownload"
    >
      <span v-if="store.isProcessing">⏳ Đang xử lý...</span>
      <span v-else>⬇️ Tải xuống ({{ store.selectedFiles.length }} ảnh)</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useImageStore } from '../stores/imageStore'

const store = useImageStore()

const presets = [
  { value: 'Original', label: 'Gốc (Original)', sub: 'Giữ nguyên',  desc: 'Giữ nguyên resolution, chất lượng cao nhất', tier: 'high' },
  { value: '4K',       label: '4K (3840px)',     sub: '3840px',      desc: 'Ultra HD — rất ít mất chi tiết',             tier: 'high' },
  { value: 'QHD',      label: 'QHD (2560px)',    sub: '2560px',      desc: 'Quad HD — ít mất chi tiết',                  tier: 'high' },
  { value: 'FHD',      label: 'Full HD (1920px)',sub: '1920px',      desc: 'Full HD — tiêu chuẩn phổ biến',              tier: 'mid'  },
  { value: 'HD',       label: 'HD (1280px)',     sub: '1280px',      desc: 'HD — mất một phần chi tiết',                 tier: 'mid'  },
  { value: 'SD',       label: 'SD (854px)',      sub: '854px',       desc: 'Standard — mất khá nhiều chi tiết',          tier: 'low'  },
  { value: 'LD',       label: 'LD (480px)',      sub: '480px',       desc: 'Low Def — mất nhiều chi tiết',               tier: 'low'  },
  { value: 'Tiny',     label: 'Tiny (240px)',    sub: '240px',       desc: 'Cực thấp — pixel hoá rõ rệt',                tier: 'low'  },
]

// ── Bit depth options ─────────────────────────────────────────────────────────
const bitDepthOptions = [
  { value: '8bit',  label: '8-bit',  sub: '256 levels',  color: 'std',  desc: 'Tiêu chuẩn — màu sắc thông thường (JPG/PNG/WebP)' },
  { value: '12bit', label: '12-bit', sub: '4096 levels', color: 'high', desc: 'Cao — tương đương RAW camera; PNG xuất 16-bit thật' },
  { value: '24bit', label: '24-bit', sub: 'Full RGB',    color: 'high', desc: 'Full color — 8-bit mỗi kênh RGB, chuẩn hiển thị' },
  { value: '32bit', label: '32-bit', sub: 'Reduced',     color: 'low',  desc: 'Giảm dải màu — hiệu ứng posterize nhẹ' },
  { value: '64bit', label: '64-bit', sub: 'Minimal',     color: 'xlow', desc: 'Dải màu tối thiểu — posterize mạnh, phong cách nghệ thuật' },
]

const selectedPreset   = computed(() => presets.find(p => p.value === store.resolutionPreset) ?? presets[3])
const selectedBitDepth = computed(() => bitDepthOptions.find(b => b.value === store.bitDepth) ?? bitDepthOptions[0])
</script>

<style scoped>
.preview-section { margin-top: 24px; }

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.preview-header h3 { margin: 0; color: #1e293b; }

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.preview-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}
.preview-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.preview-item__remove {
  position: absolute;
  top: 4px; right: 4px;
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px; height: 22px;
  cursor: pointer;
  font-size: 11px;
  line-height: 22px;
  text-align: center;
  padding: 0;
}
.preview-item__remove:hover { background: #ef4444; }
.preview-item__name {
  font-size: 11px;
  color: #64748b;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

/* ── Resolution preset picker ── */
.resolution-control {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.resolution-control__header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.resolution-control__title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}
.resolution-control__selected {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 600;
}
.resolution-control__selected em {
  font-style: normal;
  font-weight: 400;
  color: #64748b;
}

.resolution-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
@media (max-width: 480px) {
  .resolution-grid { grid-template-columns: repeat(2, 1fr); }
}

.res-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border-radius: 7px;
  border: 1.5px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  gap: 2px;
  line-height: 1.2;
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

/* ── Bit Depth picker ── */
.bitdepth-row {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bitdepth-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.bitdepth-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.bd-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1.5px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 64px;
  gap: 1px;
}
.bd-btn:hover { border-color: #93c5fd; background: #eff6ff; }
.bd-btn__name { font-size: 12px; font-weight: 700; color: #1e293b; }
.bd-btn__sub  { font-size: 10px; color: #94a3b8; }

/* Active states theo màu */
.bd-btn--active.bd-btn--std  { border-color: #3b82f6; background: #eff6ff; }
.bd-btn--active.bd-btn--std  .bd-btn__name { color: #2563eb; }
.bd-btn--active.bd-btn--high { border-color: #22c55e; background: #f0fdf4; }
.bd-btn--active.bd-btn--high .bd-btn__name { color: #16a34a; }
.bd-btn--active.bd-btn--low  { border-color: #f97316; background: #fff7ed; }
.bd-btn--active.bd-btn--low  .bd-btn__name { color: #ea580c; }
.bd-btn--active.bd-btn--xlow { border-color: #ef4444; background: #fef2f2; }
.bd-btn--active.bd-btn--xlow .bd-btn__name { color: #dc2626; }

.bitdepth-desc {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
  min-height: 16px;
}

/* ── Buttons ── */
.error { color: #ef4444; font-size: 14px; margin-bottom: 12px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn--primary {
  background: #3b82f6;
  color: white;
  width: 100%;
  justify-content: center;
}
.btn--primary:hover:not(:disabled) { background: #2563eb; }
.btn--primary:disabled { background: #93c5fd; cursor: not-allowed; }
.btn--ghost {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fecaca;
  padding: 6px 14px;
  font-size: 13px;
}
.btn--ghost:hover { background: #fef2f2; }
</style>