# 🚀 Guia de Instalação Local - ERP Adega Beira Rio

Este guia mostra como executar o projeto ERP na sua máquina local usando VS Code.

---

## 📋 Pré-requisitos

Antes de começar, você precisa instalar os seguintes programas:

### 1. Node.js (versão 22 ou superior)
**Download:** https://nodejs.org/

Verifique a instalação:
```bash
node --version
# Deve mostrar v22.x.x ou superior
```

### 2. pnpm (gerenciador de pacotes)
Após instalar o Node.js, instale o pnpm:
```bash
npm install -g pnpm
```

Verifique a instalação:
```bash
pnpm --version
# Deve mostrar 9.x.x ou superior
```

### 3. MySQL (versão 8 ou superior)
**Download:** https://dev.mysql.com/downloads/mysql/

**Alternativa:** Você pode usar XAMPP (inclui MySQL):
- **Download:** https://www.apachefriends.org/

Após instalar, inicie o servidor MySQL.

### 4. Git
**Download:** https://git-scm.com/downloads

Verifique a instalação:
```bash
git --version
```

### 5. VS Code
**Download:** https://code.visualstudio.com/

**Extensões recomendadas:**
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

---

## 📦 Passo 1: Clonar o Projeto

Abra o terminal (PowerShell no Windows ou Terminal no Mac/Linux) e execute:

```bash
# Clone o repositório
git clone https://github.com/abrdesenvolvimento/Projeto-ERP-ABR.git

# Entre na pasta do projeto
cd Projeto-ERP-ABR
```

---

## 🔧 Passo 2: Instalar Dependências

Dentro da pasta do projeto, execute:

```bash
pnpm install
```

Isso vai instalar todas as bibliotecas necessárias. Pode demorar alguns minutos.

---

## 🗄️ Passo 3: Configurar Banco de Dados

### 3.1 Criar o Banco de Dados

Abra o MySQL Workbench (ou phpMyAdmin se estiver usando XAMPP) e execute:

```sql
CREATE DATABASE erp_adega CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3.2 Criar Usuário (opcional, mas recomendado)

```sql
CREATE USER 'erp_user'@'localhost' IDENTIFIED BY 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON erp_adega.* TO 'erp_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

### 4.1 Criar arquivo `.env`

Na raiz do projeto, crie um arquivo chamado `.env` (sem extensão, apenas `.env`).

### 4.2 Copiar e colar este conteúdo:

```env
# Database
DATABASE_URL=mysql://erp_user:sua_senha_aqui@localhost:3306/erp_adega

# JWT Secret (use qualquer string aleatória longa)
JWT_SECRET=sua_chave_secreta_muito_longa_e_aleatoria_aqui_123456

# OAuth (pode deixar esses valores para desenvolvimento local)
OAUTH_SERVER_URL=http://localhost:3001
VITE_OAUTH_PORTAL_URL=http://localhost:3001

# App Config
VITE_APP_ID=erp-adega-local
VITE_APP_TITLE=ERP Adega Beira Rio
VITE_APP_LOGO=/logo.png

# Owner (seu usuário admin)
OWNER_NAME=Administrador
OWNER_OPEN_ID=admin@adegabeirario.com.br

# Built-in APIs (deixe em branco para desenvolvimento local)
BUILT_IN_FORGE_API_KEY=
BUILT_IN_FORGE_API_URL=

# Analytics (deixe em branco para desenvolvimento local)
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

### 4.3 Ajustar as credenciais:

**Substitua:**
- `erp_user` → seu usuário MySQL (ou `root` se não criou usuário)
- `sua_senha_aqui` → sua senha do MySQL
- `sua_chave_secreta_muito_longa_e_aleatoria_aqui_123456` → qualquer texto longo e aleatório

**Exemplo com usuário root:**
```env
DATABASE_URL=mysql://root:minhasenha@localhost:3306/erp_adega
```

---

## 🏗️ Passo 5: Criar Tabelas no Banco

Execute este comando para criar todas as tabelas:

```bash
pnpm db:push
```

Você verá mensagens indicando que as tabelas foram criadas.

---

## ▶️ Passo 6: Iniciar o Servidor

Execute:

```bash
pnpm dev
```

Você verá algo como:

```
VITE v5.x.x  ready in 1234 ms

➜  Local:   http://localhost:3001/
➜  Network: use --host to expose
```

---

## 🌐 Passo 7: Acessar o Sistema

Abra seu navegador e acesse:

```
http://localhost:3001
```

**Primeiro acesso:**
- O sistema vai criar automaticamente um usuário admin
- Use o email configurado em `OWNER_OPEN_ID` para fazer login

---

## 🔍 Passo 8: Abrir no VS Code

```bash
# Na pasta do projeto, execute:
code .
```

Isso vai abrir o VS Code com o projeto carregado.

---

## 📁 Estrutura do Projeto

```
Projeto-ERP-ABR/
├── client/              # Frontend (React)
│   ├── src/
│   │   ├── pages/      # Páginas do sistema
│   │   ├── components/ # Componentes reutilizáveis
│   │   └── lib/        # Utilitários
│   └── index.html
├── server/              # Backend (Node.js)
│   ├── routers.ts      # Rotas da API
│   ├── db.ts           # Funções do banco de dados
│   └── schema.ts       # Schema do banco
├── .env                 # Variáveis de ambiente (você cria)
├── package.json         # Dependências
└── README.md
```

---

## 🛠️ Comandos Úteis

### Desenvolvimento
```bash
pnpm dev              # Inicia servidor de desenvolvimento
```

### Banco de Dados
```bash
pnpm db:push          # Aplica mudanças no schema
pnpm db:studio        # Abre interface visual do banco
```

### Build para Produção
```bash
pnpm build            # Gera versão otimizada
```

---

## ❓ Problemas Comuns

### Erro: "Cannot connect to database"
**Solução:** Verifique se:
1. MySQL está rodando
2. Credenciais no `.env` estão corretas
3. Banco de dados `erp_adega` foi criado

### Erro: "Port 3001 already in use"
**Solução:** Outra aplicação está usando a porta 3001. Você pode:
1. Fechar a outra aplicação
2. Ou mudar a porta no arquivo `vite.config.ts`

### Erro: "pnpm: command not found"
**Solução:** Instale o pnpm:
```bash
npm install -g pnpm
```

### Erro ao fazer `pnpm install`
**Solução:** Limpe o cache e tente novamente:
```bash
pnpm store prune
pnpm install
```

---

## 🔄 Atualizar o Projeto

Para pegar as últimas alterações do GitHub:

```bash
git pull origin main
pnpm install          # Instalar novas dependências (se houver)
pnpm db:push          # Atualizar banco (se houver mudanças)
```

---

## 📞 Suporte

Se tiver problemas:
1. Verifique se todos os pré-requisitos estão instalados corretamente
2. Confirme que o arquivo `.env` está configurado
3. Verifique se o MySQL está rodando
4. Consulte a documentação no README.md

---

## ✅ Checklist de Instalação

- [ ] Node.js 22+ instalado
- [ ] pnpm instalado
- [ ] MySQL instalado e rodando
- [ ] Git instalado
- [ ] VS Code instalado
- [ ] Projeto clonado
- [ ] Dependências instaladas (`pnpm install`)
- [ ] Banco de dados criado
- [ ] Arquivo `.env` configurado
- [ ] Tabelas criadas (`pnpm db:push`)
- [ ] Servidor iniciado (`pnpm dev`)
- [ ] Sistema acessível em http://localhost:3001

---

**Pronto! Agora você tem o ERP rodando localmente! 🎉**

