import brand from './config.js'

export const legalUpdated = '09/11/2026'
export const legalDocuments = {
  privacy: {
    title: 'Política de Privacidade',
    path: '/privacy.html',
    intro: `Esta política explica como a ${brand.name}, CNPJ ${brand.cnpj}, trata dados de visitantes e clientes. A leitura desta página não representa consentimento genérico para qualquer uso dos seus dados.`,
    sections: [
      [
        'Dados tratados e finalidades',
        [
          'Para criar e proteger sua conta, usamos os dados de identificação e autenticação fornecidos no cadastro. Para processar compras, utilizamos nome, e-mail, telefone, CPF, endereços, itens escolhidos, valores e situação dos pagamentos. Dados de nascimento e endereço adicional podem integrar o perfil, conforme preenchimento do cadastro.',
          'Também tratamos mensagens de atendimento, escolhas do clube VIP, favoritos, participação em benefícios, avaliações e registros técnicos necessários ao funcionamento e à segurança. Evite enviar informações sensíveis ou dados de outras pessoas sem necessidade.',
        ],
      ],
      [
        'Fundamentos e limites de uso',
        [
          'Cadastro, pedidos, pagamento e entrega são tratados para executar a compra e os procedimentos solicitados por você. Obrigações fiscais, contábeis e outras exigências legais justificam a conservação dos registros correspondentes. A prevenção de fraude e a defesa de direitos seguem as bases legais aplicáveis, com uso limitado ao necessário.',
          'Quando uma atividade depender de consentimento, a finalidade deve ser informada e a escolha deve ser específica e revogável. Comunicações sobre uma compra ou recuperação de acesso não são uma autorização para publicidade indiscriminada.',
        ],
      ],
      [
        'Serviços utilizados e compartilhamento',
        [
          'O projeto utiliza Supabase para autenticação e banco de dados, Vercel para hospedagem e métricas de navegação, Mercado Pago para pagamentos e Resend para e-mails quando habilitado. Transportadoras recebem os dados necessários à entrega. O WhatsApp é um canal externo de atendimento escolhido por você.',
          'No checkout de cartão, os dados completos do cartão e o código de segurança são informados ao provedor de pagamento; não são campos armazenados pelo aplicativo da loja. Recebemos identificadores, valores e situação da transação para acompanhar seu pedido.',
          'Se usar login com Google, recebemos os dados básicos autorizados para identificar a conta. Não recebemos a senha da sua conta Google. Fornecedores podem processar dados fora do Brasil; o tratamento deve observar as garantias e mecanismos aplicáveis às transferências internacionais. Solicite informações sobre esses serviços pelo canal de privacidade.',
        ],
      ],
      [
        'Armazenamento no navegador e métricas',
        [
          'Cookies e armazenamento local ou de sessão mantêm autenticação, carrinho, preferências e estado de navegação. Links de afiliados podem registrar a indicação e um identificador de visitante para atribuição da compra e controle de comissões.',
          'Utilizamos Vercel Web Analytics para estatísticas de acesso e interação. O envio de eventos do aplicativo remove parâmetros e fragmentos das URLs e exclui rotas privadas. O aplicativo respeita o sinal Do Not Track do navegador para esses eventos. Essas medidas não eliminam os registros operacionais necessários à hospedagem e à segurança.',
          'Você pode limpar ou restringir o armazenamento pelas configurações do navegador. Isso pode encerrar a sessão e apagar o carrinho ou preferências locais; não exclui automaticamente sua conta nem os registros de pedidos.',
        ],
      ],
      [
        'Avaliações e conteúdo publicado',
        [
          'Avaliações aprovadas podem aparecer publicamente com o nome de exibição, nota, comentário e informações do produto. Não inclua CPF, endereço, telefone ou informações confidenciais em comentários. Você pode solicitar correção ou remoção pelo atendimento.',
        ],
      ],
      [
        'Conservação e segurança',
        [
          'Os dados são conservados enquanto necessários à conta, ao atendimento e aos pedidos, ou durante prazos exigidos por lei e pelo exercício de direitos. Não aplicamos um único prazo a todos os registros. Ao fim da necessidade e das hipóteses de retenção, devem ser eliminados ou anonimizados.',
          'Utilizamos controles de acesso e recursos de segurança dos serviços contratados. Nenhum sistema é imune a incidentes. Caso perceba acesso indevido à sua conta, altere sua senha e entre em contato. Não solicitamos sua senha ou códigos de autenticação por WhatsApp.',
        ],
      ],
      [
        'Seus direitos e como solicitar',
        [
          'Você pode pedir confirmação e acesso, correção, informações sobre compartilhamento, anonimização, bloqueio ou eliminação de dados excessivos ou irregulares, portabilidade quando aplicável, revogação de consentimento e revisão de decisões exclusivamente automatizadas que afetem seus interesses.',
          'Envie a solicitação ao e-mail ou WhatsApp abaixo, informando o e-mail da conta e o que deseja. Não há cobrança pelo exercício desses direitos. Podemos verificar sua identidade com informações proporcionais ao pedido para proteger seus dados. Informaremos eventuais motivos legais que impeçam o atendimento integral.',
          'Confirmação e acesso em formato simplificado podem ser fornecidos imediatamente; a declaração completa prevista na LGPD tem prazo de até 15 dias, observadas as regras aplicáveis. Você também pode recorrer à ANPD e aos órgãos de defesa do consumidor.',
        ],
      ],
      [
        'Exclusão da conta',
        [
          'A exclusão pode ser solicitada nas configurações da conta ou pelo atendimento, inclusive quando não for possível concluir pelo login social. Registros cuja conservação seja legalmente necessária podem permanecer com acesso restrito. Excluir a conta não cancela automaticamente pedidos em andamento nem retira seus direitos sobre compras realizadas.',
        ],
      ],
      [
        'Atualizações',
        [
          'Esta página identifica a data da versão vigente. Mudanças relevantes nas finalidades serão informadas de forma adequada e, quando necessário, dependerão de uma nova escolha sua.',
        ],
      ],
    ],
  },
  terms: {
    title: 'Termos de Serviço',
    path: '/terms.html',
    intro:
      'Estas condições orientam o uso da loja e as compras de miniaturas, peças e planos VIP. Leia também a política de trocas e a descrição da oferta antes de pagar. Nenhuma disposição afasta direitos previstos na legislação de defesa do consumidor.',
    sections: [
      [
        'Identificação e atendimento',
        [
          `A loja utiliza a marca ${brand.name}, CNPJ ${brand.cnpj}, em ${brand.city}. Os canais oficiais estão no final desta página. Use-os para dúvidas, reclamações, cancelamento, devolução e privacidade.`,
          'O atendimento humano ocorre de segunda a sexta-feira, das 09h às 18h. Mensagens podem ser enviadas a qualquer momento. Demandas de consumo devem ter recebimento confirmado e manifestação em até cinco dias, conforme a regulamentação do comércio eletrônico.',
        ],
      ],
      [
        'Conta e segurança',
        [
          'Informe dados corretos e mantenha seus meios de acesso protegidos. Se houver suspeita de uso indevido, avise o atendimento. Medidas contra fraude ou abuso devem ser proporcionais e não prejudicam direitos sobre pedidos legítimos. Compras por menores de idade devem contar com representação ou assistência do responsável, conforme aplicável.',
        ],
      ],
      [
        'Produtos e condições da oferta',
        [
          'Confira escala, medidas, material, acabamento, pintura, itens incluídos e disponibilidade na descrição da peça. Fotos e informações suficientemente precisas integram a oferta. Pequenas diferenças artesanais não justificam entregar uma peça com defeito ou diferente do contratado.',
          'Miniaturas de resina podem conter partes frágeis ou pequenas. Observe os cuidados e a indicação de uso de cada produto e mantenha peças pequenas longe de crianças e animais.',
          'Mudanças de preço e disponibilidade valem para novas compras, respeitadas as ofertas e contratações já realizadas. Divergências serão comunicadas e tratadas conforme a legislação, sem substituição ou cobrança adicional imposta ao cliente.',
        ],
      ],
      [
        'Revisão do pedido e pagamento',
        [
          'Antes de pagar, revise itens, quantidades, escala, valores, descontos e endereço. Pix e cartão são processados pelo Mercado Pago. Não envie dados de cartão pelo atendimento. A geração de um Pix não confirma o pagamento; a aprovação é acompanhada no pedido.',
          'O frete e quaisquer despesas adicionais devem ser informados antes da contratação. Se uma oferta depender de cotação de envio, solicite a confirmação do valor total e do prazo antes de concluir. Ausência de cotação não significa frete grátis.',
          'Acompanhe a compra em Meus pedidos e conserve o comprovante. Em caso de pagamento duplicado, divergência ou problema de confirmação, contate a loja com o número do pedido, sem reenviar dados completos do cartão.',
        ],
      ],
      [
        'Produção e entrega',
        [
          'Peças sob encomenda têm referência geral de 15 a 30 dias úteis de produção; a condição específica informada na oferta ou confirmada no orçamento prevalece. Produção e transporte são etapas distintas. Peças em estoque não exigem esse período de fabricação.',
          'O prazo combinado deve ser respeitado. Se houver atraso ou impossibilidade de entrega, a loja prestará atendimento e apresentará as alternativas legais ao cliente. A contratação de transportadora não afasta a responsabilidade da loja pela solução do problema.',
        ],
      ],
      [
        'Planos VIP e renovação',
        [
          'Antes da compra, confira o plano, preço, ciclo de referência, quantidades e tipos de peças, benefícios e regras de escolha exibidos na área de assinatura. As escolhas e o andamento são acompanhados na Área VIP.',
          'Nesta versão do site, a renovação é iniciada pelo cliente e exige um novo pagamento; não há débito recorrente automático implementado. A liberação depende da confirmação do pagamento. Mudanças de plano ou de um ciclo futuro não retiram benefícios já contratados. Para cancelamento e devolução, aplicam-se os direitos legais e a política de trocas.',
        ],
      ],
      [
        'Arrependimento, defeitos e reembolso',
        [
          'Compras pela internet têm direito de arrependimento no prazo legal de sete dias. Para produtos físicos, a contagem considera o recebimento. A política de trocas detalha o procedimento, os custos de devolução e os direitos em caso de defeito.',
          'Produção sob encomenda ou personalização não elimina automaticamente os direitos do consumidor. Uma exigência de fotos, embalagem ou análise interna não pode reduzir os prazos legais nem impedir uma solicitação válida.',
        ],
      ],
      [
        'Cupons, avaliações e uso do site',
        [
          'Cupons e benefícios seguem as condições informadas, como validade, limite e produtos elegíveis. Medidas contra fraude não devem cancelar benefícios regularmente adquiridos sem fundamento. Avaliações devem descrever experiências reais, sem dados privados, ofensas ou conteúdo ilícito.',
          'Respeite os direitos da loja e de terceiros sobre marcas, imagens e modelos. É vedado invadir contas, manipular pagamentos ou explorar falhas para obter vantagem indevida.',
        ],
      ],
      [
        'Privacidade, disponibilidade e alterações',
        [
          'O tratamento de dados está explicado na Política de Privacidade. Interrupções técnicas podem ocorrer e serão tratadas pelos canais de suporte, sem exclusão genérica de responsabilidade legal.',
          'Atualizações destes termos valem para contratações futuras, preservadas as condições e direitos das compras anteriores. Você pode imprimir ou salvar esta página como PDF pelo navegador. Questões de consumo podem ser levadas aos órgãos competentes e ao foro legalmente assegurado ao consumidor.',
        ],
      ],
    ],
  },
  returns: {
    title: 'Trocas, devoluções e encomendas',
    path: '/trocas-e-devolucoes',
    intro:
      'Aqui você encontra como pedir cancelamento, comunicar um problema e acompanhar a devolução. O atendimento está disponível por e-mail e WhatsApp, sem necessidade de justificar o arrependimento.',
    sections: [
      [
        'Arrependimento em compras pela internet',
        [
          'Você pode comunicar a desistência em até 7 dias corridos após receber o produto. Envie o número do pedido e sua identificação por um dos canais abaixo. A solicitação feita dentro do prazo preserva o direito mesmo que a orientação de postagem seja enviada depois.',
          'No arrependimento legal, a devolução não tem custo para o consumidor e abrange os valores pagos, inclusive o frete original. A loja orientará a logística de retorno e comunicará o cancelamento ou estorno ao provedor de pagamento. A visualização do crédito depende do processamento da instituição financeira, sem limitar o direito à restituição.',
        ],
      ],
      [
        'Defeito, avaria ou item diferente',
        [
          'Informe o pedido e descreva o problema. Fotos da peça e da embalagem ajudam, quando disponíveis; vídeo de abertura da caixa não é condição para atendimento. Não tente consertar a peça antes de receber orientação.',
          'Para produtos duráveis, o prazo legal para reclamar de vícios aparentes é de 90 dias do recebimento. Em vícios ocultos, a contagem começa quando o problema se torna evidente. A solução observará as alternativas e prazos legais, inclusive reparação, substituição, abatimento ou restituição quando cabíveis.',
        ],
      ],
      [
        'Como devolver',
        [
          'Entre em contato antes de postar para receber as instruções e o destino correto. Preserve os itens e acessórios e use embalagem que proteja a peça; aproveite a original se disponível. A ausência da embalagem original, por si só, não elimina direitos legais.',
          'No arrependimento legal e nos problemas de responsabilidade do fornecedor, os custos necessários ao retorno não serão transferidos ao consumidor. Para trocas voluntárias fora dessas situações, as condições e eventuais custos serão combinados previamente.',
        ],
      ],
      [
        'Encomendas, prazos e cancelamento',
        [
          'Escala, acabamento, personalização, produção e entrega devem ser esclarecidos antes da compra. Não há exclusão automática de direitos por a peça ser feita sob encomenda. Solicite o cancelamento pelo atendimento mesmo que a produção tenha começado, para orientação conforme o caso e a legislação.',
          'A referência geral é de 15 a 30 dias úteis de produção, acrescida do transporte, respeitado o prazo da oferta específica. Atrasos e descumprimento da oferta serão tratados com o cliente, sem impor nova condição unilateralmente.',
        ],
      ],
      [
        'Acompanhe sua solicitação',
        [
          'Guarde a mensagem enviada e o número do pedido. Se a opção de cancelamento não estiver disponível em Meus pedidos, use o e-mail ou WhatsApp abaixo. O horário do atendimento humano não reduz o prazo para enviar sua solicitação.',
        ],
      ],
    ],
  },
}
