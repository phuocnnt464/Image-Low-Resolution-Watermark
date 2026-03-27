const archiver = require('archiver')
const fs       = require('fs')
const path     = require('path')

/**
 * Đóng gói danh sách file vào một file ZIP
 * @param {string[]} filePaths    - Mảng đường dẫn file thực trên disk
 * @param {string}   outputPath  - Đường dẫn file ZIP đầu ra
 * @param {string[]} [entryNames] - Tên hiển thị từng file trong ZIP (tùy chọn)
 *                                  Nếu không truyền → dùng basename của filePath
 */
const createZip = (filePaths, outputPath, entryNames = []) => {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(outputPath))
    archive.on('error', reject)

    archive.pipe(output)
    filePaths.forEach((fp, i) => {
      const name = entryNames[i] || path.basename(fp)  // dùng tên gốc nếu có
      archive.file(fp, { name })
    })
    archive.finalize()
  })
}

module.exports = { createZip }