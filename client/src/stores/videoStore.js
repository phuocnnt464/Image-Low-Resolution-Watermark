import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

// 80MB mỗi chunk — đủ an toàn dưới giới hạn 100MB của cloud
const CHUNK_SIZE    = 80 * 1024 * 1024
const SMALL_LIMIT   = 80 * 1024 * 1024  // file ≤ 80MB → upload thường

export const useVideoStore = defineStore('video', () => {
  const selectedFile      = ref(null)
  const previewUrl        = ref('')
  const isProcessing      = ref(false)
  const errorMessage      = ref('')
  const bitratePreset     = ref('720p')
  const videoBitrate      = ref('auto')
  const watermarkFile     = ref(null)
  const watermarkUrl      = ref('')
  const watermarkPosition = ref('bottom-left')

  // Progress
  const uploadProgress = ref(0)    // 0-100
  const progressLabel  = ref('')   // text hiển thị

  const setVideo = (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    selectedFile.value = file || null
    previewUrl.value   = file ? URL.createObjectURL(file) : ''
  }

  const clearVideo = () => setVideo(null)

  const setWatermark = (file) => {
    if (watermarkUrl.value) URL.revokeObjectURL(watermarkUrl.value)
    watermarkFile.value = file || null
    watermarkUrl.value  = file ? URL.createObjectURL(file) : ''
  }

  const clearWatermark = () => setWatermark(null)

  // ─── Upload thường cho file nhỏ ≤ 80MB ───────────────────────────────────────
  const processSmall = async () => {
    const formData = new FormData()
    formData.append('video',             selectedFile.value)
    formData.append('bitratePreset',     bitratePreset.value)
    formData.append('videoBitrate',      videoBitrate.value)
    formData.append('watermarkPosition', watermarkPosition.value)
    if (watermarkFile.value) formData.append('watermark', watermarkFile.value)

    return axios.post('/api/videos/process', formData, {
      responseType: 'blob',
      timeout:      60 * 60 * 1000,
      onUploadProgress: (e) => {
        uploadProgress.value = Math.round((e.loaded / e.total) * 80)  // upload = 0→80%
        progressLabel.value  = `Đang upload... ${uploadProgress.value}%`
      },
    })
  }

  // ─── Chunked upload cho file lớn > 80MB ──────────────────────────────────────
  const processChunked = async () => {
    const file        = selectedFile.value
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    // Bước 1: Init job
    progressLabel.value  = 'Đang khởi tạo...'
    uploadProgress.value = 0

    const { data: { jobId } } = await axios.post('/api/videos/init', {
      bitratePreset:     bitratePreset.value,
      videoBitrate:      videoBitrate.value,
      watermarkPosition: watermarkPosition.value,
      totalChunks,
      originalName:      file.name,
    }, { timeout: 10_000 })

    // Bước 2: Upload từng chunk tuần tự
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end   = Math.min(start + CHUNK_SIZE, file.size)
      const blob  = file.slice(start, end)

      const formData = new FormData()
      formData.append('jobId',      jobId)
      formData.append('chunkIndex', String(i))
      // Đặt tên .mp4 để multer không reject (dù là binary chunk)
      formData.append('chunk',      blob, `chunk_${i}.mp4`)
      // Chỉ gửi watermark 1 lần ở chunk đầu tiên
      if (i === 0 && watermarkFile.value) {
        formData.append('watermark', watermarkFile.value)
      }

      await axios.post('/api/videos/chunk', formData, {
        timeout: 5 * 60 * 1000,
        onUploadProgress: (e) => {
          // Upload chiếm 0→70% progress bar
          const chunkDone  = i + e.loaded / e.total
          uploadProgress.value = Math.round((chunkDone / totalChunks) * 70)
          progressLabel.value  = `Upload chunk ${i + 1}/${totalChunks} — ${Math.round(e.loaded/e.total*100)}%`
        },
      })
    }

    // Bước 3: Finalize — server encode rồi stream về
    uploadProgress.value = 75
    progressLabel.value  = 'Đang encode video...'

    return axios.post('/api/videos/finalize',
      { jobId },
      {
        responseType: 'blob',
        timeout:      2 * 60 * 60 * 1000,  // encode có thể lâu
        onDownloadProgress: (e) => {
          if (e.total) {
            uploadProgress.value = 75 + Math.round((e.loaded / e.total) * 25)
            progressLabel.value  = `Đang tải xuống... ${Math.round(e.loaded / e.total * 100)}%`
          } else {
            progressLabel.value = 'Đang tải xuống...'
          }
        },
      }
    )
  }

  // ─── Lưu file blob về máy ─────────────────────────────────────────────────────
  const saveBlob = (blobResponse, fallbackName) => {
    const disposition = blobResponse.headers['content-disposition']
    let filename = fallbackName
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match?.[1]) filename = match[1].replace(/['"]/g, '')
    }
    const url  = URL.createObjectURL(new Blob([blobResponse.data], { type: 'video/mp4' }))
    const link = document.createElement('a')
    link.href = url; link.download = filename; link.click()
    URL.revokeObjectURL(url)
  }

  // ─── Main ─────────────────────────────────────────────────────────────────────
  const processAndDownload = async () => {
    if (!selectedFile.value) return
    isProcessing.value   = true
    errorMessage.value   = ''
    uploadProgress.value = 0
    progressLabel.value  = ''

    try {
      const isLarge  = selectedFile.value.size > SMALL_LIMIT
      const response = isLarge ? await processChunked() : await processSmall()

      progressLabel.value  = 'Hoàn thành!'
      uploadProgress.value = 100

      const fallback = `watermarked-${selectedFile.value.name.replace(/\.[^.]+$/, '')}.mp4`
      saveBlob(response, fallback)
      clearVideo()

    } catch (err) {
      let message = 'Lỗi xử lý video, thử lại!'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          message = JSON.parse(text).message || message
        } catch {}
      } else {
        message = err.response?.data?.message || err.message || message
      }
      errorMessage.value = message
    } finally {
      isProcessing.value = false
      setTimeout(() => { progressLabel.value = ''; uploadProgress.value = 0 }, 2000)
    }
  }

  return {
    selectedFile, previewUrl, isProcessing, errorMessage,
    bitratePreset, videoBitrate,
    watermarkFile, watermarkUrl, watermarkPosition,
    uploadProgress, progressLabel,
    setVideo, clearVideo, setWatermark, clearWatermark,
    processAndDownload,
  }
})