// 1. Importação de bibliotecas e módulos
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const PDFParser = require('pdf2json');
const { Document, Packer, Paragraph, TextRun } = require('docx');

// 2. Inicialização do Express e da porta
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_FILE_SIZE_MB = Math.max(1, Number(process.env.MAX_FILE_SIZE_MB) || 500);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = Math.max(60_000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000);
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 20);
const ALLOWED_MEDIA_DOMAINS = new Set(
  (process.env.ALLOWED_MEDIA_DOMAINS || 'youtube.com,youtu.be,tiktok.com,instagram.com,x.com,twitter.com,facebook.com,fb.watch,vimeo.com,dailymotion.com')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
);

// 3. Definição de caminhos dinâmicos e universais
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const OUTPUTS_DIR = path.join(ROOT, 'outputs');
const TOOLS_DIR = path.join(ROOT, 'tools');

// 4. Garantia de existência das pastas temporárias
for (const dir of [UPLOADS_DIR, OUTPUTS_DIR, TOOLS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const TEMP_FILE_TTL_MS = Math.max(10 * 60 * 1000, Number(process.env.TEMP_FILE_TTL_MS) || 60 * 60 * 1000);
function cleanupOldTemporaryFiles() {
  const cutoff = Date.now() - TEMP_FILE_TTL_MS;
  for (const dir of [UPLOADS_DIR, OUTPUTS_DIR]) {
    try {
      for (const name of fs.readdirSync(dir)) {
        const filePath = path.join(dir, name);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && stats.mtimeMs < cutoff) safeUnlink(filePath);
        } catch (_) {}
      }
    } catch (_) {}
  }
}

// 5. Configurações gerais do Express e do Multer
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

// Executáveis locais e detecção de ambiente 
function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function findOnPath(command) {
  try {
    const result = execFileSync(
      process.platform === 'win32' ? 'where.exe' : 'which',
      [command],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim().split(/\r?\n/)[0];
    return result || null;
  } catch (_) {
    return null;
  }
}

function findExecutable(candidates, pathCommand) {
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }
  return pathCommand ? findOnPath(pathCommand) : null;
}

const ffmpegPath = findExecutable([
  process.env.FFMPEG_PATH,
  process.platform === 'win32' ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe' : null,
  path.join(TOOLS_DIR, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  path.join(TOOLS_DIR, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  path.join(ROOT, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
], 'ffmpeg');

const ytDlpPath = findExecutable([
  process.env.YTDLP_PATH,
  path.join(TOOLS_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
  path.join(ROOT, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
], process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const libreOfficePath = findExecutable([
  process.env.LIBREOFFICE_PATH,
  process.platform === 'win32' ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe' : null,
  '/usr/bin/soffice',
  '/usr/local/bin/soffice'
], process.platform === 'win32' ? 'soffice.exe' : 'soffice');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
console.log(`FFmpeg: ${ffmpegPath || 'não encontrado'}`);
console.log(`yt-dlp: ${ytDlpPath || 'não encontrado'}`);
console.log(`LibreOffice: ${libreOfficePath || 'não encontrado'}`);

// Helpers de validação, limpeza e erros 
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn('Não foi possível remover arquivo temporário:', err.message);
  }
}

function sendFileAndCleanup(res, filePath, downloadName, cleanup = []) {
  res.download(filePath, downloadName, (err) => {
    safeUnlink(filePath);
    cleanup.forEach(safeUnlink);
    if (err && !res.headersSent) {
      res.status(500).send('Erro ao enviar o arquivo convertido.');
    }
  });
}

function isAllowedMediaHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return [...ALLOWED_MEDIA_DOMAINS].some(domain => host === domain || host.endsWith(`.${domain}`));
}

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

async function validateMediaUrl(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (!isAllowedMediaHostname(u.hostname)) return false;

    const addresses = await dns.lookup(u.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(entry => isPrivateIp(entry.address))) return false;
    return true;
  } catch (_) {
    return false;
  }
}

const rateLimitBuckets = new Map();
function heavyRequestRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = rateLimitBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now >= current.resetAt) {
    current.count = 0;
    current.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  current.count += 1;
  rateLimitBuckets.set(key, current);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - current.count));

  if (current.count > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).send('Muitas solicitações. Tente novamente mais tarde.');
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    if (now >= bucket.resetAt) rateLimitBuckets.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

cleanupOldTemporaryFiles();
setInterval(cleanupOldTemporaryFiles, TEMP_FILE_TTL_MS).unref();

function ffmpegErrorMessage(err) {
  const text = String(err?.message || err || '');
  if (/ffmpeg.*not found|spawn.*ffmpeg|ENOENT/i.test(text)) return 'O processamento precisa do FFmpeg configurado no servidor.';
  return 'Não foi possível processar esta mídia.';
}

function mediaErrorMessage(error) {
  const text = String(error?.message || error || '');
  const lower = text.toLowerCase();
  if (!ytDlpPath) return 'O download de links precisa do yt-dlp configurado no servidor.';
  if (/private|members.?only|sign in|login required|age.?restricted/i.test(text)) return 'Este conteúdo possui restrição de acesso e não pode ser processado sem autenticação.';
  if (/429|too many requests|rate.?limit/i.test(text)) return 'A plataforma limitou temporariamente as requisições. Tente novamente mais tarde.';
  if (/ffmpeg|postprocess|merg/i.test(lower)) return 'O processamento deste formato precisa do FFmpeg.';
  return `Não foi possível obter esta mídia. ${text.slice(0, 500)}`;
}

// Rotas da Aplicação

app.get('/', (req, res) => {
  res.send('Servidor do Conversor Full-Stack rodando com sucesso!');
});

// Rota de conversão de vídeo para MP3
app.post('/converter-mp3', heavyRequestRateLimit, upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }
  if (!ffmpegPath) {
    safeUnlink(req.file.path);
    return res.status(503).send('O FFmpeg não está configurado no servidor.');
  }

  const inputPath = `${req.file.path}${path.extname(req.file.originalname || '') || '.mp4'}`;
  const outputPath = path.join(OUTPUTS_DIR, `${crypto.randomUUID()}.mp3`);
  fs.renameSync(req.file.path, inputPath);

  ffmpeg(inputPath)
    .output(outputPath)
    .noVideo()
    .audioCodec('libmp3lame')
    .audioBitrate('192k')
    .on('end', () => {
      sendFileAndCleanup(res, outputPath, 'convertido.mp3', [inputPath]);
    })
    .on('error', (err) => {
      console.error('Erro no FFmpeg:', err);
      safeUnlink(inputPath);
      safeUnlink(outputPath);
      if (!res.headersSent) {
        res.status(500).send(ffmpegErrorMessage(err));
      }
    })
    .run();
});

// Áudio -> áudio (MP3, WAV, FLAC) e vídeo -> áudio
// Áudio -> áudio (MP3, WAV, FLAC) e vídeo -> áudio
const AUDIO_OUTPUTS = {
  mp3: {
    extension: 'mp3',
    codec: 'libmp3lame',
    extra: cmd => cmd.audioBitrate('192k')
  },
  wav: {
    extension: 'wav',
    codec: 'pcm_s16le',
    extra: cmd => cmd
  },
  flac: {
    extension: 'flac',
    codec: 'flac',
    extra: cmd => cmd
  }
};

const AUDIO_INPUTS = ['mp4', 'mp3', 'wav', 'flac'];

app.post('/converter-audio', heavyRequestRateLimit, upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo de mídia enviado.');
  }

  if (!ffmpegPath) {
    safeUnlink(req.file.path);
    return res.status(503).send('O FFmpeg não está configurado no servidor.');
  }

  // O formato de entrada agora é descoberto automaticamente
  // através da extensão do arquivo enviado.
  const originalExtension = path
    .extname(req.file.originalname || '')
    .toLowerCase();

  const inputFormat = originalExtension.replace('.', '');
  const outputFormat = String(req.body.outputFormat || '').toLowerCase();

  const config = AUDIO_OUTPUTS[outputFormat];

  if (!AUDIO_INPUTS.includes(inputFormat)) {
    safeUnlink(req.file.path);
    return res.status(400).send(
      'Formato de entrada inválido. Use MP4, MP3, WAV ou FLAC.'
    );
  }

  if (!config) {
    safeUnlink(req.file.path);
    return res.status(400).send(
      'Formato de saída inválido. Use MP3, WAV ou FLAC.'
    );
  }

  // O multer salva o arquivo temporariamente sem extensão.
  // Aqui adicionamos a extensão real identificada automaticamente.
  const inputPath = `${req.file.path}.${inputFormat}`;

  const outputPath = path.join(
    OUTPUTS_DIR,
    `${crypto.randomUUID()}-audio.${config.extension}`
  );

  fs.renameSync(req.file.path, inputPath);

  let command = ffmpeg(inputPath)
    .noVideo()
    .audioCodec(config.codec);

  command = config.extra(command).output(outputPath);

  command
    .on('end', () => {
      sendFileAndCleanup(
        res,
        outputPath,
        `audio-convertido.${config.extension}`,
        [inputPath]
      );
    })
    .on('error', (err) => {
      console.error('Áudio:', err);

      safeUnlink(inputPath);
      safeUnlink(outputPath);

      if (!res.headersSent) {
        res.status(500).send(ffmpegErrorMessage(err));
      }
    })
    .run();
});

// Imagens 
const IMAGE_FORMATS = {
  jpeg: { extension: 'jpg', apply: (p, q) => p.jpeg({ quality: q, mozjpeg: true }) },
  jpg: { extension: 'jpg', apply: (p, q) => p.jpeg({ quality: q, mozjpeg: true }) },
  png: { extension: 'png', apply: (p, q) => p.png({ compressionLevel: Math.max(0, Math.min(9, Math.round((100 - q) / 11))) }) },
  webp: { extension: 'webp', apply: (p, q) => p.webp({ quality: q }) },
  avif: { extension: 'avif', apply: (p, q) => p.avif({ quality: q }) },
  tiff: { extension: 'tiff', apply: (p, q) => p.tiff({ quality: q }) },
  gif: { extension: 'gif', apply: p => p.gif() }
};

app.post('/converter-imagem', heavyRequestRateLimit, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo enviado.');
  }

  const inputPath = req.file.path;
  const targetFormat = String(req.body.format || '').toLowerCase();
  const config = IMAGE_FORMATS[targetFormat];
  const quality = Math.max(1, Math.min(100, Number(req.body.quality) || 90));

  if (!config) {
    safeUnlink(inputPath);
    return res.status(400).send('Formato de imagem inválido.');
  }

  const outputPath = path.join(OUTPUTS_DIR, `${crypto.randomUUID()}-imagem.${config.extension}`);

  try {
    let pipeline = sharp(inputPath, { animated: true });
    pipeline = config.apply(pipeline, quality);

    await pipeline.toFile(outputPath);
    sendFileAndCleanup(res, outputPath, `imagem-convertida.${config.extension}`, [inputPath]);
  } catch (error) {
    console.error('Erro no Sharp:', error);
    safeUnlink(inputPath);
    safeUnlink(outputPath);
    if (!res.headersSent) {
      res.status(500).send('Erro durante o processamento da imagem.');
    }
  }
});

// PDF para DOCX (Usando pdf2json e docx) 
function convertPdfToDocxNode(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(this, 1);

    pdfParser.on("pdfParser_dataError", errParser => {
      reject(new Error(errParser.parserError || 'Erro ao ler o PDF.'));
    });

    pdfParser.on("pdfParser_dataReady", async () => {
      try {
        const rawText = pdfParser.getRawTextContent();
        const paragraphsText = rawText.split('\n');
        const docParagraphs = paragraphsText.map(line => {
          return new Paragraph({
            children: [new TextRun(line)],
          });
        });

        const doc = new Document({
          sections: [{ properties: {}, children: docParagraphs }],
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        resolve(outputPath);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.loadPDF(inputPath);
  });
}

app.post('/converter-pdf', heavyRequestRateLimit, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum arquivo enviado.');
  const originalExt = path.extname(req.file.originalname || '').toLowerCase();
  if (originalExt !== '.pdf') { 
    safeUnlink(req.file.path); 
    return res.status(400).send('Envie um arquivo PDF.'); 
  }

  const inputPath = `${req.file.path}.pdf`;
  fs.renameSync(req.file.path, inputPath);

  const base = path.basename(inputPath, '.pdf');
  const docxPath = path.join(OUTPUTS_DIR, `${base}.docx`);

  try {
    await convertPdfToDocxNode(inputPath, docxPath);
    sendFileAndCleanup(res, docxPath, `${path.basename(req.file.originalname, '.pdf')}.docx`, [inputPath]);
  } catch (error) {
    console.error('PDF -> DOCX:', error);
    safeUnlink(inputPath);
    if (!res.headersSent) {
      return res.status(500).send('Erro ao converter o PDF para DOCX.');
    }
  }
});

// DOCX -> PDF com LibreOffice 
function convertDocxToPdf(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!libreOfficePath) return reject(new Error('LibreOffice não encontrado.'));
    const child = spawn(libreOfficePath, [
      '--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputPath
    ], { windowsHide: true });
    let output = '';
    let timer = setTimeout(() => { child.kill(); reject(new Error('A conversão do DOCX demorou demais.')); }, 120000);
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(output || `LibreOffice terminou com código ${code}`));
      const base = path.basename(inputPath, path.extname(inputPath));
      const pdfPath = path.join(outputDir, `${base}.pdf`);
      if (!fileExists(pdfPath)) return reject(new Error('O LibreOffice não gerou o PDF esperado.'));
      resolve(pdfPath);
    });
  });
}

app.post('/converter-docx-pdf', heavyRequestRateLimit, upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).send('Nenhum documento enviado.');
  const originalExt = path.extname(req.file.originalname || '').toLowerCase();
  if (originalExt !== '.docx') { safeUnlink(req.file.path); return res.status(400).send('Envie um arquivo DOCX.'); }

  const inputPath = `${req.file.path}.docx`;
  fs.renameSync(req.file.path, inputPath);
  try {
    const pdfPath = await convertDocxToPdf(inputPath, OUTPUTS_DIR);
    sendFileAndCleanup(res, pdfPath, `${path.basename(req.file.originalname, '.docx')}.pdf`, [inputPath]);
  } catch (error) {
    console.error('DOCX -> PDF:', error);
    safeUnlink(inputPath);
    if (!res.headersSent) {
      if (/LibreOffice não encontrado/.test(error.message)) return res.status(503).send('O conversor de documentos precisa do LibreOffice configurado no servidor.');
      return res.status(500).send('Não foi possível converter este DOCX para PDF. Verifique se o documento é válido.');
    }
  }
});

//  Links de redes sociais (yt-dlp) 
function runYtDlpUniversal(url, mode) {
  return new Promise((resolve, reject) => {
    if (!ytDlpPath) return reject(new Error('yt-dlp não encontrado.'));
    if (!ffmpegPath) return reject(new Error('FFmpeg não encontrado.'));
    const id = crypto.randomUUID();
    const extension = mode === 'audio' ? 'mp3' : 'mp4';
    const outputTemplate = path.join(OUTPUTS_DIR, `${id}-media.%(ext)s`);
    const args = ['--no-playlist', '--no-warnings', '--newline', '--no-update', '--ffmpeg-location', path.dirname(ffmpegPath), '-o', outputTemplate];
    if (mode === 'audio') args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '192K');
    else args.push('-f', 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b', '--merge-output-format', 'mp4');
    args.push(url);

    const child = spawn(ytDlpPath, args, { windowsHide: true });
    let stderr = '', stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      const prefix = `${id}-media.`;
      const files = fs.readdirSync(OUTPUTS_DIR).filter(n => n.startsWith(prefix)).map(n => path.join(OUTPUTS_DIR, n)).filter(fileExists);
      if (code !== 0) { files.forEach(safeUnlink); return reject(new Error(stderr || stdout || `yt-dlp terminou com código ${code}`)); }
      const preferred = files.find(file => path.extname(file).toLowerCase() === `.${extension}`) || files[0];
      if (!preferred) return reject(new Error('Nenhum arquivo foi gerado.'));
      resolve(preferred);
    });
  });
}

async function handleMediaDownload(req, res, mode) {
  const url = String(req.body?.url || '').trim();
  if (!(await validateMediaUrl(url))) {
    return res.status(400).send('URL inválida ou plataforma não permitida.');
  }
  try {
    const outputPath = await runYtDlpUniversal(url, mode);
    sendFileAndCleanup(res, outputPath, mode === 'audio' ? 'audio-baixado.mp3' : 'video-baixado.mp4');
  } catch (error) {
    console.error('Download web:', error);
    return res.status(502).send(mediaErrorMessage(error));
  }
}

app.post('/baixar-url', heavyRequestRateLimit, (req, res) => handleMediaDownload(req, res, 'audio'));
app.post('/baixar-video-web', heavyRequestRateLimit, (req, res) => handleMediaDownload(req, res, 'video'));
app.post('/baixar-video-youtube', heavyRequestRateLimit, (req, res) => handleMediaDownload(req, res, 'video'));

// Tratamento de erros global 
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).send(`Arquivo muito grande. Limite: ${MAX_FILE_SIZE_MB} MB.`);
  if (!res.headersSent) res.status(500).send('Erro interno do servidor.');
});

// Inicialização do servidor 
app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
  console.log(`FFmpeg: ${ffmpegPath ? 'OK' : 'não encontrado'}`);
  console.log(`yt-dlp: ${ytDlpPath ? 'OK' : 'não encontrado'}`);
  console.log(`LibreOffice: ${libreOfficePath ? 'OK' : 'não encontrado'}`);
});