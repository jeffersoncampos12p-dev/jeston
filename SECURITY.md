# Security Policy

A Hedron trata a segurança do Jeston como parte do contrato do framework.

## Versões suportadas

A linha `main` e a versão estável mais recente recebem correções de segurança. Versões antigas podem não receber patches; atualize antes de reportar um problema.

## Reporte privado

Não publique vulnerabilidades em issue pública. Use o recurso **Report a vulnerability** da aba Security do repositório GitHub ou envie um relatório privado aos mantenedores da Hedron. Inclua versão, ambiente Node.js, passos para reproduzir, impacto e uma correção sugerida quando possível.

Não inclua tokens, chaves, dados pessoais ou credenciais reais no relatório.

## Práticas recomendadas

Use Node.js LTS, mantenha dependências atualizadas, defina `JESTON_SESSION_SECRET` com pelo menos 32 caracteres, configure limites de body, use HTTPS em produção, habilite cookies Secure e não registre segredos.

O Jeston não promete ausência absoluta de vulnerabilidades. O compromisso é investigar, corrigir e comunicar problemas de forma responsável.
