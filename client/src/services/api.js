import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

/**
 * Upload ảnh để xử lý — nhận về blob để download
 * @param {File[]}      files
 * @param {number}      scalePercent
 * @param {File|null}   watermarkFile  - watermark tùy chỉnh, null = dùng mặc định
 */
const processImages = async (files, scalePercent = 50, watermarkFile = null) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('images', file))
  formData.append('scalePercent', scalePercent)

  // ✅ Chỉ append watermark nếu user có upload
  if (watermarkFile) {
    formData.append('watermark', watermarkFile)
  }

  const response = await apiClient.post('/images/process', formData, {
    // ✅ Không set Content-Type thủ công — để browser tự set boundary cho multipart
    responseType: 'blob',
  })

  return response
}

const getHistory = async (limit = 50) => {
  const response = await apiClient.get(`/images/history?limit=${limit}`)
  return response.data.data
}

const deleteHistory = async (id) => {
  const response = await apiClient.delete(`/images/history/${id}`)
  return response.data
}

export { processImages, getHistory, deleteHistory }