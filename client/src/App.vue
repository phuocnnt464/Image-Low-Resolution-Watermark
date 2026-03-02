<template>
  <div class="app">
    <header class="app-header">
      <h1>🖼️ Image Watermark & Compress</h1>
      <p>Upload ảnh, giảm resolution và chèn watermark tự động</p>
    </header>

    <main class="app-main">
      <div class="card">
        <ImageUploader />
        <ImagePreviewGrid />
      </div>

      <div class="card">
        <HistoryTable />
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useImageStore } from './stores/imageStore'
import ImageUploader from './components/ImageUploader.vue'
import ImagePreviewGrid from './components/ImagePreviewGrid.vue'
import HistoryTable from './components/HistoryTable.vue'

const store = useImageStore()
onMounted(() => store.fetchHistory())
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f1f5f9;
  color: #1e293b;
  min-height: 100vh;
}

.app-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 20px 24px;
  text-align: center;
}
.app-header h1 { font-size: 24px; color: #1e293b; margin-bottom: 4px; }
.app-header p  { color: #64748b; font-size: 14px; }

.app-main {
  max-width: 900px;
  margin: 32px auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
</style>