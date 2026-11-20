# Gestão de Vendas

App desktop (Electron) de vendas do viveiro. Os dados ficam em `%APPDATA%\gestao-de-vendas\vendas.db`.

## Desenvolvimento

```bash
npm install
npm run dev
npm test
```

## Gerar o instalador (sem publicar)

```bash
npm run build:win
```

Sai em `dist/gestao-de-vendas-<versão>-setup.exe`. Instale uma vez à mão no computador de quem usa; depois disso as atualizações chegam sozinhas.

## Publicar uma atualização

Com tudo commitado, um comando faz o resto:

```bash
npm run release
```

Ele, nesta ordem: verifica o build (typecheck + build), sobe a versão no `package.json` (`1.0.0` → `1.0.1`), cria o commit `release: v1.0.1` e a tag `v1.0.1`, envia para o GitHub e publica a release com o instalador, `latest.yml` e `.blockmap`. Usa o login do `gh` (ou `GH_TOKEN`, se definido).

Para mudanças maiores: `npm run release -- minor` (`1.0.1` → `1.1.0`) ou `npm run release -- major` (`→ 2.0.0`).

Na próxima vez que o app abrir, ele baixa a versão em segundo plano e pergunta se quer reiniciar; se não, instala ao fechar.

Se uma versão mudar a estrutura do banco, ela precisa converter os dados antigos ao abrir.
