const fs = require('fs');
const path = require('path');

async function convert() {
  const sharp = require('sharp');
  const repoRoot = path.resolve(__dirname, '..');
  const src = path.join(repoRoot, 'dist', 'assets', 'logo-filled.svg');
  const sizes = [16, 32, 80];
  const targets = [];
  for (const size of sizes) {
    targets.push({
      out: path.join(repoRoot, 'assets', `logo-filled-${size}.png`),
      size,
    });
    targets.push({
      out: path.join(repoRoot, 'dist', 'assets', `logo-filled-${size}.png`),
      size,
    });
  }

  if (!fs.existsSync(src)) {
    console.error('Source SVG not found:', src);
    process.exit(1);
  }

  try {
    // Read SVG buffer
    const svgBuffer = fs.readFileSync(src);

    // Render and write PNGs at multiple sizes
    for (const target of targets) {
      const dir = path.dirname(target.out);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      await sharp(svgBuffer)
        .resize(target.size, target.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(target.out);

      console.log('Wrote', target.out);
    }

    console.log('Logo conversion complete.');
  } catch (err) {
    console.error('Conversion failed:', err);
    process.exit(1);
  }
}

convert();
