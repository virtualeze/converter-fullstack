document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.mode-panel');

  const progressRing = document.getElementById('progressRing');
  const progressValue = document.getElementById('progressValue');
  const progressStatus = document.getElementById('progressStatus');
  const progressFile = document.getElementById('progressFile');

  function updateProgress(percent, status = '', fileName = '', processing = false) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

    if (progressRing) {
      progressRing.style.setProperty('--progress', `${safePercent}%`);
      progressRing.classList.toggle('processing', processing);
    }

    if (progressValue) progressValue.textContent = `${safePercent}%`;
    if (progressStatus && status) progressStatus.textContent = status;
    if (progressFile) progressFile.textContent = fileName || '';
  }

  function resetProgress() {
    updateProgress(0, 'Aguardando novo arquivo', '', false);
  }

  function completeProgress(message = 'Conversão concluída!') {
    updateProgress(100, message, 'Arquivo pronto para download.', false);
  }

  function errorProgress(message) {
    updateProgress(0, 'Ocorreu um erro.', message, false);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;

      tabs.forEach(item => item.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));

      tab.classList.add('active');

      const targetPanel = document.getElementById(target);
      if (targetPanel) targetPanel.classList.add('active');

      resetProgress();
    });
  });

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let index = 0;

    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index++;
    }

    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function showSelectedFile(input) {
    const file = input?.files?.[0];
    if (!file) return;

    const dropzone = input.closest('.dropzone');
    if (!dropzone) return;

    const title = dropzone.querySelector('.drop-title');
    const subtitle = dropzone.querySelector('.drop-subtitle');
    const fileName = dropzone.querySelector('.file-name');

    if (title) title.textContent = 'Arquivo selecionado';
    if (subtitle) subtitle.textContent = `${formatFileSize(file.size)} • pronto para converter`;
    if (fileName) fileName.textContent = file.name;

    progressFile.textContent = file.name;
    progressStatus.textContent = 'Arquivo selecionado';
  }

  document.querySelectorAll('.dropzone input[type="file"]').forEach(input => {
    input.addEventListener('change', () => showSelectedFile(input));
  });

  function getFilenameFromResponse(response, fallbackName) {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return fallbackName;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1].replace(/^["']|["']$/g, ''));
      } catch (_) {}
    }

    const normalMatch = disposition.match(/filename="?([^";]+)"?/i);
    return normalMatch?.[1] || fallbackName;
  }

  async function downloadResponse(response, fallbackName) {
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Erro durante o processamento.');
    }

    const blob = await response.blob();
    const filename = getFilenameFromResponse(response, fallbackName);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Usa XMLHttpRequest para mostrar o progresso real do upload.
  // O processamento do servidor continua sendo representado pelos estados
  // "Processando" e "Finalizando" até a resposta chegar.
  function sendFileRequest(endpoint, formData, fallbackName, fileName) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('POST', endpoint, true);
      xhr.responseType = 'blob';

      xhr.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) return;

        const uploadPercent = Math.round((event.loaded / event.total) * 60);
        updateProgress(
          Math.max(5, uploadPercent),
          uploadPercent >= 60 ? 'Processando...' : 'Enviando arquivo...',
          fileName,
          true
        );
      });

      xhr.addEventListener('load', async () => {
        const contentType = xhr.getResponseHeader('Content-Type') || '';

        if (xhr.status < 200 || xhr.status >= 300) {
          let message = 'Erro durante o processamento.';

          if (xhr.response instanceof Blob) {
            try {
              message = await xhr.response.text();
            } catch (_) {}
          }

          reject(new Error(message || 'Erro durante o processamento.'));
          return;
        }

        updateProgress(85, 'Finalizando...', fileName, true);

        const blob = xhr.response;
        const disposition = xhr.getResponseHeader('Content-Disposition');
        let filename = fallbackName;

        if (disposition) {
          const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
          const normalMatch = disposition.match(/filename="?([^";]+)"?/i);

          try {
            if (utf8Match?.[1]) {
              filename = decodeURIComponent(utf8Match[1].replace(/^["']|["']$/g, ''));
            } else if (normalMatch?.[1]) {
              filename = normalMatch[1];
            }
          } catch (_) {}
        }

        // Se o servidor responder texto em uma requisição que deveria gerar
        // arquivo, informa um erro em vez de baixar uma resposta inválida.
        
        if (contentType.startsWith('text/') && blob.size < 2 * 1024 * 1024) {
          try {
            const text = await blob.text();
            reject(new Error(text || 'O servidor retornou uma resposta inválida.'));
            return;
          } catch (_) {}
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Não foi possível conectar ao servidor.'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('O envio foi cancelado.'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('A solicitação demorou demais para responder.'));
      });

      xhr.timeout = 0;
      xhr.send(formData);
    });
  }

  async function submitFileConversion({
    endpoint,
    formData,
    fallbackName,
    fileName
  }) {
    try {
      updateProgress(5, 'Preparando arquivo...', fileName, true);

      await sendFileRequest(
        endpoint,
        formData,
        fallbackName,
        fileName
      );

      completeProgress();
    } catch (error) {
      console.error(error);
      errorProgress(error.message || 'Erro durante a conversão.');
    }
  }

  // Áudio
  const audioFile = document.getElementById('audioFile');
  const audioBtn = document.getElementById('audioBtn');
  const audioOutputFormat = document.getElementById('audioOutputFormat');

  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      if (!audioFile?.files?.length) {
        errorProgress('Selecione um arquivo de áudio ou vídeo.');
        return;
      }

      if (!audioOutputFormat?.value) {
        errorProgress('Selecione o formato final.');
        return;
      }

      const file = audioFile.files[0];
      const formData = new FormData();

      formData.append('audio', file);
      formData.append('outputFormat', audioOutputFormat.value);

      submitFileConversion({
        endpoint: '/converter-audio',
        formData,
        fallbackName: `audio-convertido.${audioOutputFormat.value}`,
        fileName: file.name
      });
    });
  }

  // Imagem
  const imageFile = document.getElementById('imageFile');
  const imageBtn = document.getElementById('imageBtn');
  const imageFormat = document.getElementById('imageFormat');

  if (imageBtn) {
    imageBtn.addEventListener('click', () => {
      if (!imageFile?.files?.length) {
        errorProgress('Selecione uma imagem antes de continuar.');
        return;
      }

      const file = imageFile.files[0];
      const formData = new FormData();

      formData.append('image', file);
      formData.append('format', imageFormat?.value || 'jpeg');

      submitFileConversion({
        endpoint: '/converter-imagem',
        formData,
        fallbackName: `imagem-convertida.${imageFormat?.value === 'jpeg' ? 'jpg' : imageFormat?.value || 'jpg'}`,
        fileName: file.name
      });
    });
  }

  // PDF -> DOCX
  const docFile = document.getElementById('docFile');
  const docBtn = document.getElementById('docBtn');

  if (docBtn) {
    docBtn.addEventListener('click', () => {
      if (!docFile?.files?.length) {
        errorProgress('Selecione um arquivo PDF antes de continuar.');
        return;
      }

      const file = docFile.files[0];
      const formData = new FormData();
      formData.append('pdf', file);

      const baseName = file.name.replace(/\.[^/.]+$/, '') || 'documento';

      submitFileConversion({
        endpoint: '/converter-pdf',
        formData,
        fallbackName: `${baseName}.docx`,
        fileName: file.name
      });
    });
  }

  // DOCX -> PDF
  const docxFile = document.getElementById('docxFile');
  const docxBtn = document.getElementById('docxBtn');

  if (docxBtn) {
    docxBtn.addEventListener('click', () => {
      if (!docxFile?.files?.length) {
        errorProgress('Selecione um arquivo DOCX antes de continuar.');
        return;
      }

      const file = docxFile.files[0];
      const formData = new FormData();
      formData.append('document', file);

      const baseName = file.name.replace(/\.[^/.]+$/, '') || 'documento';

      submitFileConversion({
        endpoint: '/converter-docx-pdf',
        formData,
        fallbackName: `${baseName}.pdf`,
        fileName: file.name
      });
    });
  }

  // Download por URL
  async function downloadFromUrl(mode) {
    const urlInput = document.getElementById('videoUrl');
    const url = urlInput?.value.trim();

    if (!url) {
      errorProgress('Cole um link antes de continuar.');
      return;
    }

    try {
      updateProgress(
        10,
        'Validando o link...',
        url,
        true
      );

      const response = await fetch(
        mode === 'video' ? '/baixar-video-web' : '/baixar-url',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        }
      );

      updateProgress(
        75,
        'Finalizando...',
        'Preparando seu arquivo.',
        true
      );

      await downloadResponse(
        response,
        mode === 'video' ? 'video-baixado.mp4' : 'audio-baixado.mp3'
      );

      completeProgress('Download concluído!');
    } catch (error) {
      console.error(error);
      errorProgress(error.message || 'Não foi possível baixar a mídia.');
    }
  }

  const webAudioBtn = document.getElementById('webAudioBtn');
  const webVideoBtn = document.getElementById('webVideoBtn');

  webAudioBtn?.addEventListener('click', () => downloadFromUrl('audio'));
  webVideoBtn?.addEventListener('click', () => downloadFromUrl('video'));

  resetProgress();
});
