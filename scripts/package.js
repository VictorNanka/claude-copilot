#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Temporarily remove yarn files to force vsce to use npm
const yarnLockPath = path.join(__dirname, '..', 'yarn.lock');
const yarnLockBackup = path.join(__dirname, '..', 'yarn.lock.backup');
const yarnDirPath = path.join(__dirname, '..', '.yarn');
const yarnDirBackup = path.join(__dirname, '..', '.yarn.backup');

try {
  // Backup yarn.lock
  if (fs.existsSync(yarnLockPath)) {
    fs.copyFileSync(yarnLockPath, yarnLockBackup);
    fs.unlinkSync(yarnLockPath);
    console.log('Temporarily removed yarn.lock for vsce compatibility');
  }

  // Backup .yarn directory
  if (fs.existsSync(yarnDirPath)) {
    fs.renameSync(yarnDirPath, yarnDirBackup);
    console.log('Temporarily moved .yarn directory for vsce compatibility');
  }

  // Compile first using npm
  console.log('Compiling TypeScript...');
  execSync('npm run compile', { stdio: 'inherit' });
  
  // Run vsce package with explicit npm usage
  console.log('Packaging extension...');
  execSync('npx vsce package --no-yarn', { stdio: 'inherit' });

  console.log('Extension packaged successfully');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
} finally {
  // Restore .yarn directory
  if (fs.existsSync(yarnDirBackup)) {
    fs.renameSync(yarnDirBackup, yarnDirPath);
    console.log('Restored .yarn directory');
  }

  // Restore yarn.lock
  if (fs.existsSync(yarnLockBackup)) {
    fs.copyFileSync(yarnLockBackup, yarnLockPath);
    fs.unlinkSync(yarnLockBackup);
    console.log('Restored yarn.lock');
  }
}