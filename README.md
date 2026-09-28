# Conversor full-stack de Mídias

Aplicação web de conversão e processamento de arquivos de mídia,
desenvolvida com **HTML, CSS, JavaScript e Node.js**.

O projeto foi pensado para funcionar de duas formas:

-   **Localmente**, principalmente no Windows, usando os programas
    instalados na máquina.
-   **Em produção**, usando **Docker** para reunir o Node.js e as
    ferramentas externas necessárias em um ambiente reproduzível.

> **Projeto de portfólio sem fins lucrativos.**

------------------------------------------------------------------------

## 1. O que este projeto faz?

O Conversor Full-Stack permite enviar arquivos para uma interface web e
realizar diferentes tipos de conversão.

### Conversões disponíveis

#### Vídeo para áudio

-   Vídeo → MP3

#### Conversões de áudio

-   MP3 → MP3
-   MP4 → MP3
-   MP4 → WAV
-   MP4 → FLAC
-   MP3 → WAV
-   MP3 → FLAC
-   WAV → MP3
-   WAV → FLAC
-   FLAC → MP3
-   FLAC → WAV

A disponibilidade exata das opções é controlada pela interface da
aplicação.

#### Conversão de imagens

A aplicação utiliza a biblioteca **Sharp** e trabalha com formatos como:

-   JPG/JPEG
-   PNG
-   WebP
-   AVIF
-   TIFF
-   GIF

#### Documentos

-   PDF → DOCX
-   DOCX → PDF

#### Download de mídia por URL

O projeto também possui funções para obter mídia a partir de URLs de
plataformas compatíveis com o **yt-dlp**.

Entre os domínios configurados inicialmente estão:

-   YouTube
-   TikTok
-   Instagram
-   X/Twitter
-   Facebook
-   Vimeo
-   Dailymotion

A lista permitida pode ser alterada por variável de ambiente.

------------------------------------------------------------------------

# 2. Como a aplicação funciona?

De forma simplificada, o fluxo é:

``` text
Usuário
   │
   ▼
Interface Web
   │
   ▼
Servidor Node.js / Express
   │
   ├── Imagens ───────► Sharp
   │
   ├── Áudio/Vídeo ───► FFmpeg
   │
   ├── PDF ───────────► pdf2json + docx
   │
   ├── DOCX ──────────► LibreOffice
   │
   └── URLs ──────────► yt-dlp + FFmpeg
   │
   ▼
Arquivo processado
   │
   ▼
Download pelo usuário
```

Os arquivos enviados e os resultados são tratados como **arquivos
temporários**.

Eles ficam nas pastas:

``` text
uploads/
outputs/
```

Depois do envio do resultado, o projeto remove os arquivos temporários
usados naquela operação. Além disso, existe uma rotina de limpeza que
remove arquivos antigos que eventualmente permaneçam nessas pastas.

------------------------------------------------------------------------

# 3. Como usar localmente?

No Windows, depois de extrair o projeto, abra o PowerShell ou Prompt de
Comando dentro da pasta principal.

Exemplo:

``` powershell
cd C:\caminho\para\conversor-fullstack
```

Instale as dependências:

``` powershell
npm ci
```

Depois inicie:

``` powershell
npm start
```

A aplicação ficará disponível em:

``` text
http://localhost:3000
```

Também existe o arquivo:

``` text
iniciar.bat
```

que pode ser utilizado para facilitar a inicialização no Windows.

------------------------------------------------------------------------

# 4. Requisitos para execução local no Windows

Para utilizar todas as funções localmente, é necessário ter:

### Node.js

A versão do projeto exige:

``` text
Node.js 22.23.2 ou superior
```

Verifique com:

``` powershell
node --version
```

### FFmpeg

O FFmpeg é utilizado principalmente para:

-   conversões de áudio;
-   conversões de vídeo;
-   extração de áudio;
-   processamento de mídia obtida pelo yt-dlp.

O servidor tenta localizar o FFmpeg automaticamente.

Ele procura, entre outros locais:

``` text
FFMPEG_PATH
C:\ffmpeg\bin\ffmpeg.exe
C:\Program Files\ffmpeg\bin\ffmpeg.exe
C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe
tools\ffmpeg.exe
PATH do sistema
```

Portanto, não é obrigatório que o comando `ffmpeg` esteja disponível
diretamente no terminal, desde que o executável esteja em um dos locais
reconhecidos ou seja informado por `FFMPEG_PATH`.

### yt-dlp

O yt-dlp é utilizado pelas funções de download por URL.

No Windows, o projeto já possui:

``` text
tools/yt-dlp.exe
```

O servidor procura automaticamente esse arquivo.

O arquivo `setup-ytdlp.bat` também pode ser usado para obter uma versão
atualizada do yt-dlp oficial para Windows.

### LibreOffice

É utilizado para:

``` text
DOCX → PDF
```

O servidor procura automaticamente instalações comuns do LibreOffice ou
pode receber um caminho personalizado por `LIBREOFFICE_PATH`.

------------------------------------------------------------------------

# 5. Dependências do Node.js

As principais bibliotecas utilizadas são:

  Biblioteca      Função
  --------------- --------------------------------------
  Express         Servidor web e API
  Multer          Recebimento de arquivos enviados
  Sharp           Conversão e processamento de imagens
  fluent-ffmpeg   Integração do Node.js com FFmpeg
  pdf2json        Leitura de conteúdo de PDFs
  docx            Geração de arquivos DOCX

As dependências ficam declaradas em:

``` text
package.json
```

O projeto também possui o comando de verificação local:

``` powershell
npm run check
```

Ele verifica Node.js e a presença das ferramentas externas esperadas no ambiente.

e suas versões exatas/compatíveis são registradas em:

``` text
package-lock.json
```

Por isso, uma instalação limpa pode ser feita com:

``` powershell
npm ci
```

Não é necessário distribuir a pasta `node_modules`.

------------------------------------------------------------------------

# 6. Por que `node_modules` não vem no projeto?

A pasta `node_modules` contém as dependências instaladas pelo npm.

Ela pode ocupar bastante espaço e depende do ambiente operacional.

Por isso, ela **não deve ser incluída no repositório ou no pacote de
distribuição**.

Quem receber o projeto deve executar:

``` powershell
npm ci
```

O npm instalará novamente as dependências descritas no
`package-lock.json`.

------------------------------------------------------------------------

# 7. O que são `uploads` e `outputs`?

Essas pastas fazem parte da estrutura da aplicação.

``` text
uploads/
└── .gitkeep

outputs/
└── .gitkeep
```

### `uploads`

Recebe temporariamente os arquivos enviados pelo usuário.

### `outputs`

Recebe temporariamente os arquivos processados.

O `.gitkeep` existe apenas para que as pastas possam permanecer no
projeto mesmo quando estiverem vazias.

**Não remova essas pastas da estrutura do projeto.**

Os arquivos temporários que aparecerem nelas durante o uso não precisam
ser enviados para um repositório.

------------------------------------------------------------------------

# 8. Arquivo `.env.example`

O projeto possui:

``` text
.env.example
```

Esse arquivo **deve ser mantido**.

Ele funciona como um modelo para as configurações disponíveis.

Se for necessário personalizar a execução local, copie:

``` text
.env.example
```

para:

``` text
.env
```

O arquivo `.env` é destinado às configurações da máquina/ambiente e não
deve ser publicado quando contiver informações privadas.

------------------------------------------------------------------------

# 9. Principais configurações

O `.env.example` contém configurações como:

  ------------------------------------------------------------------------------
  Variável                    Finalidade                            Valor padrão
  --------------------------- --------------------- ----------------------------
  `PORT`                      Porta do servidor                           `3000`

  `HOST`                      Interface de rede                        `0.0.0.0`

  `MAX_FILE_SIZE_MB`          Limite dos uploads                           `500`

  `TEMP_FILE_TTL_MS`          Tempo de retenção dos                    `3600000`
                              temporários           

  `RATE_LIMIT_WINDOW_MS`      Janela do limite de                       `600000`
                              requisições           

  `RATE_LIMIT_MAX_REQUESTS`   Número máximo de                              `20`
                              operações pesadas     

  `FFMPEG_PATH`               Caminho personalizado                   automático
                              do FFmpeg             

  `YTDLP_PATH`                Caminho personalizado                   automático
                              do yt-dlp             

  `LIBREOFFICE_PATH`          Caminho personalizado                   automático
                              do LibreOffice        

  `ALLOWED_MEDIA_DOMAINS`     Domínios permitidos              lista configurada
                              para URLs             
  ------------------------------------------------------------------------------

Por exemplo:

``` env
PORT=3000
HOST=0.0.0.0
MAX_FILE_SIZE_MB=500
```

------------------------------------------------------------------------

# 10. Por que o servidor usa `0.0.0.0`?

O valor:

``` text
0.0.0.0
```

não é o endereço que normalmente deve ser digitado no navegador.

Ele significa que o servidor deve aceitar conexões em todas as
interfaces de rede disponíveis.

Para acessar localmente, utilize:

``` text
http://localhost:3000
```

ou:

``` text
http://127.0.0.1:3000
```

Essa configuração também é importante para ambientes de hospedagem e
containers.

------------------------------------------------------------------------

# 11. Health check

A aplicação possui a rota:

``` text
GET /health
```

Ela pode ser acessada em:

``` text
http://localhost:3000/health
```

Quando o servidor está funcionando corretamente, a resposta é:

``` json
{
  "status": "ok"
}
```

Essa rota também pode ser utilizada por plataformas de hospedagem e pelo
Docker para verificar se a aplicação está viva.

------------------------------------------------------------------------

# 12. Segurança básica implementada

O projeto possui algumas proteções para um primeiro ambiente de
produção.

### Limite de upload

O tamanho máximo padrão é:

``` text
500 MB
```

Esse valor pode ser alterado por:

``` env
MAX_FILE_SIZE_MB=500
```

### Limitação de requisições

Operações pesadas possuem um limite por endereço IP.

O padrão é:

``` text
20 operações
a cada 10 minutos
```

Isso ajuda a evitar uso excessivo dos recursos do servidor.

### Validação de URLs

As funções de download por URL não aceitam qualquer endereço HTTP/HTTPS.

O servidor verifica:

1.  o protocolo;
2.  se o domínio está na lista permitida;
3.  o endereço IP resolvido pelo domínio;
4.  se o endereço não pertence a faixas privadas ou locais.

Isso reduz o risco de a função de download ser utilizada para acessar
serviços internos do servidor.

### Observação

Essas proteções são uma base de segurança, não uma garantia de segurança
absoluta. Um serviço público de grande escala deve utilizar também
controles de infraestrutura, firewall, limites de recursos,
observabilidade e outras medidas apropriadas.

------------------------------------------------------------------------

# 13. Download por URL

O projeto utiliza o **yt-dlp** para obter mídia de plataformas
compatíveis.

A aplicação não permite simplesmente qualquer URL.

Os domínios permitidos são configurados por:

``` env
ALLOWED_MEDIA_DOMAINS=
```

Para adicionar uma plataforma, é possível alterar essa variável.

Por exemplo:

``` env
ALLOWED_MEDIA_DOMAINS=youtube.com,youtu.be,tiktok.com,vimeo.com
```

A compatibilidade depende do próprio yt-dlp e das mudanças realizadas
pelas plataformas externas. Uma plataforma pode alterar seu
funcionamento e fazer com que determinado tipo de URL deixe de funcionar
até que o yt-dlp seja atualizado.

Também é responsabilidade do usuário possuir autorização para baixar ou
converter o conteúdo utilizado.

------------------------------------------------------------------------

# 14. Docker: o que é?

Docker permite executar a aplicação dentro de um **container** com um
ambiente previamente definido.

Isso é especialmente útil neste projeto porque ele não depende somente
do Node.js.

Além das bibliotecas npm, o sistema precisa de programas externos:

``` text
Node.js
FFmpeg
yt-dlp
LibreOffice
```

Sem Docker, cada máquina/servidor precisa ter esses componentes
configurados corretamente.

Com Docker, o projeto descreve no `Dockerfile` como criar um ambiente
contendo essas dependências.

------------------------------------------------------------------------

# 15. O que o `Dockerfile` faz?

O arquivo:

``` text
Dockerfile
```

é uma receita para construir a imagem do projeto.

Ele utiliza:

``` dockerfile
FROM node:22-bookworm-slim
```

Isso fornece um ambiente Linux com Node.js 22.

Depois, instala:

``` text
FFmpeg
LibreOffice
yt-dlp
```

Em seguida:

1.  define a pasta `/app`;
2.  copia `package.json` e `package-lock.json`;
3.  executa `npm ci --omit=dev`;
4.  copia os arquivos da aplicação;
5.  cria `uploads/` e `outputs/`;
6.  ajusta as permissões;
7.  executa o container com um usuário sem privilégios de root;
8.  expõe a porta `3000`;
9.  configura um health check;
10. inicia o servidor com `npm start`.

Assim, o container possui as principais ferramentas necessárias para
executar a aplicação sem depender das instalações do computador
hospedeiro.

------------------------------------------------------------------------

# 16. Como usar o Docker

É necessário ter o Docker instalado.

Na pasta do projeto, execute:

``` bash
docker build -t conversor-fullstack .
```

Esse comando cria uma imagem chamada:

``` text
conversor-fullstack
```

Depois execute:

``` bash
docker run --rm -p 3000:3000 conversor-fullstack
```

Acesse:

``` text
http://localhost:3000
```

Para verificar o health check:

``` text
http://localhost:3000/health
```

------------------------------------------------------------------------

# 17. Por que o `Dockerfile` não utiliza o `yt-dlp.exe` do Windows?

O arquivo:

``` text
tools/yt-dlp.exe
```

é um executável para **Windows**.

O Dockerfile cria um ambiente Linux. Por isso, ele instala a versão
apropriada do `yt-dlp` dentro do container:

``` text
apt-get install yt-dlp
```

Da mesma forma, o FFmpeg e o LibreOffice são instalados dentro do
próprio ambiente Linux.

Portanto:

``` text
Windows local
└── tools/yt-dlp.exe

Docker/Linux
└── yt-dlp instalado no container
```

Isso permite que o mesmo projeto tenha uma estratégia para execução
local no Windows e outra para execução em Linux/Docker.

------------------------------------------------------------------------

# 18. Estrutura do projeto

A estrutura principal é:

``` text
conversor-fullstack/
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── scripts/
│   └── check-dependencies.js
│
├── tools/
│   ├── README.md
│   └── yt-dlp.exe
│
├── uploads/
│   └── .gitkeep
│
├── outputs/
│   └── .gitkeep
│
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── iniciar.bat
├── setup-ytdlp.bat
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

### `public/`

Contém a interface que o usuário acessa pelo navegador.

### `server.js`

É o servidor principal da aplicação.

Ele recebe arquivos e URLs, executa os processamentos e devolve os
resultados.

### `tools/`

Contém ferramentas auxiliares para execução local no Windows.

### `uploads/` e `outputs/`

São diretórios temporários de processamento.

### `package.json`

Define informações do projeto, scripts e dependências.

### `package-lock.json`

Registra a árvore de dependências utilizada pelo npm.

### `.env.example`

Documenta as configurações disponíveis.

### `.gitignore`

Define arquivos que não devem ser enviados ao Git.

### `.dockerignore`

Define arquivos que não precisam ser enviados para o contexto de
construção do Docker.

### `Dockerfile`

Define como construir o ambiente de produção em container.

------------------------------------------------------------------------

# 19. Scripts auxiliares do Windows

### `iniciar.bat`

Facilita a inicialização do projeto no Windows.

Ele verifica a instalação das dependências e tenta iniciar o servidor.

Se houver alguma incompatibilidade com a versão do pacote recebido, a
execução equivalente e mais direta continua sendo:

``` powershell
npm ci
npm start
```

### `setup-ytdlp.bat`

Baixa uma versão do yt-dlp para:

``` text
tools/yt-dlp.exe
```

Esse script é destinado ao ambiente Windows.

------------------------------------------------------------------------

# 20. Instalação limpa

Para instalar o projeto em uma máquina nova:

``` powershell
npm ci
```

Depois:

``` powershell
npm start
```

Não é necessário copiar `node_modules` de outro computador.

Isso é especialmente importante porque algumas bibliotecas possuem
componentes nativos que podem variar de acordo com o sistema operacional
e a arquitetura.

------------------------------------------------------------------------

# 21. Deploy

O projeto possui suporte inicial para ambientes que aceitam Docker.

Uma implantação típica é:

``` text
Código do projeto
       │
       ▼
Dockerfile
       │
       ▼
Imagem Docker
       │
       ├── Node.js
       ├── FFmpeg
       ├── yt-dlp
       └── LibreOffice
       │
       ▼
Servidor de hospedagem
       │
       ▼
Aplicação Web
```

Antes de escolher uma plataforma, é importante verificar se ela permite:

-   execução de containers Docker;
-   processamento prolongado de arquivos;
-   quantidade suficiente de CPU e memória;
-   armazenamento temporário adequado;
-   tamanho de upload compatível;
-   tempo de execução suficiente para conversões grandes.

Em hospedagens com armazenamento efêmero, os arquivos de `uploads/` e
`outputs/` não devem ser tratados como armazenamento permanente.

------------------------------------------------------------------------

# 22. Limitações importantes

Este projeto foi estruturado como uma aplicação de portfólio e uma base
funcional para processamento de mídia.

Conversões grandes podem consumir bastante:

-   CPU;
-   memória;
-   armazenamento temporário;
-   tempo de processamento.

Em um serviço público com muitos usuários simultâneos, uma arquitetura
mais avançada pode utilizar:

``` text
Servidor Web
     │
     ▼
Fila de tarefas
     │
     ├── Worker de mídia
     ├── Worker de documentos
     └── Worker de downloads
```

Também pode ser necessário utilizar armazenamento de objetos em vez do
sistema de arquivos local.

------------------------------------------------------------------------

# 23. Licença e uso

Este projeto é apresentado como um **projeto de portfólio sem fins
lucrativos**.

As bibliotecas e ferramentas utilizadas pelo projeto possuem suas
próprias licenças e termos de uso. Ao redistribuir ou hospedar o
projeto, verifique as licenças dos componentes utilizados.

O usuário também é responsável por garantir que possui autorização para
processar, converter ou baixar os arquivos e conteúdos utilizados.

------------------------------------------------------------------------

# 24. Resumo rápido para novos usuários

### Windows

1.  Instale Node.js 22.23.2 ou superior.
2.  Configure FFmpeg.
3.  Instale/configure LibreOffice para DOCX → PDF.
4.  Mantenha `tools/yt-dlp.exe` para os downloads por URL.
5.  Abra a pasta do projeto no terminal.
6.  Execute:

``` powershell
npm ci
npm start
```

7.  Abra:

``` text
http://localhost:3000
```

### Docker

1.  Instale Docker.
2.  Abra o terminal na pasta do projeto.
3.  Execute:

``` bash
docker build -t conversor-fullstack .
```

4.  Execute:

``` bash
docker run --rm -p 3000:3000 conversor-fullstack
```

5.  Abra:

``` text
http://localhost:3000
```

6.  Verifique:

``` text
http://localhost:3000/health
```

Se aparecer:

``` json
{
  "status": "ok"
}
```

o servidor está respondendo.

------------------------------------------------------------------------

## Projeto de portfólio sem fins lucrativos

**Conversor Full-Stack de Mídias**

Desenvolvido com HTML, CSS, JavaScript, Node.js, Express, FFmpeg, Sharp,
pdf2json, docx, LibreOffice e yt-dlp.
