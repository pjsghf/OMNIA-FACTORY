# CONTRIBUTING.md - Guia de Contribuição e Governança de Código

Agradecemos o seu interesse em contribuir para o **OMNIA FACTORY**! Para garantir a qualidade arquitetural, segurança e manutenibilidade do repositório, siga as diretrizes abaixo.

---

## 1. Princípios de Desenvolvimento

1. **Segurança em Primeiro Lugar**: NUNCA commite chaves de API, senhas ou segredos. Utilize sempre variáveis de ambiente (`.env`).
2. **Qualidade e Tipagem Estrita**: Escreva código TypeScript limpo, sem uso inadvertido de `any` ou desabilitação de regras de linter sem justificativa.
3. **Preservação de Testes**: Todos os testes unitários e de integração existentes devem permanecer passando. Novos recursos exigem testes correspondentes.

---

## 2. Configuração do Ambiente de Desenvolvimento

```bash
# 1. Clone o repositório
git clone https://github.com/pjsghf/OMNIA-FACTORY.git
cd OMNIA-FACTORY

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Adicione sua GEMINI_API_KEY ou OPENCODE_API_KEY no arquivo .env

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

---

## 3. Padrão de Commits (Conventional Commits)

Utilizamos o padrão **Conventional Commits**. As mensagens devem seguir o formato:

`<tipo>(<escopo opcional>): <descrição curta no imperativo>`

### Tipos Permitidos:
- `feat`: Novo recurso ou funcionalidade para o usuário.
- `fix`: Correção de bug ou comportamento inesperado.
- `docs`: Alterações exclusivamente na documentação.
- `style`: Formatação, ponto e vírgula, sem alteração de lógica.
- `refactor`: Refatoração de código sem alterar funcionalidade ou fixar bug.
- `perf`: Mudança de código focada em melhoria de desempenho.
- `test`: Adição ou correção de testes unitários/integração.
- `chore`: Atualizações de tarefas de build, pacotes ou auxílio de ferramentas.

### Exemplos Válidos:
- `feat(writer): add support for exercicios and agradecimentos matter sections`
- `fix(pdf): fix page footer positioning and title display in puppeteer render`
- `test(security): add test for rate limiting headers on /api/editorial`

---

## 4. Fluxo de Git & Pull Requests

1. **Branching Strategy**:
   - Crie uma branch a partir de `main`: `feature/nome-da-feature` ou `fix/nome-do-bug`.
2. **Verificações Obrigatórias Antes do Push**:
   Antes de abrir um Pull Request ou fazer o push, execute a suíte de validação local:
   ```bash
   # Checagem de tipos TypeScript
   npm run typecheck

   # Linter de código
   npm run lint

   # Formatação
   npm run format:check

   # Suíte completa de testes
   npm run test
   ```
3. **Regras de Pull Request**:
   - Descrição clara das mudanças e motivação técnica.
   - Referência a issues relacionadas, se houver.
   - Garantia de que 100% dos testes da suíte passam sem alertas de regressão.
