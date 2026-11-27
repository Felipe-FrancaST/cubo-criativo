# Correção das requisições na recarga da home

- `claim-referral`: respostas de negócio recusadas são identificadas por `ok: false` e `reason`, sem confundir com rota inexistente. Indicações comprovadamente inválidas são removidas do armazenamento local; resgates bem-sucedidos deixam um marcador por conta e visita, mantendo o identificador de checkout e a validação de comissões no servidor. Erros reais de banco/autenticação continuam sendo erros; não apagam a indicação local.
- `home-banner`: prioriza o Storage, depois o banner legado e o padrão; se a consulta no servidor não puder ser concluída, mantém a contingência do frontend. Respostas degradadas possuem `degraded: true` e diagnóstico nos logs da Vercel. O painel permite reparar JSON inválido, mas não ignora erros reais de acesso ao salvar.
- Nenhuma migração SQL necessária. Atualizar projeto e publicar novamente na Vercel.
- Após publicar, recarregar a home com e sem login, conferir o banner personalizado e testar um link válido de vendedor. Se persistir erro, conferir a aba Network e logs da função na Vercel (sem compartilhar tokens).
- 38 testes direcionados aprovados, incluindo 10 novos testes de regressão. Não foi possível executar o build ou os testes que dependem de pacotes npm ausentes neste ambiente.
