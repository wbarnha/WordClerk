const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const archiver = require('archiver');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const manifestPath = path.join(distDir, 'manifest.xml');
const outputPath = path.join(repoRoot, 'wordclerk-addin-offline.zip');

function ensureExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found: ${filePath}`);
  }
}

function buildWithLocalhostPlaceholders() {
  // {{PORT}}/{{SECRET}} are literal tokens -- webpack's manifest transform does a plain
  // string substitution, so they pass through untouched and get filled in for real by
  // setup-local-server.ps1 at install time (see scripts/local-server/).
  const env = { ...process.env, WORDCLERK_HOST_URL: 'https://localhost:{{PORT}}/' };
  const result = spawnSync('npx', ['webpack', '--mode', 'production'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error('webpack build (offline placeholders) failed');
  }
}

function addSecretToUrls(manifestXml) {
  // Append ?k={{SECRET}} to every URL that points at our own localhost placeholder host,
  // so the local server can authorize requests. See serve-wordclerk.ps1 for the check.
  return manifestXml.replace(
    /(https:\/\/localhost:\{\{PORT\}\}\/[^"]*)"/g,
    (match, url) => `${url}?k={{SECRET}}"`
  );
}

function createArchive() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    const manifestXml = addSecretToUrls(fs.readFileSync(manifestPath, 'utf8'));
    archive.append(manifestXml, { name: 'manifest.xml' });

    // The full static build -- this is what the local server serves from disk.
    archive.directory(distDir, 'app');

    archive.file(path.join(repoRoot, 'scripts', 'local-server', 'serve-wordclerk.ps1'), {
      name: 'installer/serve-wordclerk.ps1',
    });
    archive.file(path.join(repoRoot, 'scripts', 'local-server', 'setup-local-server.ps1'), {
      name: 'installer/setup-local-server.ps1',
    });

    archive.finalize();
  });
}

async function main() {
  try {
    buildWithLocalhostPlaceholders();
    ensureExists(manifestPath, 'Production manifest (dist/manifest.xml)');

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log('Creating offline add-in package:', outputPath);
    const bytes = await createArchive();
    console.log(`Created ${outputPath} (${bytes} bytes)`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
