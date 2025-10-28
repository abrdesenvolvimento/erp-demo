# Sistema ERP - Adega Beira Rio

Sistema de gestão empresarial (ERP) desenvolvido para a Adega Beira Rio, com funcionalidades completas para controle de vendas, compras, estoque, financeiro e parceiros.

## 🚀 Funcionalidades

### Gestão de Produtos
- ✅ Cadastro completo de produtos
- ✅ Produtos compostos (receitas/kits)
- ✅ Controle de estoque com alertas de estoque mínimo
- ✅ Múltiplos preços por canal de venda
- ✅ Categorias e subcategorias
- ✅ Código EAN/código de barras
- ✅ Baixa automática de estoque em vendas

### Vendas
- ✅ Vendas balcão, delivery e a prazo
- ✅ Múltiplos canais de venda (iFood, Rappi, etc)
- ✅ Descontos e acréscimos
- ✅ Controle de limite de crédito de clientes
- ✅ Histórico completo de vendas
- ✅ Resumo lateral em tempo real

### Compras
- ✅ Registro de compras com múltiplos itens
- ✅ Controle de fornecedores
- ✅ Parcelas e formas de pagamento
- ✅ Integração com contas a pagar
- ✅ Atualização automática de estoque
- ✅ Divisão automática de parcelas

### Financeiro
- ✅ Contas a receber (vendas a prazo)
- ✅ Contas a pagar (compras e despesas)
- ✅ Despesas operacionais com categorias
- ✅ Indicadores visuais de vencimento
- ✅ Histórico de pagamentos
- ✅ Filtros por período e status

### Parceiros (Clientes e Fornecedores)
- ✅ Cadastro unificado de clientes e fornecedores
- ✅ Validação de CPF/CNPJ
- ✅ Busca automática de endereço por CEP
- ✅ Limite de crédito para clientes
- ✅ Histórico de transações

### Dashboard
- ✅ Visão geral do negócio
- ✅ Indicadores de vendas
- ✅ Alertas de estoque
- ✅ Contas a receber/pagar

## 🛠️ Tecnologias

### Frontend
- **React** + **TypeScript**
- **Vite** - Build tool
- **TailwindCSS** - Estilização
- **shadcn/ui** - Componentes UI
- **tRPC** - Type-safe API
- **React Query** - Cache e estado do servidor

### Backend
- **Node.js** + **TypeScript**
- **tRPC** - API type-safe
- **Drizzle ORM** - Database ORM
- **MySQL** - Banco de dados
- **Zod** - Validação de schemas

## 📦 Instalação

### Pré-requisitos
- Node.js 22+
- pnpm
- MySQL 8+

### Configuração

1. Clone o repositório:
\`\`\`bash
git clone https://github.com/abrdesenvolvimento/Projeto-ERP-ABR.git
cd Projeto-ERP-ABR
\`\`\`

2. Instale as dependências:
\`\`\`bash
pnpm install
\`\`\`

3. Configure as variáveis de ambiente:
\`\`\`bash
cp .env.example .env
\`\`\`

Edite o arquivo `.env` com suas credenciais do banco de dados.

4. Execute as migrações do banco:
\`\`\`bash
pnpm db:push
\`\`\`

5. Inicie o servidor de desenvolvimento:
\`\`\`bash
pnpm dev
\`\`\`

O sistema estará disponível em `http://localhost:3001`

## 🔧 Scripts Disponíveis

- `pnpm dev` - Inicia servidor de desenvolvimento
- `pnpm build` - Build para produção
- `pnpm db:push` - Aplica mudanças no schema do banco
- `pnpm db:studio` - Abre interface visual do banco

## 📝 Melhorias Recentes

### Sprint 1 - Validações e Automações
- Validação visual de estoque em vendas
- Validação de EAN com dígito verificador
- Validação e formatação de CPF/CNPJ
- Cálculo automático de parcelas
- Preenchimento automático de parcela única

### Sprint 2 - Usabilidade
- Busca automática de CEP
- Filtros em Contas a Receber/Pagar
- Atalhos de teclado globais

### Sprint 3 - Interface
- Resumo fixo lateral em vendas
- Labels melhorados e formatação consistente
- Indicadores visuais de vencimento

## 🐛 Bugs Conhecidos

- [ ] Edição de produto composto não mostra composições
- [ ] Baixa de estoque de produtos compostos
- [ ] Erro no cadastro rápido de fornecedor
- [ ] Histórico de pagamentos não mostra compras

## 📄 Licença

Propriedade privada da Adega Beira Rio.

## 👥 Equipe

Desenvolvido para Adega Beira Rio.

