# Cubo Criativo — Painel do vendedor, confirmação de saques e e-mails

## O que mudou nesta versão

- A confirmação administrativa **Marcar saque executado** utiliza `ConfirmationDialog` (React) em um portal ligado diretamente ao `document.body`, sem `window.confirm` ou `alert` do navegador. O modal exibe nome, Pix e valor, tem botões próprios e só envia o comando após confirmação. A remoção de vendedores também usa modal próprio.
- O cabeçalho e o menu lateral exibem **Área do vendedor** apenas quando `/api/affiliate?action=status` confirma, com o token do usuário, que existe um cadastro ativo de vendedor sem exclusão lógica. Ao sair, o acesso some. Ao voltar à aba, a permissão é consultada novamente. Os endpoints do vendedor continuam autenticados.
- E-mails comerciais (pedidos, atualizações, entrega, lembretes de Pix, clube VIP) foram padronizados com layout leve, branco, texto escuro e acento azul-petróleo. A imagem da logo, que é PNG transparente, aparece numa célula **branca**.
- Nova solicitação de saque: e-mail de controle estilizado enviado ao destinatário de `ORDER_EMAIL_TO` se `RESEND_API_KEY` e `RESEND_FROM` estiverem configurados; o painel do administrador continua recebendo a notificação independentemente do e-mail.
- Saque **executado ou recusado**: novo e-mail ao vendedor, gerado após a transição confirmada no banco. Se o provedor de e-mails falhar, a movimentação financeira não é revertida.
- E-mails automáticos de autenticação do Supabase: 13 modelos HTML em português, com logo em fundo branco, para copiar para o painel.

## Passos de publicação

1. Publique **todo o projeto** atualizado, incluindo `src/`, `api/` e `server/`. Não basta substituir somente os arquivos de estilo.
2. Verifique a configuração `SITE_URL` ou `APP_URL` com **HTTPS** e endereço público correto; os templates comerciais usam o endereço para carregar `/images/logo.png`.
3. Configure os e-mails de autenticação no **painel do Supabase**: `Authentication` → `Email Templates` (ou `Auth` → `Email Templates`, conforme a interface). A aplicação não consegue atualizar os modelos do painel remotamente apenas com um deploy do frontend.
4. Para **cada** item abaixo, copie o conteúdo do arquivo HTML indicado e ajuste também o **assunto**. Não cole os templates em um editor que substitua `{{ .ConfirmationURL }}`, `{{ .Token }}` etc. Essas variáveis devem permanecer intactas.
5. Em `Authentication` → `URL Configuration`, confira o `Site URL` como URL HTTPS pública da loja. Se necessário, adicione a URL do site e a rota de recuperação na lista de redirecionamentos permitidos.
6. Para os avisos de segurança, habilite cada notificação desejada no Supabase; **Password changed / Senha alterada** deve estar habilitada. Se o e-mail antigo continuar chegando em inglês, o assunto e o corpo do **modelo de segurança** ainda não foram alterados no painel correto.
7. Os e-mails comerciais são disparados por `RESEND_API_KEY` e `RESEND_FROM`. Use um remetente/domínio validado no Resend. Para os avisos do administrador sobre saques, configure também `ORDER_EMAIL_TO`.

## Assuntos e arquivos de autenticação

| Tipo mostrado no Supabase | Arquivo em `supabase/auth_email_templates/` | Assunto em português |
|---|---|---|
| Confirm sign up | `confirmacao_cadastro.html` | Cubo Criativo • Confirme seu e-mail |
| Invite user | `convite.html` | Cubo Criativo • Você recebeu um convite |
| Magic link | `link_magico.html` | Cubo Criativo • Seu acesso seguro |
| Change email address | `alteracao_email.html` | Cubo Criativo • Confirme seu novo e-mail |
| Reset password | `recuperacao_senha.html` | Cubo Criativo • Redefina sua senha |
| Reauthentication | `reautenticacao.html` | Cubo Criativo • Seu código de segurança |
| **Password changed** (notificação de segurança) | **`senha_alterada.html`** | **Cubo Criativo • Sua senha foi alterada** |
| Email address changed | `email_alterado.html` | Cubo Criativo • Seu e-mail foi alterado |
| Phone number changed | `telefone_alterado.html` | Cubo Criativo • Seu telefone foi alterado |
| Sign-in method linked | `metodo_vinculado.html` | Cubo Criativo • Novo método de acesso vinculado |
| Sign-in method removed | `metodo_removido.html` | Cubo Criativo • Método de acesso removido |
| Verification method added | `verificacao_adicionada.html` | Cubo Criativo • Nova verificação de segurança |
| Verification method removed | `verificacao_removida.html` | Cubo Criativo • Verificação de segurança removida |

Os modelos são HTML com CSS inline e variáveis oficiais do Supabase. A logo é carregada de `{{ .SiteURL }}/images/logo.png`; confirme que a imagem está pública no domínio configurado. Não substitua esse caminho por um arquivo local nem por uma imagem anexada.

### Configuração local via Supabase CLI (opcional)

No desenvolvimento local, é possível ligar os templates a `supabase/config.toml` usando `auth.email.template.*` e `auth.email.notification.*`. Os arquivos foram mantidos fora de `config.toml` para não modificar configurações de autenticação já existentes em produção. Em hospedagem Supabase Cloud, configure os templates no dashboard.

## Testes manuais obrigatórios

1. **Confirmação do administrador:** crie uma solicitação de saque em ambiente de teste. Clique em “Marcar saque executado”: deve aparecer o modal personalizado, sem aviso nativo do navegador. Feche sem confirmar: saque continua pendente. Confirme depois de simular a transferência e veja a atualização do status.
2. **Acesso vendedor:** usuário comum não vê o ícone nem o item de menu. Usuário vendedor ativo vê ambos, e consegue abrir `/vendedor`. Depois de desativar o vendedor, o acesso desaparece ao retornar à aba/atualizar. O servidor continua bloqueando ações de não vendedores.
3. **E-mail de senha alterada:** no Supabase, habilite e salve o modelo correspondente. Troque a senha de uma conta de testes e confira **assunto**, **texto em português**, **logo com fundo branco** e links.
4. **E-mails transacionais:** simule pedido pago, alteração de status, lembrete Pix e novo saque; confira o recebimento e a formatação em Gmail, Outlook e celular.
5. **Notificação de conclusão:** marque um saque de teste como pago ou recusado e confira a mensagem ao vendedor. O status deve ser salvo mesmo que o Resend não esteja configurado.
6. **Cache:** depois do deploy, abra a loja em uma aba anônima e faça recarregamento forçado. A mensagem nativa antiga não está presente nesta fonte; se aparecer, investigue a publicação antiga ou CDN/cache.

## Observações

- Não há migração SQL nova nesta atualização. As migrações de afiliados e saques das versões anteriores continuam obrigatórias.
- Os e-mails de autenticação e segurança são **enviados pelo Supabase**, não pelo sistema Resend da loja. Personalizar o código da loja não altera automaticamente os templates do painel do Supabase.
- NUNCA armazene ou envie a senha digitada no formulário de saque por e-mail.
