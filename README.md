<h1 align="center">✦ SPA Ana Paula Merêncio — Sistema Integrado de Avaliação e Prontuário</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
</p>

> Plataforma Full-Stack de Prontuário Eletrônico, Avaliação Estética e Mapeamento Visual. Este projeto é uma evolução direta de um MVP de Avaliação Estética Facial, passando de um protótipo estático para um sistema completo com persistência de dados em banco, geração de cobranças e automação de contratos.

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Principais Funcionalidades](#-principais-funcionalidades)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Como Rodar Localmente](#-como-rodar-localmente)
- [Endpoints da API](#-endpoints-da-api)
- [Avisos e Restrições (LGPD)](#-avisos-e-restrições-lgpd)
- [Licença](#-licença)

---

## 🚀 Principais Funcionalidades

A interface (Single Page Application) está dividida em 5 etapas principais que guiam o profissional de saúde estética em seu fluxo de atendimento:

1. **Cadastro & Saúde (Anamnese)**
   - Coleta de dados pessoais e histórico de saúde do paciente (doenças crônicas, alergias, cirurgias).
   - Cálculo automatizado de IMC (Índice de Massa Corporal), classificando o estado atual do paciente.

2. **Escaneamento (IA) e Visão Computacional**
   - Acesso à webcam do dispositivo para captura de poses (Frontal, Perfil, Colo).
   - Simulação de mapeamento por Inteligência Artificial para gerar planos de procedimentos sugeridos (ex: redução de papada, toxina botulínica). 
   - *(O front-end está estruturado para integração futura com motores reais de IA client-side, como MediaPipe Face Landmarker).*

3. **Mapeamento Visual (Prontuário Gráfico)**
   - Ferramenta interativa usando `Canvas API` para marcação precisa de pontos de aplicação.
   - Alternância entre templates anatômicos SVG dinâmicos: Feminino/Masculino e Vista Face/Corpo.
   - Ferramentas categorizadas por cores (Toxina Botulínica, Preenchedores, Bioestimuladores/Fios).

4. **Procedimento & Salvar (Integração PIX)**
   - Registro detalhado das intercorrências e conclusões do procedimento clínico.
   - **Geração dinâmica de QR Code PIX** na tela para facilitar o pagamento imediato.

5. **Contrato de Serviços Estéticos (Automático)**
   - Geração automática do termo de consentimento e prestação de serviços, populado com dados preenchidos no formulário (Nome, CPF, Valores, COREN).
   - Estilização de impressão nativa (`@media print`), gerando PDFs perfeitos com quebras de página precisas e áreas designadas para assinaturas.

---

## 🛠️ Tecnologias Utilizadas

**Front-end:**
- HTML5 & CSS3 (Variáveis CSS, CSS Grid, Media Queries para Impressão)
- Vanilla JavaScript (Manipulação de DOM, Canvas API, MediaDevices API)

**Back-end:**
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/) (Servidor HTTP e roteamento)
- [Mongoose](https://mongoosejs.com/) (ODM para o MongoDB)
- `cors` (Controle de acesso a recursos)
- `qrcode` (Geração de QR Codes dinâmicos)

---

## ⚙️ Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado em sua máquina.
- Conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (ou uma instância local do MongoDB rodando).

### Passo a Passo

1. **Clone este repositório**
   ```bash
   git clone https://github.com/SEU_USUARIO/spa-ana-paula-merencio.git
   cd spa-ana-paula-merencio
   ```

2. **Instale as dependências do projeto**
   ```bash
   npm install
   ```
   *(Ou instale manualmente: `npm install express cors qrcode mongoose`)*

3. **Configure as Variáveis de Ambiente**
   Crie um arquivo `.env` na raiz do projeto (ou configure diretamente no terminal) com a string de conexão do seu banco de dados:
   ```env
   MONGODB_URI=mongodb+srv://<usuario>:<senha>@cluster0.mongodb.net/spa_database?retryWrites=true&w=majority
   ```
   > ⚠️ **Aviso:** Se a variável `MONGODB_URI` não for configurada, o console emitirá um alerta e o salvamento em banco não funcionará (funcionando apenas como mock no front-end).

4. **Inicie o servidor**
   ```bash
   node server.js
   ```

5. **Acesse a Aplicação**
   Abra o seu navegador e acesse: [http://localhost:3000](http://localhost:3000)

---

## 📡 Endpoints da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/salvar-ficha` | Recebe o payload JSON completo (Paciente, Contrato, Procedimentos e Marcações Visuais) e salva o documento no MongoDB. |
| `GET` | `/api/fichas` | Retorna um array com todas as fichas cadastradas, ordenadas da mais recente para a mais antiga. |
| `GET` | `/api/gerar-qrcode/:valor`| Gera e retorna um payload PIX formato `BR.GOV.BCB.PIX` em Base64 Data URI com base no valor informado na URL. |
| `GET` | `*` | Catch-all que serve estaticamente o arquivo `index.html`, garantindo o funcionamento correto do SPA. |

---

## ⚠️ Avisos e Restrições (LGPD)

- **Proteção de Dados e Uso de Imagem:** A plataforma coleta dados sensíveis de saúde e utiliza captura por câmera. Para uso em produção, é indispensável o consentimento explícito do paciente em adequação à **LGPD (Lei Geral de Proteção de Dados)**. O sistema gera automaticamente um termo de contrato/consentimento na aba 5 para este fim.
- **Ferramenta de Apoio à Decisão:** O escaneamento facial e as sugestões de tratamentos geradas por algoritmos devem ser encarados exclusivamente como **apoio à decisão clínica**. Eles **não substituem** o diagnóstico, a prescrição e a revisão de um profissional devidamente habilitado.

---

## 📄 Licença

Este projeto é protegido e de uso restrito, desenvolvido para as operações do SPA Ana Paula Merêncio.
