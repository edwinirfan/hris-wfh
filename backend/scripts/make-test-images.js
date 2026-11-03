// Membuat gambar uji JPEG 640x480 dengan noise acak (sha256 selalu unik)
const sharp = require('sharp');
const out = process.argv[2];
const n = Number(process.argv[3] || 3);
(async () => {
  for (let i = 1; i <= n; i++) {
    const raw = Buffer.alloc(640 * 480 * 3);
    for (let j = 0; j < raw.length; j++) raw[j] = Math.floor(Math.random() * 256);
    await sharp(raw, { raw: { width: 640, height: 480, channels: 3 } }).jpeg().toFile(`${out}/photo${i}.jpg`);
  }
  await sharp(Buffer.alloc(100 * 80 * 3, 128), { raw: { width: 100, height: 80, channels: 3 } }).jpeg().toFile(`${out}/tiny.jpg`);
  require('fs').writeFileSync(`${out}/fake.jpg`, 'MZ this is not really an image, just text pretending to be one');
})();
