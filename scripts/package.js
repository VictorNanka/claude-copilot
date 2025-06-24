#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Temporarily remove bun files to force vsce to use npm/ignore deps
const bunLockPath = path.join(__dirname, '..', 'bun.lockb');
const bunLockBackup = path.join(__dirname, '..', 'bun.lockb.backup');

try {
  // Backup bun.lockb
  if (fs.existsSync(bunLockPath)) {
    fs.copyFileSync(bunLockPath, bunLockBackup);
    fs.unlinkSync(bunLockPath);
    console.log('Temporarily removed bun.lockb for vsce compatibility');
  }

  // Compile first using bun
  console.log('Compiling TypeScript...');
  execSync('bun run compile', { stdio: 'inherit' });

  // Run vsce package with dependency checking disabled
  console.log('Packaging extension...');
  execSync('npx vsce package --no-yarn --no-dependencies', { stdio: 'inherit' });

  console.log('Extension packaged successfully');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
} finally {
  // Restore bun.lockb
  if (fs.existsSync(bunLockBackup)) {
    fs.copyFileSync(bunLockBackup, bunLockPath);
    fs.unlinkSync(bunLockBackup);
    console.log('Restored bun.lockb');
  }
}
