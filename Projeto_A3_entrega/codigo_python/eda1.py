"""Diagnóstico e prescrição do Projeto A3 (seções 5 e 7 do relatório): Figuras 11 a 17.

Entradas (geradas pelo etl.py): dataset_final.csv (mensal), dataset_trimestral.csv (PNAD) e ipca_mensal_tratado.csv.
As correlações usam a base mensal: cada mês junta o IPCA 12m e o endividamento do próprio mês com a
desocupação e o rendimento do trimestre (repetidos nos 3 meses), por isso os meses não são observações independentes.
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = Path(__file__).resolve().parent.parent  # pasta do projeto (acima de codigo_python)
U = RAIZ / "dados" / "gerados"   # bases geradas pelo etl.py
O = RAIZ / "graficos"           # figuras do relatório
T = O / "tabelas"               # tabelas de resultados (CSV) usadas no texto do relatório
T.mkdir(parents=True, exist_ok=True)

m = pd.read_csv(U / "dataset_final.csv", parse_dates=["data"])  # mensal
q = pd.read_csv(U / "dataset_trimestral.csv")                      # trimestral (PNAD)
q["data"] = pd.PeriodIndex(q.trimestre.str.replace("T", "Q"), freq="Q").to_timestamp()
ipm = pd.read_csv(U / "ipca_mensal_tratado.csv", parse_dates=["data"])
plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False, "font.size": 10})


def br(v, nd=1, sinal=False):
    s = f"{v:+,.{nd}f}" if sinal else f"{v:,.{nd}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".").replace("-", "−")


def shade(ax):
    ax.axvspan(pd.Timestamp("2014-04-01"), pd.Timestamp("2016-12-31"), color="#cccccc", alpha=.35, lw=0, zorder=0)
    ax.axvspan(pd.Timestamp("2020-01-01"), pd.Timestamp("2021-12-31"), color="#f4c7c3", alpha=.35, lw=0, zorder=0)


# ============ Figura 11 — d05 validação do ETL contra números oficiais (seção 5.1) ============
oficial = {2014: 6.41, 2015: 10.67, 2017: 2.95, 2020: 4.52, 2021: 10.06}  # IBGE, agenciadenoticias.ibge.gov.br
ipm["ano"] = ipm.data.dt.year
calc = ipm.groupby("ano").agg(fator=("fator", "prod"), n=("fator", "size"))
calc = calc[calc.n == 12]
calc["ipca_ano"] = (calc.fator - 1) * 100
print("=== Validação do ETL: IPCA anual calculado × oficial (IBGE) ===")
for ano, of in oficial.items():
    c = calc.loc[ano, "ipca_ano"]
    print(f"{ano}: calculado={c:.2f}%  oficial={of:.2f}%  diferença={c - of:+.3f} p.p.")
anos = list(oficial)
fig, ax = plt.subplots(figsize=(8, 4.5))
x, w = np.arange(len(anos)), .35
b1 = ax.bar(x - w / 2, [calc.loc[a, "ipca_ano"] for a in anos], w, label="calculado a partir dos CSVs", color="#2471a3")
b2 = ax.bar(x + w / 2, [oficial[a] for a in anos], w, label="divulgado pelo IBGE", color="#d68910")
for barras in (b1, b2):
    ax.bar_label(barras, labels=[br(v.get_height(), 2) for v in barras], fontsize=8, padding=2)
ax.set_xticks(x, anos)
ax.set_ylabel("IPCA no ano (%)")
ax.set_title("Validação do ETL: IPCA anual calculado × oficial", loc="left", fontweight="bold")
ax.legend(loc="upper left", fontsize=8)
ax.set_ylim(0, max(oficial.values()) * 1.18)
plt.tight_layout()
plt.savefig(O / "d05_validacao_etl.png")
plt.close()
jun22 = ipm[ipm.data == "2022-06-01"].ipca_12m.iloc[0]
jul22 = ipm[ipm.data == "2022-07-01"].ipca_mensal.iloc[0]
print(f"IPCA 12m jun/2022 (calculado): {jun22:.2f} | oficial: 11,89")
print(f"IPCA mensal jul/2022 (calculado): {jul22:.2f} | oficial: -0,68")

# ============ Figura 12 — d01 linha do tempo dos eventos (seção 5.4) ============
fig, ax = plt.subplots(4, 1, figsize=(11, 10), sharex=True)
painel = [(q, "desocupacao", "Desocupação (%) — trimestral", "#c0392b"),
          (q, "rendimento_real", "Rendimento real (R$) — trimestral", "#2471a3"),
          (m, "ipca_12m", "IPCA 12 meses (%) — mensal", "#d68910"),
          (m, "endividamento_familias", "Endividamento (% da renda) — mensal", "#7d3c98")]
eventos = [("2015-01-01", "Energia +51% em 2015\n(IPCA 10,67%)"), ("2016-12-31", "Fim da recessão\n(CODACE)"),
           ("2020-01-01", "Recessão\nda pandemia"), ("2021-03-01", "Selic sobe\n(mar/2021)"),
           ("2022-07-01", "ICMS cai\n(IPCA jul: −0,68%)")]
for a, (base, c, t, col) in zip(ax, painel):
    a.plot(base.data, base[c], color=col, lw=1.8)
    shade(a)
    for dt, _ in eventos:
        a.axvline(pd.Timestamp(dt), color="k", ls=":", lw=.6)
    a.set_title(t, loc="left", fontweight="bold", fontsize=10)
for i, (dt, txt) in enumerate(eventos):  # rótulos numa faixa acima do 1º painel, em duas alturas
    y = 1.17 + .3 * (i % 2)  # acima do título do painel
    ax[0].text(pd.Timestamp(dt), y, txt, transform=ax[0].get_xaxis_transform(), fontsize=7.5, ha="center",
               va="bottom", linespacing=1.1, bbox=dict(boxstyle="round,pad=.25", fc="white", ec="#999999", lw=.6))
    ax[0].plot([pd.Timestamp(dt)] * 2, [1, y], transform=ax[0].get_xaxis_transform(), color="k", ls=":", lw=.6, clip_on=False)
ax[-1].set_xlabel("Cinza: recessão 2014T2–2016T4 (CODACE/FGV). Rosa: pandemia (2020–2021).\n"
                  "Fontes dos marcadores: IBGE, Banco Central, CODACE.", fontsize=7)
plt.tight_layout()
plt.savefig(O / "d01_linha_do_tempo_eventos.png")
plt.close()

# ============ Figura 13 — d03 correlação por fase (seção 5.2) ============
fases = {"2013–2019\n(pré-pandemia)": (2013, 2019), "2020–2021\n(pandemia)": (2020, 2021),
         "2022–2026\n(pós-pandemia)": (2022, 2026), "2013–2026\n(todo o período)": (2013, 2026)}
vars_corr = {"IPCA 12 meses": "ipca_12m", "Δ desocupação (12 meses)": "desocup_var_pp_ano",
             "Δ endividamento (12 meses)": "endividamento_var_pp_12m"}
tabela, ns = {}, {}
for nome, (a, b) in fases.items():
    s = m[m.ano.between(a, b)]
    tabela[nome] = {v: s[[c, "rend_var_ano_pct"]].dropna().corr().iloc[0, 1] for v, c in vars_corr.items()}
    ns[nome] = len(s[["ipca_12m", "rend_var_ano_pct"]].dropna())
tab = pd.DataFrame(tabela).T
tab["meses"] = pd.Series(ns)
tab["trimestres"] = tab.meses // 3
print("\n=== Correlação com a variação anual do rendimento real, por fase (base mensal) ===")
print(tab.round(2).to_string())
tab.rename(index=lambda s: s.replace("\n", " ")).to_csv(T / "correlacao_por_fase.csv", encoding="utf-8-sig")
fig, ax = plt.subplots(figsize=(10, 5))
x, w = np.arange(len(fases)), .26
cores = {"IPCA 12 meses": "#2471a3", "Δ desocupação (12 meses)": "#d68910", "Δ endividamento (12 meses)": "#27ae60"}
for i, v in enumerate(vars_corr):
    vals = [tabela[f][v] for f in fases]
    barras = ax.bar(x + (i - 1) * w, vals, w, label=v, color=cores[v])
    ax.bar_label(barras, labels=[br(val, 2) for val in vals], fontsize=7.5, padding=2)
ax.axhline(0, color="k", lw=.7)
ax.set_ylim(-1.15, 1.15)
ax.set_xticks(x, [f"{f}\n{ns[f]} meses" for f in fases], fontsize=8)
ax.set_ylabel("correlação (r)")
ax.set_title("Correlação com a variação anual do rendimento real, por fase", loc="left", fontweight="bold")
ax.legend(fontsize=8, ncols=3, loc="upper center", bbox_to_anchor=(.5, -.2), frameon=False)
plt.tight_layout()
plt.savefig(O / "d03_correlacao_por_fase.png")
plt.close()

print("\n=== Outras correlações citadas no relatório (base mensal) ===")
pares = [("endividamento_familias", "rendimento_real", "nível"), ("endividamento_var_pp_12m", "rend_var_ano_pct", "variação em 12 meses"),
         ("desocupacao", "rendimento_real", "nível"), ("desocup_var_pp_ano", "rend_var_ano_pct", "variação em 12 meses"),
         ("ipca_12m", "rend_var_ano_pct", "IPCA 12m × variação anual da renda")]
citadas = []
for a, b, rot in pares:
    d = m[[a, b]].dropna()
    print(f"  {a} × {b} ({rot}): r = {d[a].corr(d[b]):+.2f} (n = {len(d)} meses)")
    citadas.append({"x": a, "y": b, "tipo": rot, "r": d[a].corr(d[b]), "n_meses": len(d)})
pd.DataFrame(citadas).to_csv(T / "correlacoes_citadas.csv", index=False, encoding="utf-8-sig")

# ============ Figura 14 — p01 limiar de inflação (seção 7) ============
s = m.dropna(subset=["ipca_12m", "rend_var_ano_pct"])
fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(s.ipca_12m, s.rend_var_ano_pct, s=28, alpha=.85,
           c=np.select([s.ipca_12m < 5, s.ipca_12m < 8], ["#27ae60", "#d68910"], default="#c0392b"))
ax.axvline(5, color="#d68910", ls="--", lw=1)
ax.axvline(8, color="#c0392b", ls="--", lw=1)
ax.axhline(0, color="k", lw=.6)
alto = s[s.ipca_12m >= 8]
n_queda = int((alto.rend_var_ano_pct < 0).sum())
ax.set_title(f"Com IPCA 12m ≥ 8%, a renda real caiu em {n_queda} de {len(alto)} meses", loc="left", fontweight="bold")
ax.set_xlabel("IPCA acumulado em 12 meses (%)")
ax.set_ylabel("Variação anual do rendimento real (%)")
for dt, rot in [("2015-12-01", "dez/2015"), ("2021-09-01", "set/2021"), ("2022-04-01", "abr/2022")]:
    r = s[s.data == dt]
    if len(r):
        ax.annotate(rot, (r.ipca_12m.iloc[0], r.rend_var_ano_pct.iloc[0]), fontsize=7, xytext=(4, 4), textcoords="offset points")
plt.tight_layout()
plt.savefig(O / "p01_limiar_inflacao.png")
plt.close()
print(f"\nIPCA 12m ≥ 8%: renda caiu em {n_queda} de {len(alto)} meses "
      f"({alto.trimestre.nunique()} trimestres: {', '.join(alto.trimestre.unique())})")

# ============ Figura 15 — p02 gatilho do desemprego (base trimestral) ============
q["rend_proximo_tri"] = q.rend_var_ano_pct.shift(-1)


def media_por_gatilho(sub):
    sub = sub.dropna(subset=["desocup_var_pp_ano", "rend_proximo_tri"])
    return sub[sub.desocup_var_pp_ano >= 1].rend_proximo_tri.mean(), sub[sub.desocup_var_pp_ano < 1].rend_proximo_tri.mean()


alta_t, baixa_t = media_por_gatilho(q)
alta_19, baixa_19 = media_por_gatilho(q[q.ano <= 2019])
print(f"Renda no trimestre seguinte: desemprego +1 p.p. ou mais = {alta_t:.2f}% | demais = {baixa_t:.2f}% "
      f"(até 2019: {alta_19:.2f}% | {baixa_19:.2f}%)")
fig, ax = plt.subplots(figsize=(7, 4.5))
x, w = np.arange(2), .35
b1 = ax.bar(x - w / 2, [baixa_t, baixa_19], w, color="#27ae60", label="desemprego subiu menos de 1 p.p. em 12 meses")
b2 = ax.bar(x + w / 2, [alta_t, alta_19], w, color="#c0392b", label="desemprego subiu 1 p.p. ou mais")
for barras in (b1, b2):
    ax.bar_label(barras, labels=[br(v.get_height(), 2) + "%" for v in barras], fontsize=8, padding=2)
ax.axhline(0, color="k", lw=.6)
ax.set_xticks(x, ["Todo o período", "Só até 2019"])
ax.set_ylabel("Var. anual da renda no trimestre seguinte (%)")
ax.set_title("Alta do desemprego sinaliza renda mais fraca\nno trimestre seguinte", loc="left", fontweight="bold")
ax.legend(fontsize=7)
plt.tight_layout()
plt.savefig(O / "p02_gatilho_desemprego.png")
plt.close()

# ============ Figura 16 — p03 gatilho do endividamento (base mensal) ============
fig, ax = plt.subplots(figsize=(10, 4))
# mesmas faixas do semáforo (Tabela 7): queda = verde; alta de 0 a 3 p.p. = amarelo; alta de 3 p.p. ou mais = vermelho
ve = m.endividamento_var_pp_12m
ax.bar(m.data, ve, width=25, color=np.select([ve < 0, ve < 3], ["#27ae60", "#d68910"], default="#c0392b"))
ax.axhline(3, color="#c0392b", ls="--", lw=1)
ax.axhline(0, color="k", lw=.6)
ax.set_title("Variação do endividamento em 12 meses (p.p.) — verde: queda; amarelo: alta de até 3 p.p.; "
             "vermelho: alta ≥ 3 p.p.", loc="left", fontweight="bold", fontsize=9.5)
plt.tight_layout()
plt.savefig(O / "p03_gatilho_endividamento.png")
plt.close()
acima = m[m.endividamento_var_pp_12m >= 3]
print(f"Endividamento +3 p.p. ou mais em 12 meses: {len(acima)} meses ({acima.data.min():%m/%Y} a {acima.data.max():%m/%Y}; "
      f"trimestres: {', '.join(acima.trimestre.unique())})")

# ============ Figura 17 — p04 painel do semáforo (último trimestre) ============
# por trimestre: IPCA 12m do último mês; endividamento = média dos 3 meses (como no dashboard)
mq = m.groupby("trimestre").agg(ipca_12m=("ipca_12m", "last"), endiv=("endividamento_familias", "mean"))
ult = q.trimestre.iloc[-1]
ipca_u, endiv_u = mq.loc[ult, "ipca_12m"], mq.loc[ult, "endiv"]
endiv_var_u = endiv_u - mq.endiv.iloc[-5]
desoc_var_u = q.desocup_var_pp_ano.iloc[-1]
indicadores = [
    ("Inflação (IPCA 12m)", f"{br(ipca_u, 2)}%", "vermelho a partir de 8%",
     "#27ae60" if ipca_u < 5 else "#d68910" if ipca_u < 8 else "#c0392b"),
    ("Desemprego (var. em 12 meses)", f"{br(desoc_var_u, 1, True)} p.p.", "vermelho a partir de +1 p.p.",
     "#27ae60" if desoc_var_u < 0 else "#d68910" if desoc_var_u < 1 else "#c0392b"),
    ("Endividamento (var. em 12 meses)", f"{br(endiv_var_u, 2, True)} p.p.", "vermelho a partir de +3 p.p.",
     "#27ae60" if endiv_var_u < 0 else "#d68910" if endiv_var_u < 3 else "#c0392b"),
    ("Endividamento (nível)", f"{br(endiv_u)}%", "alto a partir de 48%", "#27ae60" if endiv_u < 48 else "#c0392b"),
]
print(f"Semáforo {ult}: " + " | ".join(f"{n_} {v}" for n_, v, _, _ in indicadores))
fig, ax = plt.subplots(figsize=(8, 4))
ax.set_xlim(0, 10)
ax.set_ylim(-.5, len(indicadores) - .5)
ax.axis("off")
ax.set_title(f"Semáforo em {ult} (regras empíricas deste projeto)", loc="left", fontweight="bold")
for i, (nome, valor, regra, cor) in enumerate(indicadores):
    y = len(indicadores) - 1 - i
    ax.scatter([.3], [y], s=400, color=cor)
    ax.text(1.0, y, nome, va="center", fontweight="bold")
    ax.text(5.3, y, valor, va="center")
    ax.text(6.6, y, regra, va="center", fontsize=8, color="#555555")
plt.tight_layout()
plt.savefig(O / "p04_semaforo_atual.png")
plt.close()

print("\nFiguras salvas em", O)
