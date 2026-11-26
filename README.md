# Projeto A3 — Renda, emprego, inflação e endividamento das famílias (Brasil, 2012–2026)
## Sobre o projeto

Projeto A3 da UC Análise de Dados e Big Data, curso de Engenharia da Computação, UNIFACS. Área temática: Indicadores Socioeconômicos.

**Pergunta:** emprego e renda melhores significam famílias em melhor situação financeira?

**O que fizemos:** reunimos quatro séries oficiais do IBGE e do Banco Central numa base de 174 meses (janeiro de 2012 a junho de 2026), com ETL e análises exploratória, diagnóstica e prescritiva.

**O que encontramos:**

- No 2º trimestre de 2026, o desemprego é de 5,4% e a renda média real é de R$ 3.738, mas as dívidas das famílias com o sistema financeiro equivalem a 49,8% da renda de 12 meses.
- Com a inflação de 12 meses em 8% ou mais, a renda real caiu em 30 de 35 meses.
- Desde o fim de 2022, renda alta convive com dívida alta, combinação inédita desde 2012.

**Equipe:** Artur Souza Vieira Borges, Diogo Alexandre da Silva Meirinhos, Edenilson Oliveira Nascimento, Gustavo Almeida dos Anjos e Lucas Franca Beraldi.
## Links

- **Dashboard:** https://m00nwalwer.github.io/Entrega_a3_equipe-2/
- **Vídeo:** https://youtu.be/nMXjp3bae2g?si=01N6hDRCUpw_-eqZ
- **Relatório (PDF):** https://m00nwalwer.github.io/Entrega_a3_equipe-2/Projeto_A3_entrega/relatorio/Relatorio_A3%20final%20final.pdf
  
Todas as pastas abaixo ficam dentro de `Projeto_A3_entrega/`.

## O que tem em cada pasta

| Pasta | Conteúdo |
|---|---|
| `relatorio/` | `Relatorio_A3 final final.pdf` — relatório final |
| `dashboard_online/` | Dashboard em HTML, CSS e JavaScript (`index.html`, `style.css`, `app.js`, `dados.js`). Não precisa instalar nada. |
| `codigo_python/` | `etl.py`, `eda.py`, `eda1.py`, `gerar_dados_site.py` e `requirements.txt` |
| `graficos/` | As 17 figuras do relatório (PNG). Em `graficos/tabelas/`, as tabelas de resultados (CSV) usadas no texto |
| `dados/originais/` | Os 4 arquivos baixados do IBGE (SIDRA) e do Banco Central (SGS) |
| `dados/gerados/` | As 3 bases geradas pelo `etl.py`: `dataset_final.csv` (mensal), `dataset_trimestral.csv` e `ipca_mensal_tratado.csv` |
| `Slides_video_PNG/` | Os 27 slides do vídeo em PNG. Em `slide_18_por_clique/`, as três etapas do slide 18 |

O `index.html` da raiz só abre o dashboard (`Projeto_A3_entrega/dashboard_online/index.html`).

## Abrir o dashboard

- **No computador:** dois cliques em `dashboard_online/index.html`.

## Gerar tudo de novo a partir dos dados originais

No terminal, dentro da pasta `codigo_python`:

```
python -m pip install -r requirements.txt
python etl.py               # dados/originais  ->  dados/gerados (as 3 bases)
python eda.py               # Tabelas 4 e 5 e Figuras 1 a 10  ->  graficos/
python eda1.py              # Figuras 11 a 17 e correlações    ->  graficos/
python gerar_dados_site.py  # dados/gerados  ->  dashboard_online/dados.js
```

Todas as figuras e tabelas de resultados do relatório saem desses scripts. Nenhuma foi feita à mão.

## Onde está cada figura do relatório

| Figura | Arquivo em `graficos/` | Script |
|---|---|---|
| 1 | `e01_boxplots.png` | eda.py |
| 2 | `e02_distribuicoes.png` | eda.py |
| 3 | `e04_matriz_dispersao.png` | eda.py |
| 4 | `e05_boxplots_periodo.png` | eda.py |
| 5 | `g1_series.png` | eda.py |
| 6 | `g6_ipca_mensal.png` | eda.py |
| 7 | `g7_endiv_2005.png` | eda.py |
| 8 | `g8_rendimento_idx_var.png` | eda.py |
| 9 | `e06_tendencias.png` | eda.py |
| 10 | `e10_agrupamento.png` | eda.py |
| 11 | `d05_validacao_etl.png` | eda1.py |
| 12 | `d01_linha_do_tempo_eventos.png` | eda1.py |
| 13 | `d03_correlacao_por_fase.png` | eda1.py |
| 14 | `p01_limiar_inflacao.png` | eda1.py |
| 15 | `p02_gatilho_desemprego.png` | eda1.py |
| 16 | `p03_gatilho_endividamento.png` | eda1.py |
| 17 | `p04_semaforo_atual.png` | eda1.py |

Tabelas de resultados em `graficos/tabelas/`: `tabela4_descritivas.csv` (Tabela 4), `tabela5_grupos.csv` (Tabela 5), `kmeans_silhouette.csv`, `kmeans_fase_x_grupo.csv`, `tendencias.csv` (seção 4.3), `correlacao_por_fase.csv` e `correlacoes_citadas.csv` (seção 5.2).


