# footfy-frontend

## Testes E2E (Playwright)

Smoke das telas principais e checagens de layout no Chromium, que o Vitest (jsdom) não pega: menu
lateral, rolagem horizontal no mobile, tooltips e alguns snapshots visuais. Os testes ficam em
`e2e/` e não precisam do backend: a API é mockada com as fixtures de `e2e/fixtures/`.

```sh
# Uma vez por máquina: baixa o Chromium do Playwright
npx playwright install chromium
# Se faltarem bibliotecas do sistema (Linux/WSL), instale também as dependências (pede sudo):
npx playwright install-deps chromium

# Roda a suíte (gera o build de produção e sobe o `vite preview` na porta 4180)
npm run test:e2e

# Regera os snapshots depois de uma mudança visual intencional
npm run test:e2e:update
```

- O teste falha se a tela gerar erro no console, se chamar a API sem mock ou se fizer requisição
  para outro host. Para uma rota nova, adicione a resposta em `e2e/support/default-routes.ts` (a
  fixture JSON segue o formato da resposta real do backend).
- Os snapshots ficam em `e2e/visual.spec.ts-snapshots/` e são versionados. Depois do
  `test:e2e:update`, confira as imagens no diff antes de commitar.
- Fora do CI, se já houver um servidor na porta 4180, ele é reaproveitado. Se ele estiver com um
  build antigo, pare o servidor antes de rodar.
- Cada falha deixa um trace em `test-results/`: abra com `npx playwright show-trace <arquivo>.zip`.
