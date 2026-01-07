# Integração Catálogo Digital + ERP ABRWF

**Documento de Planejamento e Especificação Técnica**

*Adega Beira Rio - Janeiro/2026*

---

## 1. Contexto e Histórico

O catálogo digital da Adega Beira Rio foi o projeto inicial que deu origem ao sistema ERP ABRWF. Atualmente, o catálogo é um arquivo HTML estático com produtos e preços "hardcoded", exigindo atualização manual sempre que há mudanças.

Com o ERP em estágio avançado, surge a oportunidade de integrar ambos os sistemas, tornando o catálogo dinâmico e sempre atualizado automaticamente.

---

## 2. Análise do Catálogo Atual

### 2.1 Estrutura Identificada

| Aspecto | Detalhes |
|---------|----------|
| **Formato** | HTML estático (3.090 linhas) |
| **Categorias** | 15 categorias de produtos |
| **Produtos** | ~137 produtos únicos |
| **Design** | Elegante com cores dourado/verde, categorias expansíveis |
| **Responsividade** | Sim, adaptado para mobile |
| **Interatividade** | Hover effects, expansão de categorias |

### 2.2 Categorias Existentes

1. Água
2. Bebida Mista
3. Cachaça
4. Biter
5. Conhaque
6. Cerveja Unidade
7. Cerveja Pack
8. Chopp
9. Energético
10. Gin
11. Licor
12. Refrigerante
13. Isotônico
14. Suco
15. Vinho

### 2.3 Limitações Atuais

- **Preços estáticos**: Requer edição manual do HTML para atualizar preços
- **Produtos fixos**: Novos produtos não aparecem automaticamente
- **Sem controle de estoque**: Não indica disponibilidade
- **Manutenção trabalhosa**: Qualquer alteração exige conhecimento técnico
- **Desatualização frequente**: Risco de mostrar preços incorretos ao cliente

---

## 3. Oportunidades de Integração

### 3.1 Catálogo Dinâmico (Prioridade Alta)

**Descrição**: Gerar o catálogo automaticamente a partir dos dados do ERP.

**Benefícios**:
- Preços sempre atualizados (sincronizados com o canal "Balcão")
- Novos produtos aparecem automaticamente ao serem cadastrados
- Produtos inativos são ocultados automaticamente
- Zero manutenção manual do catálogo

**Implementação Técnica**:
```
Endpoint: GET /api/catalogo
Fonte de dados: tabela products + productPrices (canal Balcão)
Filtros: active=true, currentStock > 0 (opcional)
Ordenação: por categoria > subcategoria > nome
```

**Esforço estimado**: 2-3 dias

---

### 3.2 Indicador de Disponibilidade (Prioridade Alta)

**Descrição**: Mostrar status de estoque em tempo real no catálogo.

**Opções de exibição**:

| Status | Condição | Exibição |
|--------|----------|----------|
| Disponível | currentStock > minStock | Badge verde "Em estoque" |
| Últimas unidades | currentStock <= minStock && > 0 | Badge laranja "Últimas unidades" |
| Esgotado | currentStock = 0 | Badge vermelho "Esgotado" ou ocultar |

**Benefícios**:
- Cliente sabe antes de ir à loja se o produto está disponível
- Evita frustração e reclamações
- Cria senso de urgência para produtos escassos

**Esforço estimado**: 1 dia (junto com catálogo dinâmico)

---

### 3.3 Sistema de Pedidos Online (Prioridade Média)

**Descrição**: Permitir que clientes façam pedidos diretamente pelo catálogo.

**Fluxo proposto**:
1. Cliente acessa catálogo (via QR Code na loja ou link)
2. Adiciona produtos ao carrinho
3. Informa dados de contato (nome, telefone)
4. Confirma pedido
5. Pedido entra no ERP como venda pendente
6. Funcionário finaliza a venda no balcão

**Benefícios**:
- Agiliza atendimento em horários de pico
- Cliente pode montar pedido enquanto espera
- Reduz erros de comunicação

**Considerações**:
- Não é e-commerce completo (sem pagamento online)
- Funciona como "pré-pedido" para retirada
- Pode evoluir para delivery no futuro

**Esforço estimado**: 5-7 dias

---

### 3.4 Catálogo por Canal (Prioridade Média)

**Descrição**: Gerar versões diferentes do catálogo para cada canal de venda.

**Versões possíveis**:

| Canal | Preços | Produtos | Uso |
|-------|--------|----------|-----|
| Balcão | Canal Balcão | Todos ativos | QR Code na loja |
| Delivery | Canal Delivery | Apenas entregáveis | WhatsApp/iFood |
| Atacado | Canal Atacado | Packs/caixas | Clientes B2B |

**Benefícios**:
- Preços corretos para cada contexto
- Evita confusão de preços entre canais
- Marketing direcionado

**Esforço estimado**: 2 dias (após catálogo dinâmico)

---

### 3.5 Promoções Dinâmicas (Prioridade Média)

**Descrição**: Destacar automaticamente produtos em situações especiais.

**Regras automáticas**:

| Situação | Destaque | Lógica |
|----------|----------|--------|
| Margem alta | "Recomendado" | margem > 30% |
| Próximo vencimento | "Oferta" | vencimento < 30 dias |
| Estoque alto | "Promoção" | currentStock > 3x minStock |
| Novo produto | "Novidade" | createdAt < 15 dias |

**Benefícios**:
- Gira estoque de produtos parados
- Evita perdas por vencimento
- Destaca produtos mais rentáveis

**Esforço estimado**: 2 dias

---

### 3.6 Integração WhatsApp (Prioridade Baixa)

**Descrição**: Enviar catálogo formatado via WhatsApp ou gerar link compartilhável.

**Opções**:
1. **Link do catálogo**: URL pública que cliente acessa
2. **PDF gerado**: Catálogo em PDF para envio
3. **Mensagem formatada**: Lista de produtos com preços para copiar/colar

**Benefícios**:
- Facilita divulgação
- Cliente pode consultar offline (PDF)
- Integra com fluxo de atendimento existente

**Esforço estimado**: 1-2 dias

---

### 3.7 Analytics do Catálogo (Prioridade Baixa)

**Descrição**: Rastrear visualizações e interações no catálogo.

**Métricas possíveis**:
- Produtos mais visualizados
- Categorias mais acessadas
- Tempo médio no catálogo
- Taxa de conversão (visualização → pedido)
- Horários de pico de acesso

**Benefícios**:
- Entender preferências dos clientes
- Otimizar posicionamento de produtos
- Identificar produtos com alta demanda

**Esforço estimado**: 3-4 dias

---

## 4. Arquitetura Proposta

### 4.1 Opção A: Página no ERP (Recomendada)

```
ERP ABRWF
├── /catalogo (rota pública)
│   ├── Renderiza produtos do banco
│   ├── Preços do canal selecionado
│   └── Estoque em tempo real
```

**Vantagens**:
- Tudo em um sistema só
- Dados sempre sincronizados
- Fácil manutenção

**Desvantagens**:
- Depende do ERP estar online
- URL menos "limpa"

### 4.2 Opção B: Site Separado com API

```
Catálogo (site estático)     ERP ABRWF
        │                        │
        └──── API REST ──────────┘
              /api/catalogo
              /api/produtos
              /api/pedidos
```

**Vantagens**:
- URL própria (catalogo.adegabeirario.com.br)
- Performance otimizada
- Pode funcionar offline (cache)

**Desvantagens**:
- Dois sistemas para manter
- Precisa de CORS/autenticação

---

## 5. Roadmap Sugerido

### Fase 1: Catálogo Dinâmico Básico (Semana 1)
- [ ] Criar endpoint /api/catalogo no ERP
- [ ] Criar página /catalogo com design atual
- [ ] Sincronizar produtos e preços do canal Balcão
- [ ] Adicionar indicador de disponibilidade

### Fase 2: Multi-canal (Semana 2)
- [ ] Parâmetro de canal na URL (/catalogo?canal=delivery)
- [ ] Preços específicos por canal
- [ ] Filtro de produtos por canal

### Fase 3: Promoções e Destaques (Semana 3)
- [ ] Badges automáticos (Novidade, Oferta, etc.)
- [ ] Seção de destaques no topo
- [ ] Produtos próximos do vencimento

### Fase 4: Pedidos Online (Semana 4-5)
- [ ] Carrinho de compras
- [ ] Formulário de pedido
- [ ] Integração com vendas do ERP
- [ ] Notificação para funcionários

### Fase 5: Analytics e Otimizações (Semana 6)
- [ ] Rastreamento de visualizações
- [ ] Dashboard de métricas
- [ ] Otimizações de performance

---

## 6. Considerações Técnicas

### 6.1 Performance
- Cache de produtos (atualizar a cada 5 minutos)
- Lazy loading de imagens
- Compressão de assets

### 6.2 SEO
- Meta tags dinâmicas
- Schema.org para produtos
- Sitemap automático

### 6.3 Segurança
- Rate limiting na API
- Validação de pedidos
- Proteção contra spam

### 6.4 Mobile
- Design mobile-first
- PWA (Progressive Web App) opcional
- Compartilhamento nativo

---

## 7. Conclusão

A integração do catálogo com o ERP ABRWF representa uma evolução natural do sistema, eliminando trabalho manual e garantindo informações sempre atualizadas para os clientes.

A implementação pode ser feita de forma incremental, começando pelo catálogo dinâmico básico e evoluindo para funcionalidades mais avançadas conforme a necessidade.

**Próximo passo recomendado**: Implementar a Fase 1 (Catálogo Dinâmico Básico) após conclusão das melhorias pendentes do ERP.

---

*Documento gerado em 07/01/2026*
*ERP ABRWF - Adega Beira Rio*
