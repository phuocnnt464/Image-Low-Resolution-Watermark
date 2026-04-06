import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

/**
 * @param {File[]}    files
 * @param {string}    resolutionPreset  - 'Original'|'4K'|'QHD'|'FHD'|'HD'|'SD'|'LD'|'Tiny'
 * @param {File|null} watermarkFile
 * @param {string}    watermarkPosition
 */
const processImages = async (files, resolutionPreset = 'FHD', watermarkFile = null, watermarkPosition = 'bottom-left') => {
  const formData = new FormData()
  files.forEach((file) => formData.append('images', file))
  formData.append('resolutionPreset', resolutionPreset)
  formData.append('watermarkPosition', watermarkPosition)

  console.log('API - processImages called with:', 
    formData.getAll('images'),
  )

  if (watermarkFile) {
    formData.append('watermark', watermarkFile)
  }

  const response = await apiClient.post('/images/process', formData, {
    responseType: 'blob',
  })

  return response
}

export { processImages }