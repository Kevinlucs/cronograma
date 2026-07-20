# Mission Control · EMBRATUR + DATAPREV

Painel estático para organizar a preparação simultânea para:

- **EMBRATUR 2026 — Analista Administrativo**
- **DATAPREV 2026 — Perfil 3: Desenvolvimento de Software**

A aplicação mantém a base simples do projeto original: HTML, CSS, JavaScript Vanilla e `localStorage`, sem backend ou etapa de build.

## Estratégia do cronograma

### Até 29/07/2026

O concurso prioritário é a **EMBRATUR**.

O período de 17 a 28 de julho foi recalculado para:

- concentrar aproximadamente 90 minutos diários no conteúdo de maior retorno da EMBRATUR;
- manter aulas técnicas da DATAPREV em dias com menor carga;
- destacar conteúdos que atendem aos dois editais;
- reservar 10 minutos diários para revisão ativa ou questões.

### Depois da prova da EMBRATUR

A partir de 30/07, a prioridade migra automaticamente para a **DATAPREV**, com foco no núcleo **A+ e A**.

Os últimos sete dias antes da prova ficam reservados para simulados, correção e revisão final.

## Conteúdos compartilhados

O sistema classifica cada aula como:

- **Serve aos dois**: reaproveitamento direto;
- **Aproveitamento parcial**: há interseção, mas os editais não são idênticos;
- **Exclusiva**: conteúdo específico de um concurso.

Entre as principais pontes estão:

- Língua Portuguesa;
- Língua Inglesa;
- LGPD;
- LAI;
- Business Intelligence;
- governança e análise de dados;
- inteligência artificial;
- metodologias ágeis;
- gestão de projetos.

## Funcionalidades

- dashboard com os dois concursos;
- contagem regressiva independente;
- prioridade automática conforme a data;
- agenda integrada;
- sessões mistas EMBRATUR/DATAPREV;
- progresso por concurso e prioridade;
- filtros por mês, concurso, matéria e status;
- mapa de matérias;
- selo de reaproveitamento;
- catálogo de aulas fora do plano principal;
- tema claro/escuro;
- exportação e importação de backup;
- migração automática do progresso da versão anterior.

## Migração do progresso

A versão anterior utilizava a chave:

```text
dataprev-mission-control-v1
```

A nova versão usa:

```text
study-mission-control-v2
```

Na primeira abertura, caso ainda não exista progresso na nova chave, o sistema importa automaticamente as aulas concluídas da versão anterior.

## Estrutura

```text
.
├── index.html
├── 404.html
├── .nojekyll
├── README.md
└── assets
    ├── css
    │   └── styles.css
    ├── img
    └── js
        ├── data.js
        └── app.js
```

## Executar localmente

Use a extensão **Live Server** no VS Code ou execute:

```bash
python3 -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

## Publicar no GitHub Pages

1. Envie os arquivos para a branch `main`.
2. Abra **Settings > Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione `main` e `/ (root)`.
5. Salve.

## Tecnologias

- HTML5
- CSS3
- JavaScript Vanilla
- LocalStorage
- GitHub Pages
