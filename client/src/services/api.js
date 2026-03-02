import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s cho file lớn
})

/**
 * Upload ảnh để xử lý — nhận về blob để download
 * @param {File[]} files
 * @param {number} scalePercent
 */
const processImages = async (files, scalePercent = 50) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('images', file))
  formData.append('scalePercent', scalePercent)

  const response = await apiClient.post('/images/process', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob', // nhận file nhị phân
  })

  return response
}

/**
 * Lấy lịch sử xử lý
 */
const getHistory = async (limit = 50) => {
  const response = await apiClient.get(`/images/history?limit=${limit}`)
  return response.data.data
}

/**
 * Xóa 1 bản ghi lịch sử
 */
const deleteHistory = async (id) => {
  const response = await apiClient.delete(`/images/history/${id}`)
  return response.data
}

export { processImages, getHistory, deleteHistory }