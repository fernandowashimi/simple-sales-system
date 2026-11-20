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

1. Aumente `version` no `package.json` (ex.: `1.0.0` → `1.0.1`). Sem isso o app não vê a versão como nova.
2. Commit.
3. Publique (usa o login do `gh`):

```powershell
$env:GH_TOKEN = gh auth token; npm run release
```

Isso cria a release `v<versão>` em github.com/fernandowashimi/simple-sales-system com o instalador, `latest.yml` e `.blockmap`. Na próxima vez que o app abrir, ele baixa a versão em segundo plano e pergunta se quer reiniciar; se não, instala ao fechar.

Se uma versão mudar a estrutura do banco, ela precisa converter os dados antigos ao abrir.
