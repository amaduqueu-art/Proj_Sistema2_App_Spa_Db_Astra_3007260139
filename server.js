require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const { DataAPIClient } = require('@datastax/astra-db-ts');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(__dirname));

// -------------------------------------------------------------
// CONEXÃO COM BANCO DE DADOS
// -------------------------------------------------------------
const ASTRA_DB_TOKEN = process.env.ASTRA_DB_TOKEN;
const ASTRA_DB_ENDPOINT = process.env.ASTRA_DB_ENDPOINT;
const ASTRA_DB_NAMESPACE = process.env.ASTRA_DB_NAMESPACE || 'default_keyspace';

if (!ASTRA_DB_TOKEN || !ASTRA_DB_ENDPOINT) {
  console.error('❌ As variáveis ASTRA_DB_TOKEN e ASTRA_DB_ENDPOINT devem estar configuradas no arquivo .env');
}

const client = new DataAPIClient(ASTRA_DB_TOKEN);
const db = client.db(ASTRA_DB_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

// Instâncias das Coleções
const usuariosColl = db.collection('usuarios');
const fichasColl = db.collection('fichas');

console.log('🌌 Conectado ao banco de dados do SPA Ana Paula Merêncio com sucesso!');

// -------------------------------------------------------------
// CONFIGURAÇÃO DE E-MAIL (NODEMAILER)
// -------------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------------------------------------------------------------
// HELPER: GERADOR DE EMV / PIX PAYLOAD E CRC16
// -------------------------------------------------------------
function calcularCRC16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarPayloadPix({ chave, nome, cidade, valor, txid = '***' }) {
  const formatTLV = (id, val) => {
    const len = val.length.toString().padStart(2, '0');
    return `${id}${len}${val}`;
  };

  const nomeSanitizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase();
  const cidadeSanitizada = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase();
  const valorFormatado = parseFloat(valor).toFixed(2);

  const gui = formatTLV('00', 'BR.GOV.BCB.PIX');
  const key = formatTLV('01', chave);
  const merchantAccount = formatTLV('26', gui + key);
  const additionalData = formatTLV('62', formatTLV('05', txid));

  let payload = [
    formatTLV('00', '01'),
    merchantAccount,
    formatTLV('52', '0000'),
    formatTLV('53', '986'),
    formatTLV('54', valorFormatado),
    formatTLV('58', 'BR'),
    formatTLV('59', nomeSanitizado),
    formatTLV('60', cidadeSanitizada),
    additionalData
  ].join('');

  payload += '6304';
  const crc16 = calcularCRC16(payload);

  return payload + crc16;
}

// -------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO E USUÁRIOS (RBAC)
// -------------------------------------------------------------

// 1. Rota de Cadastro de Usuários (Admin e Usuário Comum)
app.post('/api/register', async (req, res) => {
  try {
    const { usuario, email, senha, role } = req.body;
    
    if (!usuario || !email || !senha) {
      return res.status(400).json({ sucesso: false, erro: 'Preencha todos os campos obrigatórios.' });
    }

    const perfilFinal = (role === 'admin') ? 'admin' : 'user';

    const existe = await usuariosColl.findOne({
      $or: [{ email }, { usuario }]
    });

    if (existe) {
      return res.status(400).json({ sucesso: false, erro: 'Nome de usuário ou e-mail já cadastrado.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const novoUsuario = {
      usuario,
      email,
      senha,
      role: perfilFinal,
      isConfirmado: false,
      tokenConfirmacao: token,
      data_criacao: new Date()
    };

    await usuariosColl.insertOne(novoUsuario);

    const baseUrl = req.protocol + '://' + req.get('host');
    const linkConfirmacao = `${baseUrl}/api/confirmar/${token}`;
    const descPerfil = perfilFinal === 'admin' ? 'Administrador' : 'Usuário Comum';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Confirme sua conta - SPA Ana Paula Merêncio',
      html: `<div style="font-family: sans-serif; padding:20px; color:#333;">
              <h2 style="color:#a85d72;">Olá, ${usuario}!</h2>
              <p>Sua conta de <b>${descPerfil}</b> foi solicitada no sistema do <b>SPA Ana Paula Merêncio</b>.</p>
              <p>Clique no botão abaixo para confirmar seu e-mail e liberar o acesso:</p>
              <a href="${linkConfirmacao}" style="padding:12px 20px; background:#a85d72; color:#fff; text-decoration:none; border-radius:6px; display:inline-block; margin-top:10px; font-weight:bold;">CONFIRMAR ACESSO</a>
              <br><br><p style="font-size:12px; color:#777;">Se você não solicitou este cadastro, desconsidere este e-mail.</p>
             </div>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.log('⚠️ Erro ao enviar e-mail de confirmação:', error);
      else console.log('📧 E-mail de confirmação enviado para:', email);
    });

    return res.status(201).json({ 
      sucesso: true, 
      mensagem: `Cadastro de ${descPerfil} realizado! Verifique seu e-mail para confirmar a conta antes do login.` 
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao realizar cadastro.' });
  }
});

// Compatibilidade para rota legada
app.post('/api/register-admin', (req, res) => {
  req.body.role = 'admin';
  return app._router.handle(req, res);
});

// 2. Confirmação de E-mail via Link
app.get('/api/confirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await usuariosColl.findOne({ tokenConfirmacao: token });

    if (!user) {
      return res.status(400).send('<h1 style="color:#b8455f; font-family:sans-serif; text-align:center; margin-top:50px;">Token de confirmação inválido ou expirado.</h1>');
    }

    await usuariosColl.updateOne(
      { _id: user._id },
      { $set: { isConfirmado: true }, $unset: { tokenConfirmacao: "" } }
    );

    return res.status(200).send(`
      <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h1 style="color:#4a9b7f;">Conta confirmada com sucesso!</h1>
        <p>Sua conta no sistema do <b>SPA Ana Paula Merêncio</b> foi ativada.</p>
        <p>Você já pode fechar esta aba e realizar o login.</p>
      </div>
    `);
  } catch (error) {
    return res.status(500).send('Erro interno ao confirmar conta.');
  }
});

// 3. Login de Usuários
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const user = await usuariosColl.findOne({ usuario, senha });
    
    if (!user) {
      return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha inválidos.' });
    }
    if (!user.isConfirmado) {
      return res.status(401).json({ sucesso: false, erro: 'Conta inativa. Por favor, confirme seu e-mail antes de acessar.' });
    }
    
    return res.status(200).json({ 
      sucesso: true, 
      role: user.role || 'user', 
      usuario: user.usuario 
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, erro: 'Erro no servidor durante o login.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE FICHAS E UTILITÁRIOS
// -------------------------------------------------------------

// 4. Salvar Ficha
app.post('/api/salvar-ficha', async (req, res) => {
  try {
    const novaFicha = {
      ...req.body,
      data_criacao: new Date()
    };

    const result = await fichasColl.insertOne(novaFicha);
    return res.status(200).json({ sucesso: true, id: result.insertedId });
  } catch (error) {
    console.error('[ERRO] Falha ao salvar ficha:', error);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao salvar no banco.' });
  }
});

// 5. Listar Fichas
app.get('/api/fichas', async (req, res) => {
  try {
    const fichas = await fichasColl.find({}, { sort: { data_criacao: -1 } }).toArray();
    return res.status(200).json(fichas);
  } catch (error) {
    return res.status(500).json({ erro: 'Erro ao buscar fichas no banco de dados.' });
  }
});

// 5.1 Atualizar Ficha (PUT)
app.put('/api/fichas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;

    const result = await fichasColl.updateOne(
      { _id: id },
      { $set: updateData }
    );

    return res.status(200).json({ sucesso: true, mensagem: 'Ficha atualizada com sucesso!', result });
  } catch (error) {
    console.error('[ERRO] Falha ao atualizar ficha:', error);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao atualizar ficha.' });
  }
});

// 5.2 Deletar Ficha com Proteção RBAC (DELETE)
app.delete('/api/fichas/:id', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'admin') {
      return res.status(403).json({ 
        sucesso: false, 
        erro: 'Acesso negado: Apenas usuários Administradores possuem permissão para excluir fichas.' 
      });
    }

    const { id } = req.params;
    const result = await fichasColl.deleteOne({ _id: id });

    return res.status(200).json({ sucesso: true, mensagem: 'Ficha removida com sucesso!', result });
  } catch (error) {
    console.error('[ERRO] Falha ao deletar ficha:', error);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao deletar ficha.' });
  }
});

// 6. Gerar QR Code PIX Valido
app.get('/api/gerar-qrcode/:valor', async (req, res) => {
  try {
    const valor = parseFloat(req.params.valor);
    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ erro: 'Valor inválido' });
    }

    const payloadPix = gerarPayloadPix({
      chave: process.env.PIX_KEY || '+5581999999999',
      nome: 'SPA ANA PAULA MERENCIO',
      cidade: 'RECIFE',
      valor: valor
    });

    const qrCodeDataUrl = await QRCode.toDataURL(payloadPix);

    return res.status(200).json({ 
      qrCode: qrCodeDataUrl,
      payloadPix: payloadPix 
    });
  } catch (error) {
    console.error('[ERRO] Falha ao gerar QR Code:', error);
    return res.status(500).json({ erro: 'Erro ao gerar QR Code' });
  }
});

// Redirecionamento Padrão
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});