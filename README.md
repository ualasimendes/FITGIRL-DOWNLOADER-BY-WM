# FitGirl Desktop Extractor (by WM)

[![Release](https://img.shields.io/github/v/release/ualasimendes/FITGIRL-DOWNLOADER-BY-WM?style=flat-square)](https://github.com/ualasimendes/FITGIRL-DOWNLOADER-BY-WM/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-0078d7.svg?style=flat-square&logo=windows)](https://github.com/ualasimendes/FITGIRL-DOWNLOADER-BY-WM)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](https://github.com/ualasimendes/FITGIRL-DOWNLOADER-BY-WM)

O **FitGirl Desktop Extractor** é o gerenciador, buscador e extrator definitivo de repacks para Windows, projetado para proporcionar uma experiência robusta, direta e sem fricções. O usuário final não necessita de instalações adicionais de Node.js, Git ou interpretadores de linha de comando — tudo é executado através de um único instalador profissional de alta performance.

---

## 🚀 Principais Recursos

* **Interface Ultra Moderna**: Desenvolvida com foco em legibilidade, fluidez visual e resposta ágil a comandos.
* **Buscador de Repacks Integrado**: Pesquisa diretamente da biblioteca oficial sem necessidade de abrir navegadores.
* **Motor de Extração & Filas**: Controle total sobre downloads, pause/retomada e integridade dos arquivos compactados.
* **Persistência Segura**: Configurações pessoais, históricos e filas de download persistidos de forma segura no sistema nativo (`%APPDATA%/FitGirlDownloaderWM`).
* **Atualizações Automáticas (Auto-Update)**: Sempre que uma nova versão está disponível no GitHub Releases, o aplicativo notifica o usuário e instala a nova versão de forma transparente e automática.

---

## 📦 Como Instalar (Usuário Final)

Para o usuário final, a instalação é simples e direta:

1. Acesse a seção de **[Releases no GitHub](https://github.com/ualasimendes/FITGIRL-DOWNLOADER-BY-WM/releases)**.
2. Baixe o instalador oficial: `FitGirl-Desktop-Extractor-Setup-1.0.0.exe` (ou a versão mais recente disponível).
3. Execute o instalador e siga as instruções na tela.
4. Um atalho será criado em sua Área de Trabalho e no Menu Iniciar.
5. Pronto! O aplicativo iniciará o backend integrado de forma silenciosa e transparente.

*Nota: Se preferir uma versão portátil que não necessita de instalação, baixe o arquivo `FitGirl-Desktop-Extractor-Portable-1.0.0.exe`.*

---

## 🔧 Atualizações Automáticas

O aplicativo conta com suporte nativo para atualizações em segundo plano utilizando `electron-updater`:
* **Checagem Inicial**: Sempre que o aplicativo é aberto, ele realiza uma requisição segura para o repositório oficial no GitHub buscando o arquivo `latest.yml`.
* **Download Transparente**: Se uma nova versão for detectada, o download do instalador é iniciado automaticamente em segundo plano.
* **Instalação Fluida**: Uma notificação amigável avisa quando o download termina, permitindo aplicar a atualização imediatamente ou ao fechar o app, preservando 100% de suas configurações, histórico e dados de download anteriores.

---

## 🛠️ Guia de Publicação e Release Automática (Desenvolvedor)

Toda a distribuição do aplicativo foi automatizada na nuvem via **GitHub Actions**. Você **não precisa** e **não deve** compilar o instalador `.exe` em seu computador local.

### Como criar e lançar uma nova versão:

1. **Garantir que tudo está salvo e commitado**:
   ```bash
   git status
   git add .
   git commit -m "release: versão 1.0.0"
   ```

2. **Criar a Tag de Versão**:
   Crie uma tag Git seguindo o padrão de versionamento semântico (começando com `v`):
   ```bash
   git tag v1.0.0
   ```

3. **Enviar para o GitHub**:
   Envie o seu código principal (branch `main`) e a tag criada diretamente para o seu repositório remoto:
   ```bash
   git push origin main
   git push origin v1.0.0
   ```

4. **Processamento Automático**:
   O pipeline do GitHub Actions (.yml) será disparado instantaneamente ao receber a tag e fará o seguinte na nuvem Windows:
   * Inicializará uma máquina Windows virtual.
   * Instalará as dependências exatas via `npm ci`.
   * Realizará o build completo e a compilação do servidor e do frontend.
   * Executará o `electron-builder` para criar o instalador de Setup (`nsis`), a versão portátil (`portable`) e o arquivo descritor `latest.yml`.
   * **Publicará a Release automaticamente** no repositório `ualasimendes/FITGIRL-DOWNLOADER-BY-WM` com os arquivos anexados.

---

## 📂 Estrutura de Diretórios de Configuração

Quando o usuário executa o aplicativo instalado, as seguintes estruturas são mantidas no disco local:
* **Configurações e Banco de Dados Local**: `%APPDATA%/FitGirlDownloaderWM`
* **Diretório Padrão de Downloads**: `%USERPROFILE%/Downloads/FitGirlDownloads`

---

Desenvolvido com excelência técnica por **WM**.
