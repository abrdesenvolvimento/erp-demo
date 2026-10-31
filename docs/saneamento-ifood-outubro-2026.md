# Saneamento iFood — Outubro de 2026

## Escopo e segurança

Saneamento executado exclusivamente na empresa **Adega Beira Rio (empresa 1)**, a partir dos arquivos originais `Vendas-Out.json` e `Itens-Out.json`. O lote usou o UUID completo de cada pedido do iFood como chave de auditoria e idempotência. Nenhum registro da A Brasa foi consultado ou alterado.

- SHA-256 de `Vendas-Out.json`: `04d6bb4f428aeac883b50ca8776089e28a20760d0cb8b134afaa23d4a9b9f5fc`
- SHA-256 de `Itens-Out.json`: `3739b5267392dc8f0c147a67db6be84d10f54a0d6eb57ba7ea073628bfbc67f3`
- Regra oficial: total do pedido é ancorado em `valor_total_dos_itens`; cada linha é interpretada como preço unitário ou total de linha somente quando a combinação fecha exatamente em centavos.
- Linhas com quantidade zero foram excluídas da receita e do estoque; não foram convertidas em uma unidade.

## Resultado da aplicação

- Pedidos concluídos examinados: **1.111**
- Pedidos com distorção de cálculo: **36**
- Valor pela fórmula antiga: **R$ 7.095,99**
- Valor oficial dos itens: **R$ 1.679,29**
- Excesso removido das vendas: **R$ 5.416,70**
- Vendas existentes corrigidas: **35**
- Venda que não estava na base e foi criada: **1**
- Vendas duplicadas canceladas com estorno: **8**
- Ajustes de estoque registrados: **38**

## Validação pós-aplicação

A verificação independente confirmou **36 UUIDs**, **8 duplicidades**, **49 movimentos de ajuste/estorno** e **45 registros de auditoria**, sem nenhuma inconsistência.

Os dois mapeamentos de combo foram corrigidos e agora carregam multiplicador de unidades:

| SKU virtual iFood | Produto ABRWF | Multiplicador |
|---|---|---:|
| `VP3752667205938` | Combo 6 Heineken Ultimate 330ml | 6x |
| `VP9366898220104` | Combo 8 Cervejas Amstel Ultra 269ml | 8x |

## Detalhamento por pedido

| Pedido | Venda canônica | Antes | Oficial | Diferença (antes − oficial) | Duplicidades canceladas |
|---|---:|---:|---:|---:|---:|
| #0083 | 188070236 | R$ 64,90 | R$ 25,96 | R$ 38,94 | 0 |
| #0372 | 188070232 | R$ 191,76 | R$ 95,88 | R$ 95,88 | 0 |
| #0502 | 201030008 | R$ 27,97 | R$ 17,98 | R$ 9,99 | 0 |
| #1068 | 188070179 | R$ 155,89 | R$ 145,90 | R$ 9,99 | 0 |
| #1943 | 189720100 | R$ 87,84 | R$ 54,90 | R$ 32,94 | 0 |
| #2172 | 196800024 | R$ 173,94 | R$ 117,00 | R$ 56,94 | 0 |
| #2287 | 196080084 | R$ 48,96 | R$ 31,97 | R$ 16,99 | 0 |
| #2531 | 189720094 | R$ 508,30 | R$ 38,87 | R$ 469,43 | 1 |
| #2584 | 188070063 | R$ 40,15 | R$ 31,16 | R$ 8,99 | 0 |
| #2644 | 183540172 | R$ 79,88 | R$ 46,94 | R$ 32,94 | 0 |
| #2929 | 196080167 | R$ 21,44 | R$ 14,57 | R$ 6,87 | 0 |
| #3841 | 207360058 | R$ 49,72 | R$ 38,63 | R$ 11,09 | 0 |
| #3934 | 205170097 | R$ 43,22 | R$ 39,83 | R$ 3,39 | 0 |
| #4492 | 189720103 | R$ 140,48 | R$ 70,24 | R$ 70,24 | 4 |
| #4784 | 201030039 | R$ 22,96 | R$ 20,47 | R$ 2,49 | 0 |
| #5284 | 196080155 | R$ 29,93 | R$ 20,95 | R$ 8,98 | 0 |
| #6098 | criada | R$ 0,00 | R$ 105,36 | R$ -105,36 | 0 |
| #6169 | 189720027 | R$ 30,15 | R$ 27,16 | R$ 2,99 | 0 |
| #6482 | 207360064 | R$ 39,69 | R$ 37,20 | R$ 2,49 | 0 |
| #7253 | 188070186 | R$ 31,16 | R$ 21,07 | R$ 10,09 | 0 |
| #7579 | 196800025 | R$ 191,76 | R$ 95,88 | R$ 95,88 | 0 |
| #7869 | 205170032 | R$ 32,96 | R$ 22,97 | R$ 9,99 | 0 |
| #7926 | 183540058 | R$ 35,25 | R$ 27,06 | R$ 8,19 | 2 |
| #7992 | 205170111 | R$ 306,73 | R$ 49,74 | R$ 256,99 | 0 |
| #8010 | 188070115 | R$ 65,04 | R$ 48,05 | R$ 16,99 | 0 |
| #8503 | 189720084 | R$ 21,96 | R$ 10,98 | R$ 10,98 | 0 |
| #9049 | 183540185 | R$ 83,35 | R$ 56,08 | R$ 27,27 | 0 |
| #9128 | 205170105 | R$ 827,20 | R$ 97,03 | R$ 730,17 | 0 |
| #9162 | 188070219 | R$ 34,95 | R$ 25,96 | R$ 8,99 | 0 |
| #9367 | 205170103 | R$ 109,80 | R$ 32,94 | R$ 76,86 | 0 |
| #9416 | 189720093 | R$ 205,44 | R$ 35,01 | R$ 170,43 | 0 |
| #9633 | 197850005 | R$ 26,35 | R$ 15,37 | R$ 10,98 | 0 |
| #9723 | 183540165 | R$ 698,34 | R$ 46,35 | R$ 651,99 | 1 |
| #9735 | 196080162 | R$ 57,10 | R$ 52,91 | R$ 4,19 | 0 |
| #9853 | 188070107 | R$ 31,95 | R$ 20,97 | R$ 10,98 | 0 |
| #9916 | 183540005 | R$ 46,44 | R$ 39,95 | R$ 6,49 | 0 |

## Prevenção implantada

1. O importador normaliza os valores em centavos e não multiplica novamente uma linha cujo valor já representa o pacote.
2. O servidor relê os dois JSONs na importação; o navegador só envia os UUIDs selecionados. Assim, subtotal, preço unitário, total de linha e quantidade não são confiados ao frontend.
3. Casos ambíguos, sem fechamento exato ou sem preço unitário representável em centavos são bloqueados para revisão manual.
4. O De/Para ganhou multiplicador de unidades para SKU virtual de combo, aplicando a baixa física correta de estoque.
5. A gravação mantém a trava por UUID completo do iFood e registra company/branch em logs, divergências e vínculo de pedido.

## Observação de estoque

O produto **Fys Limão Siciliano 350ml** já estava com saldo negativo antes da correção. A devolução de uma unidade indevidamente baixada fez o saldo passar de -9 para -8. A aplicação usou a exceção de saldo negativo histórico já autorizada, preservando o movimento `ACERTO` e a auditoria.
