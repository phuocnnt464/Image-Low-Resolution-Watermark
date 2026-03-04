<template>
  <div
    class="uploader"
    :class="{ 'uploader--drag': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="triggerInput"
  >
    <input
      ref="inputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      style="display: none"
      @change="onFileChange"
    />

    <div class="uploader__icon">🖼️</div>
    <p class="uploader__text">
      Kéo thả ảnh vào đây hoặc <span class="uploader__link">chọn file</span>
    </p>
    <p class="uploader__hint">Hỗ trợ JPG, PNG, WEBP — tối đa 20 ảnh, 50MB/ảnh</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useImageStore } from '../stores/imageStore'

const store    = useImageStore()
const inputRef = ref(null)
const isDragging = ref(false)

const triggerInput = () => inputRef.value?.click()

const onFileChange = (e) => {
  store.addFiles(e.target.files)
  e.target.value = '' // reset để chọn lại cùng file
}

const onDrop = (e) => {
  isDragging.value = false
  store.addFiles(e.dataTransfer.files)
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
.uploader:hover,
.uploader--drag {
  border-color: #3b82f6;
  background: #eff6ff;
}
.uploader__icon { font-size: 48px; margin-bottom: 12px; }
.uploader__text { font-size: 16px; color: #475569; margin: 0 0 4px; }
.uploader__link { color: #3b82f6; font-weight: 500; }
.uploader__hint { font-size: 13px; color: #94a3b8; margin: 0; }
</style>