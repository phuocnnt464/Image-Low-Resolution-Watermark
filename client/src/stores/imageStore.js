import { defineStore } from 'pinia'
import { ref } from 'vue'
import { processImages as apiProcessImages, getHistory, deleteHistory } from '../services/api'

export const useImageStore = defineStore('image', () => {
  const selectedFiles   = ref([])
  const previewUrls     = ref([])
  const isProcessing    = ref(false)
  const history         = ref([])
  const errorMessage    = ref('')
  const scalePercent    = ref(50)

  // ── Watermark state ───────────────────────────────────────────────────────
  const watermarkFile     = ref(null)     // File | null
  const watermarkUrl      = ref('')       // object URL để preview watermark
  const watermarkPosition = ref('bottom-left') // vị trí mặc định

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

  const clearWatermark = () => setWatermark(null)

  // ── Image actions ─────────────────────────────────────────────────────────
  const addFiles = (files) => {
    const newFiles = Array.from(files)
    selectedFiles.value.push(...newFiles)
    newFiles.forEach((f) => previewUrls.value.push(URL.createObjectURL(f)))
  }

  const removeFile = (index) => {
    URL.revokeObjectURL(previewUrls.value[index])
    selectedFiles.value.splice(index, 1)
    previewUrls.value.splice(index, 1)
  }

  const clearFiles = () => {
    previewUrls.value.forEach((url) => URL.revokeObjectURL(url))
    selectedFiles.value = []
    previewUrls.value   = []
  }

  const processAndDownload = async () => {
    if (selectedFiles.value.length === 0) return
    isProcessing.value = true
    errorMessage.value = ''

    try {
      const response = await apiProcessImages(
        selectedFiles.value,
        scalePercent.value,
        watermarkFile.value,
        watermarkPosition.value   // ← truyền position
      )

      const disposition = response.headers['content-disposition']
      let filename = selectedFiles.value.length === 1
        ? `watermarked-${selectedFiles.value[0].name}`
        : 'watermarked-images.zip'

      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match?.[1]) filename = match[1].replace(/['"]/g, '')
      }

      const url  = URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href     = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)

      await fetchHistory()
      clearFiles()
    } catch (err) {
      let message = 'Lỗi xử lý ảnh, thử lại!'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const json = JSON.parse(text)
          message = json.message || message
        } catch {}
      } else {
        message = err.response?.data?.message || message
      }
      errorMessage.value = message
    } finally {
      isProcessing.value = false
    }
  }

  const fetchHistory = async () => {
    try { history.value = await getHistory() }
    catch (err) { console.error('Lỗi lấy lịch sử:', err) }
  }

  const removeHistory = async (id) => {
    try {
      await deleteHistory(id)
      history.value = history.value.filter((item) => item.id !== id)
    } catch (err) { console.error('Lỗi xóa:', err) }
  }

  return {
    selectedFiles, previewUrls, isProcessing, history, errorMessage, scalePercent,
    watermarkFile, watermarkUrl, watermarkPosition,
    setWatermark, clearWatermark,
    addFiles, removeFile, clearFiles,
    processAndDownload, fetchHistory, removeHistory,
  }
})