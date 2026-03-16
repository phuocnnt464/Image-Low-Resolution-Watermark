import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useVideoStore = defineStore('video', () => {
  const selectedFile     = ref(null)       // File object
  const previewUrl       = ref('')          // object URL cho <video>
  const isProcessing     = ref(false)
  const errorMessage     = ref('')
  const bitratePreset    = ref('720p')
  const watermarkFile    = ref(null)
  const watermarkUrl     = ref('')
  const watermarkPosition = ref('bottom-left')
  const progress         = ref(0)           // 0–100

  const setVideo = (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    if (file) {
      selectedFile.value = file
      previewUrl.value   = URL.createObjectURL(file)
    } else {
      selectedFile.value = null
      previewUrl.value   = ''
    }
  }

  const clearVideo = () => setVideo(null)

  const setWatermark = (file) => {
    if (watermarkUrl.value) URL.revokeObjectURL(watermarkUrl.value)
    if (file) {
      watermarkFile.value = file
      watermarkUrl.value  = URL.createObjectURL(file)
    } else {
      watermarkFile.value = null
      watermarkUrl.value  = ''
    }
  }

  const processAndDownload = async () => {
    if (!selectedFile.value) return
    isProcessing.value = true
    errorMessage.value = ''
    progress.value     = 0

    try {
      const formData = new FormData()
      formData.append('video', selectedFile.value)
      formData.append('bitratePreset', bitratePreset.value)
      formData.append('watermarkPosition', watermarkPosition.value)
      if (watermarkFile.value) formData.append('watermark', watermarkFile.value)

      const response = await axios.post('/api/videos/process', formData, {
        responseType: 'blob',
        timeout: 30 * 60 * 1000, // 30 phút cho video lớn
        onUploadProgress: (evt) => {
          if (evt.total) progress.value = Math.round(evt.loaded / evt.total * 40)
        },
      })

      progress.value = 100

      const disposition = response.headers['content-disposition']
      let filename = `watermarked-video.mp4`
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match?.[1]) filename = match[1].replace(/['"]/g, '')
      }

      const url  = URL.createObjectURL(new Blob([response.data], { type: 'video/mp4' }))
      const link = document.createElement('a')
      link.href     = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)

      clearVideo()
    } catch (err) {
      let message = 'Lỗi xử lý video, thử lại!'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          message = json.message || message
        } catch {}
      } else {
        message = err.response?.data?.message || err.message || message
      }
      errorMessage.value = message
    } finally {
      isProcessing.value = false
    }
  }

  return {
    selectedFile, previewUrl, isProcessing, errorMessage,
    bitratePreset, watermarkFile, watermarkUrl, watermarkPosition, progress,
    setVideo, clearVideo, setWatermark,
    processAndDownload,
  }
})