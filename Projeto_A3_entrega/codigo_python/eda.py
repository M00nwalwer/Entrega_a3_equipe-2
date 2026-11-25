import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats as _stats
from scipy.cluster.vq import kmeans2
from scipy.spatial.distance import cdist

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = Path(__file__).resolve().parent.parent
U = RAIZ / "dados" / "gerados"
O = RAIZ / "graficos"
T = O / "tabelas"
T.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(42)

m = pd.read_csv(U / "dataset_final.csv", parse_dates=["data"])
q = pd.read_csv(U / "dataset_trimestral.csv")
q["data"] = pd.PeriodIndex(q.trimestre.str.replace("T", "Q"), freq="Q").to_timestamp()
FASES = sorted(q.periodo.unique())
FASES_CURTAS = ["Expansão\npré-recessão", "Recessão", "Expansão", "Pandemia", "Pós-\npandemia"]

META_CMN = {2005: (4.5, 2.5), **{a: (4.5, 2.0) for a in range(2006, 2017)}, 2017: (4.5, 1.5), 2018: (4.5, 1.5),
            2019: (4.25, 1.5), 2020: (4.0, 1.5), 2021: (3.75, 1.5), 2022: (3.5, 1.5), 2023: (3.25, 1.5),
            **{a: (3.0, 1.5) for a in range(2024, 2027)}}

plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False, "font.size": 10})


def br(v, nd=1, sinal=False):
    s = f"{v:+,.{nd}f}" if sinal else f"{v:,.{nd}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".").replace("-", "−")


V = {
    "desocupacao": (q, "Desocupação (%)", "#c0392b"),
    "rendimento_real": (q, "Rendimento real (R$)", "#2471a3"),
    "endividamento_familias": (m, "Endividamento (% da renda)", "#7d3c98"),
    "ipca_mensal": (m, "IPCA mensal (%)", "#d68910"),
    "ipca_12m": (m, "IPCA 12 meses (%)", "#d68910"),
}
DIST = ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_mensal"]
SERIES = ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_12m"]


def n_obs(col):
    return "58 trimestres" if V[col][0] is q else "174 meses"


def shade(ax):
    ax.axvspan(pd.Timestamp("2014-04-01"), pd.Timestamp("2016-12-31"), color="#cccccc", alpha=.4, lw=0, zorder=0)
    ax.axvspan(pd.Timestamp("2020-01-01"), pd.Timestamp("2021-12-31"), color="#f4c7c3", alpha=.4, lw=0, zorder=0)


linhas = {}
for c in ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_12m"]:
    s = V[c][0][c].dropna()
    linhas[V[c][1]] = {"n": len(s), "média": s.mean(), "mediana": s.median(), "desvio": s.std(),
                       "Q1": s.quantile(.25), "Q3": s.quantile(.75), "mín": s.min(), "máx": s.max()}
print("=== Tabela 4 — Estatísticas descritivas ===")
print(pd.DataFrame(linhas).T.round(2).to_string())
pd.DataFrame(linhas).T.to_csv(T / "tabela4_descritivas.csv", encoding="utf-8-sig")
print("\n=== Médias por fase (desocupação e rendimento: trimestres; endividamento e IPCA: meses) ===")
print(pd.concat([q.groupby("periodo")[["desocupacao", "rendimento_real"]].mean(),
                 m.groupby("periodo")[["endividamento_familias", "ipca_mensal", "ipca_12m"]].mean()], axis=1).round(2).to_string())
ext = m.loc[m.ipca_mensal.idxmin()]
print(f"\nIPCA mensal: mínimo {br(ext.ipca_mensal, 2)}% em {ext.data:%m/%Y}; meses com deflação na base: {(m.ipca_mensal < 0).sum()}")
t22 = m[m.trimestre == "2022T3"].ipca_mensal
print(f"IPCA acumulado em 2022T3: {br((np.prod(1 + t22 / 100) - 1) * 100, 2)}%")

fig, ax = plt.subplots(1, 4, figsize=(14, 4.5))
for a, c in zip(ax, DIST):
    s = V[c][0][c].dropna()
    a.boxplot(s, widths=.5, patch_artist=True, boxprops=dict(facecolor="#aed6f1"))
    a.scatter(rng.normal(1, .04, len(s)), s, s=10, color="#2c3e50", alpha=.5)
    a.set_title(f"{V[c][1]}\n{n_obs(c)}", loc="left", fontweight="bold", fontsize=10)
    a.set_xticks([])
plt.tight_layout()
plt.savefig(O / "e01_boxplots.png")
plt.close()

fig, ax = plt.subplots(2, 2, figsize=(12, 7))
for a, c in zip(ax.ravel(), DIST):
    s = V[c][0][c].dropna()
    a.hist(s, bins=12, density=True, color="#aed6f1", edgecolor="white", label="histograma")
    xs = np.linspace(s.min(), s.max(), 200)
    a.plot(xs, _stats.gaussian_kde(s)(xs), color="#1f4e79", lw=1.8, label="densidade (kernel)")
    a.set_title(f"{V[c][1]} — {n_obs(c)}", loc="left", fontweight="bold")
ax[0, 0].legend(fontsize=8, frameon=False)
plt.tight_layout()
plt.savefig(O / "e02_distribuicoes.png")
plt.close()

d = m[SERIES].dropna()
fig, ax = plt.subplots(4, 4, figsize=(11, 10))
for i, a in enumerate(SERIES):
    for j, b in enumerate(SERIES):
        x = ax[i, j]
        if i == j:
            x.hist(d[a], bins=10, color="#aed6f1", edgecolor="white")
        else:
            x.scatter(d[b], d[a], c=m.loc[d.index, "ano"], cmap="viridis", s=10)
            x.text(.03, .97, f"r = {br(d[a].corr(d[b]), 2)}", transform=x.transAxes, va="top", fontsize=8,
                   bbox=dict(boxstyle="round,pad=.2", fc="white", ec="none", alpha=.85))
        if i == 3:
            x.set_xlabel(V[b][1], fontsize=8)
        if j == 0:
            x.set_ylabel(V[a][1], fontsize=8)
        x.tick_params(labelsize=7)
fig.suptitle("Matriz de dispersão — base mensal (174 meses; cor = ano: roxo = 2012, amarelo = 2026)", fontweight="bold")
plt.tight_layout()
plt.savefig(O / "e04_matriz_dispersao.png")
plt.close()

fig, ax = plt.subplots(1, 4, figsize=(16, 4.8))
for a, c in zip(ax, DIST):
    base = V[c][0]
    a.boxplot([base[base.periodo == p][c].dropna() for p in FASES], tick_labels=FASES_CURTAS,
              patch_artist=True, boxprops=dict(facecolor="#d5f5e3"))
    a.set_title(f"{V[c][1]} — {n_obs(c)}", loc="left", fontweight="bold", fontsize=10)
    a.tick_params(axis="x", labelsize=7.5)
plt.tight_layout()
plt.savefig(O / "e05_boxplots_periodo.png")
plt.close()

fig, ax = plt.subplots(2, 2, figsize=(13, 8))
for a, c in zip(ax.ravel(), SERIES):
    base, rot, cor = V[c]
    a.plot(base.data, base[c], color=cor, lw=2)
    shade(a)
    a.set_title(f"{rot} — {n_obs(c)}", loc="left", fontweight="bold")
fig.suptitle(f"Visão geral — Brasil, {q.trimestre.iloc[0]} a {q.trimestre.iloc[-1]} "
             "(cinza: recessão 2014T2–2016T4, CODACE/FGV; rosa: pandemia)", y=1.0, fontweight="bold")
plt.tight_layout()
plt.savefig(O / "g1_series.png")
plt.close()

ipm = pd.read_csv(U / "ipca_mensal_tratado.csv", parse_dates=["data"])
fig, ax = plt.subplots(2, 1, figsize=(12, 7))
ax[0].bar(ipm.data, ipm.ipca_mensal, width=20, color=np.where(ipm.ipca_mensal < 0, "#27ae60", "#d68910"))
ax[0].set_title(f"IPCA mensal (%) — {ipm.data.min():%Y} a {ipm.data.max():%Y} (verde: deflação)", loc="left", fontweight="bold")
datas_meta = pd.concat([ipm.data, pd.Series([ipm.data.max() + pd.offsets.MonthBegin(1)])], ignore_index=True)
centro = datas_meta.dt.year.map(lambda a: META_CMN[min(a, max(META_CMN))][0])
tol = datas_meta.dt.year.map(lambda a: META_CMN[min(a, max(META_CMN))][1])
ax[1].fill_between(datas_meta, centro - tol, centro + tol, step="post", color="#d5dbdb", alpha=.6, lw=0,
                   label="intervalo de tolerância da meta")
ax[1].step(datas_meta, centro + tol, where="post", color="#7f8c8d", lw=1, label="teto da meta")
ax[1].step(datas_meta, centro, where="post", color="k", ls="--", lw=1, label="centro da meta")
ax[1].plot(ipm.data, ipm.ipca_12m, color="#c0392b", lw=1.8, label="IPCA 12 meses")
ax[1].set_title("IPCA acumulado em 12 meses (%) — com a meta de inflação vigente em cada ano (CMN)",
                loc="left", fontweight="bold")
ax[1].legend(fontsize=8, ncols=2, loc="upper left", frameon=False)
plt.tight_layout()
plt.savefig(O / "g6_ipca_mensal.png")
plt.close()
pico = ipm.loc[ipm.ipca_12m.idxmax()]
print(f"\nIPCA 12m: máximo {br(pico.ipca_12m, 2)}% em {pico.data:%m/%Y}; meses com deflação desde 2005: {(ipm.ipca_mensal < 0).sum()}")

sg = pd.read_csv(RAIZ / "dados" / "originais" / "bcdata_sgs_29037.csv", sep=";", decimal=",", dayfirst=True, parse_dates=["data"])
sg.columns = ["data", "endividamento_familias"]
fig, ax = plt.subplots(figsize=(11, 4.5))
ax.plot(sg.data, sg.endividamento_familias, color="#7d3c98", lw=1.8)
ax.axvspan(m.data.min(), m.data.max(), color="#dddddd", alpha=.45, lw=0)
ax.set_title(f"Endividamento das famílias / renda (%) — série completa {sg.data.min():%Y}–{sg.data.max():%Y}\n"
             f"(cinza = período da base: {m.data.min():%m/%Y} a {m.data.max():%m/%Y})", loc="left", fontweight="bold")
plt.tight_layout()
plt.savefig(O / "g7_endiv_2005.png")
plt.close()

fig, ax = plt.subplots(1, 2, figsize=(12, 4.5))
ax[0].plot(q.data, q.rendimento_idx_2012T1, color="#2471a3", lw=1.8)
ax[0].axhline(100, color="k", ls="--", lw=.8)
shade(ax[0])
ax[0].set_title("Rendimento real indexado (2012T1 = 100)", loc="left", fontweight="bold")
ax[1].bar(q.data, q.rend_var_ano_pct, width=60, color=np.where(q.rend_var_ano_pct >= 0, "#2471a3", "#c0392b"))
shade(ax[1])
ax[1].axhline(0, color="k", lw=.6)
ax[1].set_title("Variação anual do rendimento real (%)\n(vs mesmo trimestre do ano anterior)", loc="left", fontweight="bold")
plt.tight_layout()
plt.savefig(O / "g8_rendimento_idx_var.png")
plt.close()

print("\n=== Tendência linear (Figura 9) ===")
tendencias = []
fig, ax = plt.subplots(2, 2, figsize=(13, 8))
for a, c in zip(ax.ravel(), SERIES):
    base, rot, cor = V[c]
    s = base[["data", c]].dropna()
    t = s.data.dt.year + (s.data.dt.month - 1) / 12
    sl, ic, r, p, se = _stats.linregress(t, s[c])
    janela = 4 if base is q else 12
    a.plot(s.data, s[c], color="#2471a3", lw=1.5, label="série")
    a.plot(s.data, s[c].rolling(janela).mean(), color="#c0392b", lw=2,
           label=f"média móvel ({'4 trimestres' if janela == 4 else '12 meses'})")
    a.plot(s.data, ic + sl * t, "k--", lw=1.2, label="tendência linear")
    shade(a)
    a.set_title(f"{rot} — {br(sl, 2, True)}/ano (R² = {br(r * r, 2)})", loc="left", fontweight="bold")
    a.legend(fontsize=7, loc="best", frameon=False)
    print(f"  {rot}: {sl:+.2f} por ano, R² = {r * r:.2f} ({n_obs(c)})")
    tendencias.append({"variavel": c, "inclinacao_ano": sl, "r2": r * r, "n": len(s)})
plt.tight_layout()
plt.savefig(O / "e06_tendencias.png")
plt.close()
pd.DataFrame(tendencias).to_csv(T / "tendencias.csv", index=False, encoding="utf-8-sig")

mq = m.groupby("trimestre").agg(endividamento_familias=("endividamento_familias", "mean"),
                                ipca_12m=("ipca_12m", "last")).reset_index()
VARS_K = ["desocupacao", "rendimento_real", "ipca_12m", "endividamento_familias"]
k_base = q.merge(mq, on="trimestre").dropna(subset=VARS_K).reset_index(drop=True)
X = ((k_base[VARS_K] - k_base[VARS_K].mean()) / k_base[VARS_K].std(ddof=0)).to_numpy()


def silhouette(X, lab):
    D, s = cdist(X, X), []
    for i in range(len(X)):
        own = lab == lab[i]
        a_ = D[i, own].sum() / max(own.sum() - 1, 1)
        b_ = min(D[i, lab == k].mean() for k in np.unique(lab) if k != lab[i])
        s.append((b_ - a_) / max(a_, b_))
    return float(np.mean(s))


def kmeans(X, k, tentativas=200):
    melhor = None
    for _ in range(tentativas):
        cent, lab = kmeans2(X, k, minit="++", seed=rng)
        if len(np.unique(lab)) < k:
            continue
        inercia = ((X - cent[lab]) ** 2).sum()
        if melhor is None or inercia < melhor[0] - 1e-9:
            melhor = (inercia, lab)
    return melhor[1]


print(f"\n=== Agrupamento k-means ({len(k_base)} trimestres, 4 variáveis em z-score) ===")
sil = {k: silhouette(X, kmeans(X, k)) for k in range(2, 7)}
for k, v in sil.items():
    print(f"  k={k}: silhouette = {v:.2f}")
pd.Series(sil, name="silhouette").rename_axis("k").to_csv(T / "kmeans_silhouette.csv", encoding="utf-8-sig")
lab = kmeans(X, 4)
ordem = list(dict.fromkeys(lab))
k_base["grupo"] = [ordem.index(g) + 1 for g in lab]
med = k_base.groupby("grupo")[VARS_K].mean()
nomes = {med.ipca_12m.idxmax(): "Choque de inflação", med.endividamento_familias.idxmax(): "Renda alta e endividamento alto",
         med.desocupacao.idxmax(): "Desemprego alto, inflação baixa"}
nomes.update({g: "Pré-crise" for g in med.index if g not in nomes})
k_base["nome"] = k_base.grupo.map(nomes)


def intervalos(tris):
    idx = sorted(q.index[q.trimestre.isin(tris)])
    blocos, ini = [], idx[0]
    for a_, b_ in zip(idx, idx[1:] + [None]):
        if b_ != a_ + 1:
            blocos.append(q.trimestre[ini] + ("" if ini == a_ else "–" + q.trimestre[a_]))
            ini = b_
    return ", ".join(blocos)


tab5 = k_base.groupby("grupo").agg(nome=("nome", "first"), n=("trimestre", "size"),
                                   periodos=("trimestre", lambda s: intervalos(list(s))),
                                   **{c: (c, "mean") for c in VARS_K})
print("=== Tabela 5 — grupos (médias) ===")
print(tab5.round(1).to_string())
tab5.to_csv(T / "tabela5_grupos.csv", encoding="utf-8-sig")
print("Trimestres de cada fase em cada grupo:")
cruz = pd.crosstab(k_base.periodo, k_base.nome)
print(cruz.to_string())
cruz.to_csv(T / "kmeans_fase_x_grupo.csv", encoding="utf-8-sig")

Xc = X - X.mean(0)
U_, S_, Vt = np.linalg.svd(Xc, full_matrices=False)
pcs, var = Xc @ Vt[:2].T, S_ ** 2 / (S_ ** 2).sum() * 100
CORES_G = {"Pré-crise": "#7f8c8d", "Choque de inflação": "#c0392b",
           "Desemprego alto, inflação baixa": "#d68910", "Renda alta e endividamento alto": "#2471a3"}
fig, ax = plt.subplots(1, 2, figsize=(14, 5.5))
for g, d_ in k_base.groupby("grupo"):
    nome = nomes[g]
    ax[0].scatter(pcs[d_.index, 0], pcs[d_.index, 1], s=40, color=CORES_G[nome], label=f"{g}. {nome}")
    ax[1].scatter(d_.trimestre.map(dict(zip(q.trimestre, q.data))), [g] * len(d_), s=40, color=CORES_G[nome])
for tri_ in [k_base.trimestre.iloc[0], "2016T1", "2017T1", "2019T4", "2020T3", "2021T3", "2022T2", k_base.trimestre.iloc[-1]]:
    i = k_base.index[k_base.trimestre == tri_]
    if len(i):
        ax[0].annotate(tri_, (pcs[i[0], 0], pcs[i[0], 1]), fontsize=7, xytext=(4, 4), textcoords="offset points")
ax[0].set_xlabel(f"Componente 1 ({var[0]:.0f}% da variação)")
ax[0].set_ylabel(f"Componente 2 ({var[1]:.0f}%)")
ax[0].set_title("Agrupamentos (k-means, k = 4) projetados em 2D", loc="left", fontweight="bold")
ax[0].legend(fontsize=8)
ax[1].set_yticks(range(1, 5), [f"{g}. {nomes[g]}" for g in range(1, 5)])
ax[1].set_ylim(.5, 4.5)
ax[1].set_title("Em que épocas cada grupo aparece", loc="left", fontweight="bold")
plt.tight_layout()
plt.savefig(O / "e10_agrupamento.png")
plt.close()

print("\nFiguras salvas em", O)
