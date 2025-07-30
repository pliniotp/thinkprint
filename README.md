
# ThinkPrint Galeria Facial

**ThinkPrint Galeria Facial** é uma plataforma completa para gestão de galerias fotográficas com reconhecimento facial, pensada para eventos como formaturas e aniversários.  A solução consiste em um backend em Python/Flask, múltiplos front‑ends em React/Vite (dashboard administrativo, microsite do participante e slideshow público) e um script de upload para Windows que envia automaticamente fotos e vídeos para processamento.

> **Nota:** esta é uma implementação de referência.  Muitas funcionalidades (como integração real com AWS Rekognition e Twilio) estão esboçadas ou simplificadas.  Use-a como base e adapte conforme as necessidades do seu projeto.

## 📦 Estrutura do projeto

```
thinkprint/
├── backend/            # API Flask para autenticação, eventos, uploads e registro
├── dashboard/          # Dashboard administrativo em React/Vite
├── microsite/          # Microsite de cadastro e galeria em React/Vite
├── slideshow/          # Slideshow público em React/Vite
├── uploader/           # Script Python para envio automático (Watch Folder)
├── public/             # Arquivos estáticos adicionais (ex.: logos)
├── docs/               # Documentação técnica adicional
├── vercel-backend/     # Versão serverless do backend para deploy na Vercel
└── README.md           # Este arquivo
```

## ⚙️ Backend (Flask)

O backend expõe uma API REST sob `/api` com as seguintes funcionalidades:

* **Autenticação:** login de administradores pré‑definidos com retorno de token.
* **Eventos:** criação, atualização, remoção e listagem de eventos.  Cada evento possui frase, logotipo, tempo de expiração da galeria e associa participantes e uploads.
* **QR Code:** geração de QR code (PNG em base64) para link de cadastro de participantes.
* **Leads e uploads:** exportação de participantes (telefone, selfie, data de cadastro) e listagem de mídias enviadas.
* **Uploads:** endpoint para o *watch folder* enviar fotos/vídeos.  Arquivos são armazenados em `backend/uploads/` e associados a um evento.
* **Cadastro de participante:** formulário que recebe telefone e selfie, cria um participante e tenta associar mídias existentes via reconhecimento facial (stub).
* **Galeria:** consulta da galeria de um participante via token único, retornando as mídias reconhecidas.
* **Slideshow:** listagem de todas as mídias de um evento para exibição pública.

Para executar localmente:

```bash
cd thinkprint/backend
python -m venv venv
source venv/bin/activate  # em Windows use venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

As credenciais de administradores estão em `config.ADMIN_USERS`.  Ajuste `config.py` para apontar para suas credenciais AWS/Twilio ou defina variáveis de ambiente correspondentes.

## 🖥️ Dashboard (React/Vite)

O dashboard permite que administradores façam login, visualizem e criem eventos.  Por simplicidade, edição e exclusão de eventos foram omitidas, mas podem ser implementadas com base no backend.  Para rodar o dashboard em modo de desenvolvimento:

```bash
cd thinkprint/dashboard
npm install
npm run dev
```

Defina a variável `VITE_API_BASE_URL` em um arquivo `.env` para apontar para o backend caso ele não esteja no mesmo domínio/porta.

## 🌐 Microsite (React/Vite)

O microsite oferece duas rotas básicas:

* **Cadastro:** `/register?event=<eventId>` – Tela com campos de telefone e selfie.  Ao enviar, chama o endpoint `/api/register` e exibe mensagem de sucesso.
* **Galeria:** `/gallery/<token>` – Exibe as mídias reconhecidas para o participante.  Botões permitem baixar todos os arquivos ou compartilhar a galeria via WhatsApp.

Para rodar localmente:

```bash
cd thinkprint/microsite
npm install
npm run dev
```

## 🎞️ Slideshow (React/Vite)

O slideshow consome o endpoint `/api/slideshow/<eventId>` e exibe automaticamente todas as mídias do evento em tela cheia, alternando a cada 5 segundos.  Inicie informando o parâmetro `event` na URL (ex.: `http://localhost:5175/?event=<eventId>`).

```bash
cd thinkprint/slideshow
npm install
npm run dev
```

## 📤 Uploader para Windows

O script `uploader/uploader.py` monitora uma pasta e envia novos arquivos para o backend.  Use a seguinte sintaxe:

```bash
python uploader.py --folder C:\\FotosEvento --event <idDoEvento> --api http://localhost:5000/api
```

Para empacotar como `.exe`, utilize o PyInstaller (instale com `pip install pyinstaller`):

```bash
pyinstaller --onefile uploader.py
```

## 📚 Documentação adicional

* Os fluxos de notificação via Twilio e reconhecimento facial via AWS Rekognition estão implementados como stubs (funções `send_media_notification` e `match_faces`).  Substitua esses trechos pelas chamadas reais (`boto3.client('rekognition')` e `twilio.rest.Client`).
* Para armazenamento em produção, troque as pastas locais por buckets S3, configurando `config.S3_MEDIA_BUCKET` e `config.S3_THUMBNAIL_BUCKET`.
* O PDF técnico detalhado pode ser gerado a partir do conteúdo desta documentação e está localizado em `docs/` quando criado.

## 📝 Conclusão

Este repositório oferece uma base de código funcional para a plataforma ThinkPrint Galeria Facial.  Personalize o visual, conecte aos serviços de nuvem necessários e amplie as funcionalidades conforme os requisitos do seu evento.  Pull requests e contribuições são bem‑vindas!
