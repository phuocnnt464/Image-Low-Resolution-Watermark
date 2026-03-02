const archiver = require('archiver');
const fs       = require('fs');
const path     = require('path');

/**
 * Đóng gói danh sách file vào một file ZIP
 * @param {string[]} filePaths  - Mảng đường dẫn file cần nén
 * @param {string}   outputPath - Đường dẫn file ZIP đầu ra
 */
const createZip = (filePaths, outputPath) => {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);

    archive.pipe(output);
    filePaths.forEach((fp) => {
      archive.file(fp, { name: path.basename(fp) });
    });
    archive.finalize();
  });
};

module.exports = { createZip };