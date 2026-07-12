# DATAPREV · Agenda de Estudos

Este é um projeto pessoal que criei para organizar minha preparação para o concurso da **DATAPREV 2026**, no perfil de **Desenvolvimento de Software**.

Ao analisar o edital e a quantidade de aulas disponíveis no curso preparatório, percebi que tentar assistir a todo o conteúdo em sequência não seria a estratégia mais eficiente. Por isso, desenvolvi este painel para transformar o curso em um cronograma diário, priorizando os assuntos com maior relevância para a prova.

A ideia é simples: abrir o painel, visualizar as aulas programadas para o dia, concluir a sessão e acompanhar a evolução até a data da prova.

## Objetivo do projeto

O painel foi criado para me ajudar a:

- manter constância nos estudos;
- saber exatamente quais aulas assistir em cada dia;
- concentrar tempo nos conteúdos mais importantes;
- acompanhar o progresso por nível de prioridade;
- visualizar quantos dias faltam para a prova;
- evitar perder tempo escolhendo diariamente o que estudar;
- acessar o cronograma pelo computador ou celular.

O cronograma considera uma rotina de aproximadamente **2 horas de estudo por dia**, com as videoaulas assistidas em **1,5x**.

## Funcionalidades

- agenda diária de aulas;
- contagem regressiva para a prova;
- progresso geral do cronograma;
- progresso separado por prioridades **A+**, **A** e **B**;
- acompanhamento por matéria;
- filtros por mês, disciplina e status;
- marcação de aulas concluídas;
- cronômetro para contabilizar horas líquidas de estudo;
- histórico de sessões e gráfico dos últimos sete dias;
- registro manual de horas;
- possibilidade de antecipar uma aula futura para o dia atual;
- armazenamento automático do progresso;
- layout responsivo para desktop e celular;
- exportação e importação de backup do progresso;
- período final reservado para revisões e simulados.

## Tecnologias utilizadas

O projeto foi desenvolvido sem frameworks, utilizando tecnologias web nativas:

- **HTML5** para a estrutura das páginas;
- **CSS3** para o layout responsivo e a identidade visual;
- **JavaScript Vanilla** para renderização, filtros e regras do cronograma;
- **LocalStorage** para salvar progresso, horas registradas e alterações na agenda;
- **JSON/JavaScript Objects** para armazenar as aulas e a agenda;
- **Git e GitHub** para versionamento;
- **GitHub Pages** para publicação do painel.

## Como executar localmente

A forma mais simples é utilizar a extensão **Live Server** no VS Code:

1. Abra a pasta do projeto no VS Code.
2. Clique com o botão direito no arquivo `index.html`.
3. Selecione **Open with Live Server**.

Também é possível iniciar um servidor HTTP pelo terminal:

```bash
python3 -m http.server 5500
```

Depois, acesse:

```text
http://localhost:5500
```

## Publicação no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos do projeto para a branch `main`.
3. Acesse **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde a publicação.

O endereço será semelhante a:

```text
https://seu-usuario.github.io/nome-do-repositorio/
```

## Salvamento do progresso

O progresso é salvo automaticamente utilizando o `localStorage`.

Isso significa que:

- as aulas concluídas continuam marcadas após fechar o navegador;
- os dados ficam armazenados no navegador utilizado;
- navegadores e dispositivos diferentes possuem armazenamentos separados;
- o recurso de backup permite exportar e importar o progresso.

Uma evolução futura do projeto pode incluir autenticação e sincronização automática usando um backend como **Supabase** ou **Firebase**.

## Estrutura do projeto

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
    │   ├── dataprev-logo.png
    │   └── favicon.png
    └── js
        ├── data.js
        └── app.js
```

## Próximas melhorias

- sincronização do progresso entre dispositivos;
- autenticação de usuário;
- métricas semanais de desempenho;
- registro de questões e simulados;
- possibilidade de reagendar aulas pendentes.

## Motivação

Mais do que um exercício de desenvolvimento front-end, este projeto nasceu de uma necessidade real da minha preparação.

Em vez de depender apenas da ordem apresentada pelo curso, montei uma ferramenta que organiza o conteúdo conforme a prioridade e transforma um edital extenso em pequenas missões diárias.

A meta não é simplesmente assistir ao maior número possível de aulas. A meta é estudar com direção e chegar competitivo no dia da prova.


## Atualização da versão 4

- novo cronômetro com interface minimalista;
- indicador visual de sessão em andamento;
- acompanhamento da meta diária de duas horas;
- botão de salvar habilitado somente após um minuto;
- seletores responsivos e estilizados;
- arquivos CSS e JavaScript versionados para evitar cache antigo no GitHub Pages.
