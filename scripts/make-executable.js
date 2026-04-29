// Make the built index.js executable
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'dist', 'index.js');

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf-8');
  
  // Ensure shebang is at the top
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content;
    fs.writeFileSync(indexPath, content);
  }
  
  // Make executable on Unix systems
  if (process.platform !== 'win32') {
    fs.chmodSync(indexPath, '755');
  }
  
  console.log('✓ Made dist/index.js executable');
} else {
  console.error('✗ dist/index.js not found');
  process.exit(1);
}
