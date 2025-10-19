#!/usr/bin/env node

/**
 * Amplify Hosting Adapter for Angular SSR
 * This script transforms Angular SSR build output into Amplify Hosting's expected structure
 */

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'deeplearningblocks');
const amplifyPath = path.join(__dirname, '..', '.amplify-hosting');

console.log('🚀 Starting Amplify Hosting adapter for Angular SSR...');

// Clean up existing .amplify-hosting directory
if (fs.existsSync(amplifyPath)) {
  fs.rmSync(amplifyPath, { recursive: true, force: true });
  console.log('✓ Cleaned up existing .amplify-hosting directory');
}

// Create the Amplify directory structure
const staticDir = path.join(amplifyPath, 'static');
const computeDir = path.join(amplifyPath, 'compute', 'default');

fs.mkdirSync(staticDir, { recursive: true });
fs.mkdirSync(computeDir, { recursive: true });
console.log('✓ Created .amplify-hosting directory structure');

// Copy browser assets to static directory
const browserPath = path.join(distPath, 'browser');
if (fs.existsSync(browserPath)) {
  copyRecursive(browserPath, staticDir);
  console.log('✓ Copied browser assets to static directory');

  // Also copy to compute/browser for server.mjs to find
  const computeBrowserDir = path.join(amplifyPath, 'compute', 'browser');
  copyRecursive(browserPath, computeBrowserDir);
  console.log('✓ Copied browser assets to compute/browser for SSR server');
} else {
  console.error('❌ Browser build output not found at:', browserPath);
  process.exit(1);
}

// Copy server files to compute directory
const serverPath = path.join(distPath, 'server');
if (fs.existsSync(serverPath)) {
  copyRecursive(serverPath, computeDir);
  console.log('✓ Copied server files to compute directory');
} else {
  console.error('❌ Server build output not found at:', serverPath);
  process.exit(1);
}

// Don't create a custom entry point, just use Angular's generated server.mjs
// But we need to note that the entrypoint is server.mjs
console.log('✓ Using Angular generated server.mjs as entry point');

// Create deploy-manifest.json
const manifest = {
  version: 1,
  routes: [
    {
      path: '/*.*',
      target: {
        kind: 'Static',
      },
      fallback: {
        kind: 'Compute',
        src: 'default',
      },
    },
    {
      path: '/*',
      target: {
        kind: 'Compute',
        src: 'default',
      },
    },
  ],
  computeResources: [
    {
      name: 'default',
      runtime: 'nodejs20.x',
      entrypoint: 'server.mjs',
    },
  ],
  framework: {
    name: 'angular',
    version: getAngularVersion(),
  },
};

fs.writeFileSync(path.join(amplifyPath, 'deploy-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('✓ Created deploy-manifest.json');

console.log('✅ Amplify Hosting adapter completed successfully!');

// Helper functions
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function getAngularVersion() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );
    return packageJson.dependencies['@angular/core']?.replace(/[^0-9.]/g, '') || '20.0.0';
  } catch (error) {
    return '20.0.0';
  }
}
