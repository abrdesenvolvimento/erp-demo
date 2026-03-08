# Proposta de Pagamento Dividido e Estudo de Viabilidade SEFAZ

**Autor:** Manus AI  
**Data:** 08/03/2026  
**Projeto:** ABRWF — ERP Adega Beira Rio / A Brasa Reúne

---

## 1. Pagamento Dividido — Proposta Detalhada

### 1.1 Contexto e Necessidade

No cenário atual do salão, o fechamento de uma comanda aceita apenas **uma forma de pagamento**. Na prática, é muito comum que clientes desejem dividir a conta entre múltiplas formas — por exemplo, parte em dinheiro e parte no cartão, ou parte no PIX e parte no crédito. Essa limitação gera retrabalho operacional e pode causar divergências no caixa.

### 1.2 Modelo Proposto

O pagamento dividido funcionaria em **duas modalidades**:

**Modalidade A — Divisão por Forma de Pagamento (Split Payment)**

O garçom registra múltiplas formas de pagamento para a mesma comanda. O sistema garante que a soma dos pagamentos seja igual ao total da conta (com ou sem taxa de serviço, conforme decisão do cliente).

| Etapa | Ação | Detalhe |
|-------|------|---------|
| 1 | Garçom clica "Fechar Conta" | Fluxo atual: pré-visualização → confirma taxa de serviço |
| 2 | Tela de pagamento exibe o total | Ex: R$ 303,56 |
| 3 | Garçom adiciona 1o pagamento | Seleciona forma (Dinheiro) e digita valor (R$ 100,00) |
| 4 | Sistema mostra saldo restante | R$ 203,56 restantes |
| 5 | Garçom adiciona 2o pagamento | Seleciona forma (PIX) e digita valor (R$ 203,56) |
| 6 | Saldo zerado → botão "Confirmar" habilitado | Fecha a comanda com 2 registros de pagamento |

**Modalidade B — Divisão por Pessoa (Split per Guest)**

O sistema calcula automaticamente o valor por pessoa (já existe o campo `guestCount`) e permite que cada pessoa pague sua parte com forma diferente.

| Etapa | Ação | Detalhe |
|-------|------|---------|
| 1 | Garçom seleciona "Dividir por pessoa" | Sistema divide total / guestCount |
| 2 | Para cada pessoa, seleciona forma de pagamento | Pessoa 1: Cartão, Pessoa 2: PIX, Pessoa 3: Dinheiro |
| 3 | Ajuste manual se necessário | Permite editar valor de cada parcela (ex: um paga mais) |
| 4 | Soma validada → confirma fechamento | Registra N pagamentos |

### 1.3 Impacto no Schema (Banco de Dados)

Atualmente, a tabela `salonOrders` possui os campos `paymentMethod` (varchar) e `tipAmount` (decimal). Para suportar pagamento dividido, seria necessário criar uma nova tabela:

```
salonOrderPayments
├── id (PK, auto-increment)
├── orderId (FK → salonOrders.id)
├── companyId (FK → companies.id)
├── paymentMethod (enum: CASH, DEBIT, CREDIT, PIX)
├── amount (decimal 10,2) — valor pago nesta parcela
├── createdAt (timestamp)
```

A tabela `salonOrders` manteria `paymentMethod` como campo legado (preenchido com o método principal ou "MIXED" quando houver split), e `totalAmount` continuaria representando o valor total da comanda.

### 1.4 Impacto na Contabilização

Cada registro de `salonOrderPayments` geraria um lançamento contábil individual:

- **Dinheiro:** D-Caixa / C-Receita de Vendas
- **Cartão Débito:** D-Cartão a Receber / C-Receita de Vendas
- **Cartão Crédito:** D-Cartão a Receber / C-Receita de Vendas
- **PIX:** D-Caixa (ou Banco) / C-Receita de Vendas

Isso mantém a rastreabilidade e permite conciliação precisa por forma de pagamento no fechamento de caixa.

### 1.5 Impacto no Frontend

A tela de pagamento (Step 3 do checkout) seria reformulada:

- Lista de pagamentos adicionados (forma + valor) com botão de remover
- Campo para adicionar novo pagamento (select forma + input valor)
- Barra de progresso visual mostrando quanto falta pagar
- Botão "Pagar Tudo" que preenche automaticamente o saldo restante
- Botão "Dividir Igual" que divide por número de pessoas
- Validação: soma dos pagamentos deve ser exatamente igual ao total

### 1.6 Estimativa de Esforço

| Componente | Estimativa |
|-----------|-----------|
| Schema + migração | 1h |
| Backend (endpoints, validação, contabilização) | 3-4h |
| Frontend (UI de split payment) | 3-4h |
| Testes e ajustes | 2h |
| **Total estimado** | **9-11h** |

### 1.7 Recomendação

Implementar primeiro a **Modalidade A** (divisão por forma de pagamento), que é a mais demandada e cobre 90% dos casos. A Modalidade B (divisão por pessoa) pode ser adicionada posteriormente como refinamento, pois o garçom pode fazer a divisão manual na Modalidade A.

---

## 2. Estudo de Viabilidade — Integração SEFAZ (NFC-e)

### 2.1 O que é NFC-e

A **Nota Fiscal de Consumidor Eletrônica (NFC-e)** é o documento fiscal digital que substitui o antigo cupom fiscal (ECF). É obrigatória para operações de venda ao consumidor final presencial em estabelecimentos como restaurantes, bares e lojas. O modelo é o **65** (diferente da NF-e modelo 55, que é para operações B2B).

### 2.2 Requisitos Técnicos para Emissão de NFC-e

Para emitir NFC-e, o estabelecimento precisa de:

| Requisito | Detalhe |
|-----------|---------|
| **Inscrição Estadual ativa** | Empresa deve estar habilitada na SEFAZ do estado |
| **Credenciamento NFC-e** | Solicitar à SEFAZ permissão para emissão (via portal ou contador) |
| **Certificado Digital ICP-Brasil** | Tipo A1 (arquivo .pfx) ou A3 (token/cartão). A1 é mais prático para sistemas web |
| **CSC (Código de Segurança do Contribuinte)** | Token fornecido pela SEFAZ, usado para gerar o QR Code do DANFE |
| **Ambiente de homologação** | Para testes antes de ir para produção |
| **Software emissor** | Sistema próprio ou API de terceiros |

### 2.3 Abordagens de Integração

Existem **duas abordagens** para integrar NFC-e ao ABRWF:

**Abordagem 1 — Integração direta com SEFAZ (não recomendada)**

Comunicação direta com os web services da SEFAZ via XML assinado digitalmente. Exige:
- Geração e assinatura de XML conforme layout oficial (centenas de campos)
- Comunicação via SOAP/HTTPS com certificado mTLS
- Tratamento de contingência offline
- Manutenção contínua (a SEFAZ atualiza schemas frequentemente)
- Conhecimento profundo de legislação tributária (ICMS, CFOP, CST, NCM)

> **Veredicto:** Complexidade altíssima. Não é viável para o time atual. Exigiria meses de desenvolvimento e manutenção constante.

**Abordagem 2 — API intermediária (recomendada)**

Utilizar um provedor de API fiscal que abstrai toda a complexidade da SEFAZ. O ABRWF envia os dados da venda via REST/JSON, e o provedor cuida da geração do XML, assinatura, transmissão, contingência e retorno do DANFE.

### 2.4 Comparativo de Provedores de API Fiscal

| Provedor | Plano NFC-e | Preço Mensal | Notas Incluídas | Nota Extra | Destaques |
|----------|-------------|-------------|-----------------|-----------|-----------|
| **Focus NFe** | Retail | R$ 59,90 | 500 | R$ 0,12 | API REST madura, contingência automática, boa documentação |
| **Nuvem Fiscal** | Starter | R$ 150,00 | 1.000 | R$ 0,10 | Plano gratuito (50 notas/mês), API moderna, bom custo-benefício |
| **TecnoSpeed** | PlugDFe | Sob consulta | Variável | Variável | Componente + API, forte em Delphi, suporte técnico robusto |
| **NFE.io** | Básico | ~R$ 99,00 | 500 | R$ 0,15 | Interface amigável, bom para iniciantes |
| **DevNota** | Starter | R$ 49,90 | 200 | R$ 0,15 | Mais barato, API simples, empresa mais nova |

### 2.5 Análise de Compatibilidade com o ABRWF

O ABRWF já possui uma arquitetura que **facilita** a integração com API fiscal:

| Aspecto | Status | Observação |
|---------|--------|-----------|
| **Dados do produto** | Pronto | Tabela `products` já tem campos para NCM, unidade, preço |
| **Dados da venda** | Pronto | `salonOrders` e `sales` têm todos os dados necessários (itens, valores, pagamento) |
| **Dados da empresa** | Pronto | Tabela `companies` com CNPJ, IE, endereço |
| **Dados do cliente** | Parcial | CPF do cliente não é obrigatório na NFC-e (apenas se valor > R$ 200 em SP) |
| **Campos fiscais faltantes** | A implementar | NCM, CFOP, CST/CSOSN, alíquotas de ICMS por produto |
| **Certificado digital** | A configurar | Precisa ser armazenado de forma segura (A1 como arquivo no servidor) |
| **CSC/Token SEFAZ** | A configurar | Obtido via portal da SEFAZ do estado |

### 2.6 Campos Fiscais que Precisariam ser Adicionados

Para emitir NFC-e, cada produto precisa de informações fiscais que hoje não existem no cadastro:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **NCM** | Nomenclatura Comum do Mercosul (8 dígitos) | 22030000 (cerveja) |
| **CFOP** | Código Fiscal de Operações e Prestações | 5102 (venda mercadoria) |
| **CST/CSOSN** | Código de Situação Tributária | 102 (Simples Nacional sem crédito) |
| **Alíquota ICMS** | Percentual de ICMS | 18% (SP) |
| **CEST** | Código Especificador da Substituição Tributária | Quando aplicável |
| **Origem** | Nacional, importada, etc. | 0 (Nacional) |

### 2.7 Fluxo Proposto de Integração

```
[Garçom fecha comanda] 
    → [Sistema calcula totais] 
    → [Tela de pagamento + confirmação] 
    → [closeOrder no backend]
    → [Backend monta payload fiscal (JSON)]
    → [Envia para API do provedor (ex: Focus NFe)]
    → [Provedor gera XML, assina, transmite à SEFAZ]
    → [SEFAZ autoriza e retorna protocolo]
    → [Provedor retorna DANFE (PDF) + chave de acesso]
    → [Sistema salva referência fiscal na comanda]
    → [Garçom imprime DANFE NFC-e para o cliente]
```

### 2.8 Riscos e Pontos de Atenção

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Reforma Tributária 2026** | Novos campos obrigatórios (IBS, CBS) a partir de 2026 | Usar provedor de API que já está se adaptando (Focus NFe e Nuvem Fiscal já anunciaram suporte) |
| **Contingência offline** | Se a SEFAZ estiver fora, a venda não pode parar | Provedores como Focus NFe têm contingência automática (emite offline e transmite depois) |
| **Certificado digital** | Expira anualmente, precisa ser renovado | Alertar o admin 30 dias antes do vencimento |
| **Complexidade tributária** | ICMS varia por estado, produto e regime tributário | Simplificar: A Brasa Reúne provavelmente é Simples Nacional (CSOSN fixo) |
| **Custo mensal adicional** | R$ 50-150/mês do provedor + certificado digital (~R$ 150/ano) | Custo baixo comparado ao risco de multa por não emitir |

### 2.9 Estimativa de Esforço para Implementação

| Fase | Descrição | Estimativa |
|------|-----------|-----------|
| 1 | Adicionar campos fiscais ao cadastro de produtos (NCM, CFOP, CST) | 4-6h |
| 2 | Configuração do provedor (conta, certificado, CSC, ambiente homologação) | 2-3h |
| 3 | Backend: endpoint de emissão NFC-e (monta payload, chama API, salva retorno) | 6-8h |
| 4 | Frontend: botão "Emitir NFC-e" no fechamento + visualização do DANFE | 3-4h |
| 5 | Testes em homologação | 4-6h |
| 6 | Migração para produção | 2-3h |
| **Total estimado** | | **21-30h** |

### 2.10 Recomendação Final

A integração com SEFAZ para emissão de NFC-e é **viável e recomendada** para o ABRWF, desde que seja feita via **API intermediária** (Focus NFe ou Nuvem Fiscal). A arquitetura atual do sistema não apresenta impedimentos estruturais — os dados de venda, produtos e empresa já existem. Os principais investimentos são:

1. **Enriquecer o cadastro de produtos** com campos fiscais (NCM, CFOP, CST)
2. **Contratar um provedor de API fiscal** (~R$ 60-150/mês)
3. **Adquirir certificado digital A1** (~R$ 150/ano)
4. **Implementar o fluxo de emissão** no backend e frontend

A recomendação é **não implementar agora**, mas sim após estabilizar o módulo de salão e o pagamento dividido. Quando for o momento, sugerimos começar com o **Focus NFe** (plano Retail a R$ 59,90/mês) por ter a melhor relação custo-benefício para um único CNPJ e documentação clara para integração REST.

---

## 3. Priorização Sugerida

| Prioridade | Item | Justificativa |
|-----------|------|--------------|
| **1 (Agora)** | Configuração de % taxa de serviço | Já implementado nesta versão |
| **2 (Próximo)** | Pagamento dividido (Modalidade A) | Alta demanda operacional, impacto direto no atendimento |
| **3 (Médio prazo)** | QR Code no documento de vendas | Marketing e fidelização de clientes |
| **4 (Futuro)** | Integração SEFAZ (NFC-e) | Requer preparação fiscal e investimento, mas é obrigatória |
| **5 (Futuro)** | Transferência de comanda entre garçons | Funcionalidade administrativa, baixa urgência |

---

*Documento gerado em 08/03/2026 como referência para decisões de produto do ABRWF.*
