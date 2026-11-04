# Segurança individual do ABRWF

## Política aprovada

Cada pessoa utiliza sua própria conta e seu PIN de seis números. O acesso operacional exige um login autenticado e uma confirmação individual por PIN. A partir das **04h, no horário de Brasília**, a sessão anterior deixa de autorizar operações e é necessário iniciar novo login, seguido do PIN. Desbloquear uma pausa não prolonga esse prazo.

O bloqueio por inatividade começa em **5 minutos**. Em **Administração → Segurança**, um administrador vinculado à empresa pode escolher 1, 3, 5, 10, 15 ou 30 minutos. Cliques, toques, teclas, edição de campos e rolagem pela roda/trackpad gerados pelo navegador mantêm a sessão ativa; consultas automáticas, timers, rolagem programada e movimentos do mouse não contam. A confirmação de atividade tem intervalo mínimo de cinco segundos e depende da resposta do servidor, sem prolongar o prazo das 04h. O botão **Bloquear** permite proteger imediatamente a tela ao sair da máquina. Ao encerrar o turno, use **Sair / trocar operador**.

O bloqueio é aplicado no servidor, não apenas na interface. Atualizar a página não libera uma sessão bloqueada ou vencida. Logout e bloqueio são sincronizados entre abas; dados da identidade anterior são descartados antes de liberar uma nova sessão.

### Correção de bloqueios imediatos — 03/11/2026

Foi confirmado, em consulta somente leitura, que o banco arredonda `2026-11-04 02:00:00.600` para `02:00:01` em campos de precisão de segundo. As tabelas de segurança utilizam essa precisão. Antes da correção, uma gravação com milissegundos podia ser lida como uma atividade ou autenticação no futuro e recusada pela validação de sessão. Isso explica um mecanismo concreto de bloqueio logo após a confirmação correta do PIN; não significa que toda solicitação de PIN tivesse essa mesma causa.

Os horários gravados pelo módulo de segurança agora são truncados ao segundo **antes** da persistência. O relógio usado nas verificações permanece preciso e o veto a datas futuras continua vigente. A confirmação de atividade devolve o estado e os horários efetivamente registrados pelo servidor, sem aceitar um horário informado pelo navegador. Nenhuma política cadastrada pelo administrador, sessão histórica, venda ou estoque foi alterado nessa correção. Na consulta de 03/11, a política da Adega estava configurada em **1 minuto**, escolha preservada.

Revalidar a mesma pessoa em uma sessão ativa não limpa mais a identificação nem remonta o editor da tela. Salvar a política ou selecionar a empresa continua fazendo a verificação real no servidor, mas não força a tela comemorativa se o acesso permanece válido. Bloqueio e saída ocultam a operação imediatamente; mudar de pessoa ou sessão descarta os dados anteriores. Uma confirmação correta de PIN mantém o formulário indisponível até receber estado fresco **ACTIVE** e confirmar a identidade, evitando uma segunda solicitação por cache antigo. Falha de conexão apresenta recuperação, sem liberar a operação nem acusar PIN incorreto indevidamente. Políticas reduzidas ainda podem causar um bloqueio legítimo se a última atividade registrada já ultrapassou o novo limite.

Na validação de navegador com APIs totalmente fictícias, uma confirmação de PIN liberou a operação mesmo com resposta de estado atrasada; três revalidações ativas não exibiram aniversário; o bloqueio real voltou com um PIN; o KDS não remountou nem reimprimiu. Cliques reais do navegador no filtro de mês também produziram confirmações de atividade. Isso não substitui a conferência operacional no dispositivo do usuário após publicar.

## Login no celular e recuperação de erro

Inicie e conclua a autenticação no mesmo navegador e no mesmo endereço do ABRWF. A prévia embutida no Manus, o navegador e o aplicativo instalado podem manter cookies separados: uma tentativa iniciada em um deles não deve ser continuada em outro. Se surgir uma falha de validação, use **Voltar e tentar novamente** e inicie uma solicitação nova; não recarregue nem reaproveite a URL de retorno do provedor. Para a primeira conferência no iPhone, abra o endereço publicado diretamente no Chrome ou Safari, com cookies permitidos.

A prova de navegador usa cookie host-only, Secure e SameSite=None, por dez minutos. Ela é criada somente após o aquecimento e imediatamente antes de navegar ao provedor. Uma trava compartilhada impede tentativas simultâneas na mesma página, inclusive após a remontagem do formulário. Essa trava não promete sincronização de navegadores ou abas independentes. O worker de notificações permanece, mas o callback OAuth não é cacheado nem repetido automaticamente. Falhas continuam sendo recusadas antes da troca do código, sem contorno da validação ou do PIN; os registros técnicos não contêm código, estado ou cookies.

## Primeiro uso após publicar

1. Publicar em horário de menor movimento. Sessões antigas sem o novo identificador individual precisarão de novo login.
2. Cada pessoa deve entrar com a **própria conta**. Na primeira entrada, confirmar o nome apresentado, criar o PIN e digitá-lo novamente. O cadastro precisa ocorrer nos cinco minutos seguintes ao login; após esse prazo, iniciar nova autenticação.
3. Evitar sequências, dígitos únicos e padrões repetidos. Não compartilhar conta ou PIN. A conta autenticada no provedor externo também deve pertencer à pessoa que está entrando.
4. Em **Administração → Segurança**, revisar o tempo de inatividade da empresa.
5. Se uma máquina mantém KDS e impressão automáticos, um administrador deve abrir a mesma máquina e o mesmo navegador, selecionar a empresa correta e usar **Continuidade de produção → Registrar este navegador**. O pareamento vale 30 dias e pode ser renovado ou revogado.
6. Nessa estação, abrir o KDS, enviar um item de teste operacional autorizado, bloquear a tela e conferir o ticket físico. Desbloquear e verificar que o ticket não foi repetido. Este teste físico permanece a cargo da operação; os testes desta entrega simularam impressão sem acionar impressora real.

Não é necessário substituir o Print Agent para esta entrega. Seu formato de tickets foi preservado. O KDS automático depende de uma estação pareada; sem pareamento, a proteção humana também interrompe a sua interface. O pareamento só autoriza consultas de produção da empresa vinculada: não libera vendas, recebimentos, cancelamentos nem mudanças de status. A tela continua oculta durante o bloqueio. O acompanhamento automático depende de o navegador permanecer em execução e das permissões de rede local já exigidas pelo agente.

## PIN, recuperação e auditoria

O PIN é armazenado como hash scrypt com sal aleatório, nunca em texto. Cinco falhas de confirmação bloqueiam novas tentativas por 15 minutos, compartilhadas entre sessões da mesma pessoa. Um novo login não elimina esse bloqueio.

**Minha Conta → Segurança** mostra as sessões reais e permite revogá-las. **Minha Conta → Atividades** mostra os eventos de login, PIN, bloqueio e revogação, no horário de Brasília.

Em **Administração → Segurança**, um administrador pode redefinir o PIN de **outro usuário vinculado à empresa**, com motivo obrigatório. A operação revoga todas as sessões dessa pessoa; ela precisará autenticar novamente e cadastrar um novo PIN. Não há redefinição anônima, senha fictícia local nem recuperação própria sem validação. Recomenda-se manter um segundo administrador autorizado para recuperação; se houver apenas um administrador e ele perder o PIN, a recuperação precisa de procedimento assistido e auditável.

A proteção reduz o uso acidental de contas alheias, mas não identifica fisicamente quem está diante da máquina. Não impede que pessoas compartilhem deliberadamente conta e PIN. Bloquear ao se afastar e proibir o compartilhamento continuam sendo regras da operação.

## Edição comemorativa

Login e bloqueio receberam identidade ABRWF, com adaptação ao celular e apresentação estática, sem efeito de entrada. Durante **novembro de 2026**, o logo original ampliado e o selo dourado **1 ANO** formam uma assinatura única, acompanhada de:

> **Um ano construindo uma gestão mais inteligente**

A menção ao aniversário sai automaticamente no início de dezembro, no fuso de Brasília, sem nova publicação. O HTML inicial e a interface utilizam o mesmo horário do servidor para evitar uma troca de identidade visual na abertura. A apresentação não exibe “Carregando o sistema” ou “Verificando seu acesso”: o card permanece estático enquanto as verificações acontecem, com o botão Entrar desabilitado até o estado ser conhecido. O horário visual não autoriza nenhuma operação. Falhas reais ainda exibem recuperação. A transição após o login e as animações próprias de troca de empresa foram preservadas.

O card de identificação exibe instruções curtas e as ações necessárias para cada estado: entrar, cadastrar/confirmar PIN, trocar operador ou sair. Horários, fuso e tempo de inatividade não aparecem mais no rodapé; as políticas continuam vigentes e consultáveis em Segurança e Minha Conta. Identidade do operador, confirmação de propriedade da conta, erros, limite de tentativas e orientação de recuperação de PIN foram preservados.

## Escopo e verificações

Foram adicionadas tabelas próprias de sessões, PINs, políticas, eventos e terminais. Nenhuma venda, estoque, implantação histórica ou movimentação financeira foi alterada nesta entrega. O Heartbeat de backup mantém a autorização técnica separada e não precisa de PIN ou login humano diário.

A validação inclui testes unitários e de integração com banco simulado, callback OAuth com provedor simulado, autorização de API, prazo das 04h, tentativas de PIN, isolamento de políticas, interface e regressões de backup/restauração/iFood. A validação de montagem no navegador interceptou todas as APIs com dados fictícios e confirmou a hidratação da identidade após PIN, consulta KDS sem cookie operacional, preservação da estação durante bloqueio e ausência de reimpressão. Não houve autenticação no provedor real nem impressão física nesse teste.

Nesta rodada, Metas recebeu seleção de mês/ano, gráfico anual de atingimento por canal e comparativo do período escolhido com os dois meses anteriores. A consulta anual mantém a definição mensal existente de faturamento e o escopo da empresa inteira, sem misturar Adega e A Brasa. Consulta somente leitura confirmou as 19 metas de 2026 da Adega, incluindo os cadastros legados sem filial, e a paridade de receita e percentual com o cálculo mensal. Nenhuma meta ou movimentação financeira foi alterada para essa verificação.

Permanecem fora desta entrega: módulo Consumo, melhorias analíticas do KDS, teste completo de recuperação de backup e endurecimento independente do protocolo legado do agente/fila de impressão.
