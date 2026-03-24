<template>
  <div class="app">
    <header class="app-header">
      <h1>Watermark & Compress</h1>
      <p>Giảm resolution, chèn watermark tự động</p>
    </header>

    <main class="app-main">
      <div class="tab-bar">
        <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'image' }" @click="activeTab = 'image'">Ảnh</button>
        <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'video' }" @click="activeTab = 'video'">Video</button>
      </div>

      <!-- Image tab -->
      <div v-show="activeTab === 'image'" class="card">
        <ImageUploader />
        <WatermarkUploader :store="imageStore" />
        <PreviewGrid />
      </div>

      <!-- Video tab -->
      <div v-show="activeTab === 'video'" class="card">
        <!-- 1. Player + bitrate -->
        <VideoUploader ref="videoUploaderRef" />

        <!-- 2. Logo + position + preview frame — nhận videoRef để capture frame trực tiếp -->
        <WatermarkUploader :store="videoStore" :video-ref="videoUploaderRef" />

        <!-- 3. Error + nút Download — đặt SAU watermark section -->
        <template v-if="videoStore.selectedFile">
          <p v-if="videoStore.errorMessage" class="video-error">⚠️ {{ videoStore.errorMessage }}</p>
          <button
            class="btn btn--primary"
            :disabled="videoStore.isProcessing"
            @click="videoStore.processAndDownload"
          >
            <span v-if="videoStore.isProcessing">⏳ Đang xử lý video...</span>
            <span v-else>⬇️ Tải xuống video</span>
          </button>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useImageStore }  from './stores/imageStore'
import { useVideoStore }  from './stores/videoStore'
import ImageUploader      from './components/ImageUploader.vue'
import WatermarkUploader  from './components/WatermarkUploader.vue'
import PreviewGrid        from './components/PreviewGrid.vue'
import VideoUploader      from './components/VideoUploader.vue'

const activeTab        = ref('image')
const imageStore       = useImageStore()
const videoStore       = useVideoStore()
const videoUploaderRef = ref(null)   

onMounted(() => imageStore.fetchHistory())
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f1f5f9; color: #1e293b; min-height: 100vh;
}
.app-header {
  background: white; border-bottom: 1px solid #e2e8f0;
  padding: 20px 24px; text-align: center;
}
.app-header h1 { font-size: 24px; color: #1e293b; margin-bottom: 4px; }
.app-header p  { color: #64748b; font-size: 14px; }
.app-main {
  max-width: 900px; margin: 30px auto; padding: 0 16px;
  display: flex; flex-direction: column; gap: 24px;
}
.card {
  background: white; border-radius: 12px; padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  display: flex; flex-direction: column; gap: 0;
}
.tab-bar {
  display: flex; gap: 8px; background: white; border-radius: 12px;
  padding: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.tab-btn {
  flex: 1; padding: 10px 0; border: none; border-radius: 8px;
  background: transparent; font-size: 15px; font-weight: 600;
  color: #64748b; cursor: pointer; transition: all 0.2s;
}
.tab-btn:hover { background: #f1f5f9; color: #1e293b; }
.tab-btn--active { background: #3b82f6; color: white; }
.tab-btn--active:hover { background: #2563eb; }

/* Video tab — nút download + error ở App.vue */
.video-error { color: #ef4444; font-size: 14px; margin-top: 12px; }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; border: none;
  cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s;
  margin-top: 12px;
}
.btn--primary { background: #3b82f6; color: white; width: 100%; justify-content: center; }
.btn--primary:hover:not(:disabled) { background: #2563eb; }
.btn--primary:disabled { background: #93c5fd; cursor: not-allowed; }
</style>