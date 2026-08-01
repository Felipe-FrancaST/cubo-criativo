# Galeria de imagens dos produtos

## Alterações

- Cadastro e edição aceitam várias imagens por produto.
- Limite de 12 imagens por produto.
- Formatos aceitos: JPG, PNG, WEBP e AVIF.
- Limite de 10 MB por arquivo.
- Pré-visualização responsiva no painel administrativo.
- Seleção manual da imagem principal.
- Remoção individual de imagens novas ou já cadastradas.
- As imagens adicionais são salvas na coluna `images` da tabela `products`.
- A imagem principal é salva em `image_url` e também ocupa a primeira posição de `images`.
- Arquivos removidos durante a edição só são apagados do Storage depois que o produto é salvo com sucesso.
- Uploads novos são revertidos automaticamente se ocorrer erro ao salvar o produto.
- O catálogo e a página individual já usam a galeria existente do site.

## Banco de dados

Nenhum SQL novo é necessário. A implementação utiliza as colunas existentes:

- `products.image_url`
- `products.images`

E o bucket existente:

- `product-images`
