# Sinal / situação de pagamento da venda — design curto

## Intenção
Registrar quanto o cliente já pagou de cada venda e ver de relance quem está Pendente, só com Sinal ou Pago. Quando o restante é pago depois, o usuário edita a venda.

## Regras (do usuário)
- Sinal vazio ou 0 → **Pendente**
- 0 < sinal < total → **Sinal**
- sinal = total → **Pago**
- Checkbox "Marcar como pago" no formulário preenche o sinal com o total.

## Abordagens
- **Escolhida:** guardar só o valor pago (`paid_cents` em `sales`) e calcular a situação a partir dele e do total dos itens. Fica sempre coerente quando os itens mudam.
- Descartada: guardar a situação como coluna própria. É redundante e fica desatualizada quando o total muda.
- Descartada: tabela de pagamentos com histórico (data/valor). O usuário prefere editar o valor.

## Design
- **Banco:** coluna `paid_cents INTEGER NOT NULL DEFAULT 0` em `sales`, adicionada por migração para bancos já existentes (vendas antigas = Pendente).
- **Tipos:** `paidCents` em `SaleInput`, `Sale` e `SaleRow`. `SaleRow` também leva o total da venda, para calcular a situação por linha.
- **Validação:** sinal em centavos inteiro ≥ 0 e ≤ total da venda, no renderer e no main. Mensagem: "Sinal maior que o total da venda."
- **Formulário:** campo "Sinal" (formato de preço BR, igual aos preços) e o checkbox "Marcar como pago".
  - Marcado = sinal igual ao total e total > 0 (derivado, não guardado).
  - Marcar preenche o sinal com o total. Desmarcar limpa o sinal.
  - Se o total subir, o checkbox desmarca sozinho.
- **Lista de vendas:** coluna "Pagamento" com chip (Pendente / Sinal / Pago) e filtro com Todos / Pendente / Sinal / Pago.
- **Excel:** colunas "Pago" e "Situação".
- **Testes:** função pura da situação, validação, migração, `saveSale`/`getSale` com o valor pago, e o filtro.

## Decisões deixadas para quem implementar
- As cores dos chips (sugestão: Pago lime, Sinal amber, Pendente neutral) e onde exatamente ficam os campos no formulário.
