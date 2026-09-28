const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function exists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function onPath(command) {
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    return execFileSync(cmd, [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

console.log('=== Verificação do Conversor ===');
console.log(`Node.js: ${process.version}`);

const ytdlp = exists(path.join(root, 'tools', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')) || 
              Boolean(onPath(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'));

console.log(`yt-dlp: ${ytdlp ? 'OK' : 'NÃO ENCONTRADO'}`);
console.log(`FFmpeg: ${onPath('ffmpeg') ? 'OK' : 'NÃO ENCONTRADO'}`);
console.log(`LibreOffice: ${onPath(process.platform === 'win32' ? 'soffice.exe' : 'soffice') ? 'OK' : 'NÃO ENCONTRADO'}`);
console.log('\nA função DOCX → PDF exige LibreOffice no ambiente que executa o servidor.');