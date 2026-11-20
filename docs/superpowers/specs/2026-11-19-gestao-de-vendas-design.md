# Gestão de Vendas — Fructus Viveiro (design)

Data: 2026-11-19

## Intenção e porquê

Hoje as vendas do viveiro são controladas manualmente numa planilha. O objetivo é **produtividade e agilidade** no cadastro e **dados padronizados**: nada perdido, nada duplicado (produtos e compradores com grafias diferentes, linhas esquecidas).

Usuário: **uma pessoa, num único computador Windows**.

## Objetivos

- Catálogo de produtos importado do CSV, com nomes padronizados; criar e editar produtos.
- Cadastro rápido de vendas (feito para o teclado): n itens por venda, cada um com produto, quantidade e preço unitário escolhido na hora.
- Comprador opcional com autocomplete; comprador novo é criado ao salvar a venda.
- Venda tem data e um booleano "enviado".
- Tabela de vendas com busca, ordenação, agrupamento (produto, comprador, data), filtros por campo e por período.
- Exportação para Excel (.xlsx), com tudo ou só o que passa nos filtros atuais.
- Backup do banco com um clique.

## Fora do escopo (não-objetivos)

- Importar as vendas da planilha atual. O sistema começa com a tabela de vendas vazia (decisão do usuário).
- Estoque. As quantidades do CSV são ignoradas e o produto não guarda estoque.
- Preço fixo no produto.
- Cadastro separado de compradores (telefone, endereço etc.). Comprador é só um nome.
- Multiusuário, rede, celular, sincronização na nuvem, login.
- Relatórios e gráficos além da tabela.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Gerar duplicados ("João Silva" e "joão silva ", "Jaca Sidhu" e "jaca sidhu").
- Perder dados: venda salva pela metade, ou dados apagados por limpeza do navegador ou cache.
- Cadastro mais lento que digitar na planilha (exigir mouse a cada linha, muitos cliques, modais em cascata).

## Restrições

- Windows 10, Node 24 instalado, **sem Rust** (Tauri descartado).
- Interface com **BoardUI** (React + Tailwind v4) seguindo a skill `boardui`: usar os componentes reais do BoardUI, tokens semânticos, `cx()` e dark mode pelos tokens. O refinamento visual segue a skill `design-taste-frontend`.
- CSV de origem: `C:\Users\Shinji\Downloads\Produtos Fructus Viveiro.CSV`, com separador `;`, codificação **Windows-1252** (não UTF-8), cabeçalho `Nome do produto;Quantidade;;;`, 142 produtos.

## Abordagens consideradas

1. **App web local (servidor Node + SQLite, aberto no navegador)**: simples e dados em arquivo. O usuário preferiu um programa de desktop.
2. **Só navegador com IndexedDB**: descartada porque os dados ficam presos ao perfil do navegador e somem se alguém limpar o cache ou trocar de navegador. Vai contra o "nada perdido".
3. **App desktop**: **escolhida pelo usuário.** Entre Electron e Tauri, **Electron** foi decisão minha: o Tauri exige Rust (não instalado), e o Electron mantém tudo em JavaScript/TypeScript.

Sobre o banco, foram considerados SQLite, JSON (lowdb) e PGlite. **SQLite** foi escolhido porque garante unicidade e transações no próprio banco e cabe num único arquivo fácil de copiar. O JSON não garante nada disso, e o PGlite é mais do que o necessário.

## Arquitetura (decidida)

- **Electron** com processo main, preload e renderer. O renderer é **React + TypeScript + Vite + Tailwind v4 + BoardUI**. Template sugerido: `electron-vite`.
- **Banco**: `better-sqlite3` no processo main. O arquivo `vendas.db` fica em `app.getPath('userData')`.
- **Comunicação**: o renderer não acessa o banco direto. O preload expõe via `contextBridge` uma API tipada (ex.: `api.products.list()`, `api.sales.save(venda)`) e o main atende por `ipcMain.handle`. Configuração: `contextIsolation: true` e `nodeIntegration: false`.
- **Tabela**: TanStack Table (agrupamento, ordenação, filtros), renderizada com o componente de tabela do BoardUI.
- **Excel**: `exceljs` no processo main, com diálogo nativo "Salvar como".
- **Instalador**: `electron-builder` com alvo NSIS (`.exe`).

## Modelo de dados

Valores em dinheiro são guardados em **centavos (inteiro)**. Datas ficam em `TEXT` no formato ISO `YYYY-MM-DD`.

```sql
products   (id INTEGER PK, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT)
buyers     (id INTEGER PK, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT)
sales      (id INTEGER PK, buyer_id INTEGER NULL REFERENCES buyers(id),
            date TEXT NOT NULL, shipped INTEGER NOT NULL DEFAULT 0, created_at TEXT)
sale_items (id INTEGER PK, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0))
```

- Ativar `PRAGMA foreign_keys = ON`.
- Quantidade é um número inteiro, porque são mudas.
- O preço unitário pode ser 0, para cobrir brindes.

## Regras de padronização e deduplicação

- **`name_key`** (chave de duplicidade): `trim`, espaços internos colapsados, minúsculas e acentos removidos (NFD sem diacríticos). Exemplo: `" João  Silva"` vira `joao silva`. A unicidade é garantida no banco pelo `UNIQUE`.
- **Nome exibido (padronização "Capitalize")**: aplicado a produtos e compradores, ao importar e ao salvar.
  - `trim` e espaços colapsados.
  - Cada palavra separada por espaço fica com a primeira letra maiúscula e o resto minúsculo.
  - **Exceções**:
    - Conectivos `de, do, da, dos, das, e` ficam minúsculos, exceto quando são a primeira palavra.
    - Palavras totalmente em maiúsculas com 2 ou mais caracteres são preservadas (siglas como `ES`, `RJ`, `Z4`, `E4`, `J-33`).
  - Exemplos:
    - `jabuticaba branca gigante` → `Jabuticaba Branca Gigante`
    - `Jaca rosa ES` → `Jaca Rosa ES`
    - `Jabuticaba Sabará de cabinho` → `Jabuticaba Sabará de Cabinho`
  - Termos científicos seguem a mesma regra (`Artocarpus Hirsutus`). O usuário aceitou uma regra única.
- Erros de grafia do CSV (`Artocapus`, `Garcynia`, `corada`, `Grimal`) **não** são corrigidos automaticamente. O usuário pode renomear pela tela de Produtos.

## Importação inicial (seed)

- Converter o CSV para UTF-8 e incluí-lo no repositório (ex.: `resources/produtos-seed.csv`).
- Na primeira execução, se `products` estiver vazia, importar: só a coluna 1, padronizada e deduplicada por `name_key`. Colunas extras são ignoradas, como o `8` solto na linha "Rambutam hermafrodita" e as quantidades. Linhas vazias também são ignoradas.

## Telas

A navegação é uma barra lateral com **Vendas**, **Nova venda** e **Produtos**.

### Nova venda / editar venda

```
Comprador [João Si|          ]  Data [19/11/2026]  [ ] Enviado
          └ João Silva
          └ + Cadastrar "João Si" ao salvar
──────────────────────────────────────────────────────
Produto                    Qtd   Preço unit.  Subtotal
[Jaca Sid|             ]   [2]   [R$ 45,00]   R$ 90,00   ✕
 └ Jaca Sidhu
[                      ]   [ ]   [        ]
──────────────────────────────────────────────────────
                                   Total  R$ 90,00
                                       [Salvar venda]
```

- **Comprador**: opcional, com autocomplete que busca por `name_key` (sem acento e sem diferenciar maiúsculas). Se o texto não bater com nenhum comprador, a opção "+ Cadastrar ao salvar" cria o comprador na mesma transação da venda. Se o texto bater exatamente pela `name_key`, usa o comprador existente e nunca cria duplicado.
  - **Aviso de nome parecido** (aprovado pelo usuário): se o texto ficou digitado sem escolher sugestão e não bate exatamente com nenhum comprador, salvar continua criando o comprador novo. Mas antes, se ele for **parecido** com um existente, aparece um aviso rápido: "Já existe **João Silva**. Usar ele ou cadastrar **João Si**?". O Enter escolhe o existente e o Esc volta ao formulário.
  - **O que conta como parecido** (comparando `name_key`): um começa com o outro, ou a distância de edição (Levenshtein) é de no máximo 2. Se houver vários parecidos, o aviso lista até 3.
  - Quando não há nenhum parecido, o comprador é cadastrado direto, sem aviso.
- **Data**: vem preenchida com hoje. **Enviado**: desmarcado por padrão.
- **Itens**: o autocomplete de produto só permite escolher produtos existentes. Não se cria produto a partir da venda.
  - **Fluxo de teclado**: o Enter seleciona o produto, o Tab passa para Qtd e depois para Preço, e o Enter no preço abre uma nova linha já com o foco no produto.
  - A linha vazia final não é salva.
  - O mesmo produto pode aparecer em duas linhas (por exemplo, com preços diferentes).
- **Preço**: digitado em formato brasileiro (`45,00` ou `45`), exibido como `R$ 45,00` e guardado em centavos.
- **Validação**: pelo menos um item, quantidade inteira maior que 0, preço maior ou igual a 0 e data válida.
- **Salvar**: grava tudo numa única transação (comprador novo, venda e itens). Na edição, substitui os itens da venda dentro da transação. Depois de salvar uma venda nova, o formulário é limpo para a próxima e aparece uma confirmação.
- **Excluir venda**: só na edição, com confirmação.

### Vendas (tabela)

```
[Buscar…]  Período [01/11 – 19/11]  Enviado [Todos▾]  Agrupar por [Comprador▾]
                                                [Exportar Excel ▾: Tudo / Filtrado]
Data ▾     Comprador     Produto        Qtd  Preço    Subtotal  Enviado
▸ João Silva (3 itens)                                R$ 210,00
  19/11    João Silva    Jaca Sidhu      2   45,00    90,00     ✓
```

- **Uma linha por item de venda** (venda × item). As colunas são data, comprador, produto, quantidade, preço unitário, subtotal e enviado.
- **Busca**: texto livre em comprador e produto, sem acento e sem diferenciar maiúsculas.
- **Filtros**:
  - Período (data inicial e final, inclusivo).
  - Enviado (todos, sim ou não).
  - Produto e comprador (seleção de um ou mais).
- **Ordenação** clicando no cabeçalho: data, comprador e produto, com a ordem mais recente primeiro por padrão.
- **Agrupar por**: nenhum, produto, comprador ou data. Cada grupo mostra contagem de itens, soma de quantidade e soma do subtotal.
- Um rodapé mostra os totais do que está filtrado.
- **Clicar numa linha** abre a venda inteira no formulário de edição. O "enviado" é da venda, então editar vale para todos os itens dela.
- **Exportar Excel**:
  - **Tudo** exporta todos os itens.
  - **Filtrado** exporta exatamente as linhas que passam na busca e nos filtros atuais, na ordenação atual. O agrupamento não é reproduzido: o Excel recebe linhas planas.
  - Colunas iguais às da tabela. A data sai como data do Excel e os valores em reais saem como número com formato de moeda.
  - Nome sugerido do arquivo: `vendas-YYYY-MM-DD.xlsx`.

### Produtos

- Lista com busca, botão **Novo** e edição do nome direto na linha.
- O nome é padronizado ao salvar. Uma `name_key` repetida é bloqueada com a mensagem "Já existe: <nome>".
- **Excluir**: permitido só se o produto nunca foi vendido. Caso contrário, só é possível renomear, para não quebrar o histórico.

## Backup

- Um item de menu ou botão "Fazer backup" abre um diálogo "Salvar como" e grava uma cópia consistente do banco com `db.backup()` do better-sqlite3.
- Restaurar backup fica fora do escopo: dá para substituir o arquivo manualmente, e a localização dele é mostrada na tela.

## Decisões minhas (o usuário pode corrigir)

- Moeda em reais e formato de data e número brasileiro.
- Venda sem comprador é permitida.
- Não se cria produto a partir da tela de venda.
- O comprador não tem tela própria. Renomear ou mesclar compradores fica fora do escopo por enquanto.

## Deixado para quem for construir

- Estrutura de pastas e organização do código.
- Escolha exata dos componentes BoardUI (seguindo a skill `boardui`) e detalhes visuais (seguindo a skill `design-taste-frontend`).
- Volume de dados esperado: centenas a poucos milhares de itens por ano. Filtrar e agrupar no renderer com TanStack Table sobre a lista completa é aceitável. Se ficar lento, mover os filtros para SQL.
- Testes: unitários para a padronização e a `name_key`, o parse de preço e a importação do CSV, além de um teste da transação de salvar venda.
