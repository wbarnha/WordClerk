const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'wordclerk-addin.zip');
// Use the manifest from the production build (URLs already replaced by webpack)
const manifestPath = path.join(repoRoot, 'dist', 'manifest.xml');
const distPath = path.join(repoRoot, 'dist');
const assetsPath = path.join(repoRoot, 'assets');

function ensureExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }
}

function createArchive() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    // manifest.xml at the package root, sourced from the production build
    archive.file(manifestPath, { name: 'manifest.xml' });
    archive.directory(distPath, 'dist');
    archive.directory(assetsPath, 'assets');
    // Only the standalone PowerShell installer — no Node.js required by end users
    archive.file(path.join(repoRoot, 'scripts', 'install-wordclerk.ps1'), {
      name: 'installer/install-wordclerk.ps1',
    });
    archive.finalize();
  });
}

async function main() {
  try {
    ensureExists(manifestPath, 'Production manifest (dist/manifest.xml)');
    ensureExists(distPath, 'Build output folder');
    ensureExists(assetsPath, 'Assets folder');

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log('Creating add-in package:', outputPath);
    const bytes = await createArchive();
    console.log(`Created ${outputPath} (${bytes} bytes)`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
