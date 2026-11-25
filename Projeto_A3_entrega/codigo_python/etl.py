import csv
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = Path(__file__).resolve().parent.parent
U = RAIZ / "dados" / "originais"
O = RAIZ / "dados" / "gerados"
O.mkdir(parents=True, exist_ok=True)


def ibge_row(path, label_col, row_idx=4):
    with open(path, encoding="utf-8-sig") as f:
        r = list(csv.reader(f))
    head, vals = r[3], r[row_idx]
    return [(head[i], vals[i]) for i in range(label_col, len(head)) if head[i].strip() and not head[i].startswith("Nível")]


pn = pd.DataFrame(ibge_row(U / "PNAD.csv", 3), columns=["tri", "desocupacao"])

with open(U / "RENDIMENTO.csv", encoding="utf-8-sig") as f:
    rr = list(csv.reader(f))
rd = pd.DataFrame(list(zip(rr[3][1:], rr[4][1:])), columns=["tri", "rendimento_real"])


def tri(s):
    m = re.match(r"(\d)º trimestre (\d{4})", s)
    return f"{m.group(2)}T{m.group(1)}"


pn["trimestre"] = pn.tri.map(tri)
rd["trimestre"] = rd.tri.map(tri)

with open(U / "IPCA.csv", encoding="utf-8-sig") as f:
    ir = list(csv.reader(f))
meses = {m: i + 1 for i, m in enumerate(
    "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split())}
rows = []
for i in range(3, len(ir[3])):
    h = ir[3][i]
    if h.strip() and not h.startswith("Nível"):
        m, a = h.split()
        rows.append((pd.Timestamp(int(a), meses[m], 1), ir[4][i]))
ip = pd.DataFrame(rows, columns=["data", "ipca_mensal"])

sg = pd.read_csv(U / "bcdata_sgs_29037.csv", sep=";", decimal=",", dayfirst=True, parse_dates=["data"])
sg.columns = ["data", "endividamento_familias"]

for tab, c in ((pn, "desocupacao"), (rd, "rendimento_real"), (ip, "ipca_mensal")):
    tab[c] = pd.to_numeric(tab[c], errors="coerce")
print("NaN:", pn.desocupacao.isna().sum(), rd.rendimento_real.isna().sum(),
      ip.ipca_mensal.isna().sum(), sg.endividamento_familias.isna().sum())
print("dups:", sg.data.duplicated().sum(), ip.data.duplicated().sum())

ip = ip.sort_values("data").reset_index(drop=True)
ip["fator"] = 1 + ip.ipca_mensal / 100
ip["ipca_12m"] = (ip.fator.rolling(12).apply(np.prod, raw=True) - 1) * 100

sg = sg.sort_values("data").reset_index(drop=True)
sg["endividamento_var_pp_12m"] = sg.endividamento_familias.diff(12)


def periodo(ano, t, ultimo):
    chave = ano * 10 + t
    if chave <= 20141:
        return "1. Expansão pré-recessão (2012T1-2014T1)"
    if chave <= 20164:
        return "2. Recessão CODACE (2014T2-2016T4)"
    if chave <= 20194:
        return "3. Expansão CODACE (2017T1-2019T4)"
    if chave <= 20214:
        return "4. Pandemia (2020T1-2021T4)"
    return f"5. Pós-pandemia (2022T1-{ultimo})"


q = pn[["trimestre", "desocupacao"]].merge(rd[["trimestre", "rendimento_real"]], on="trimestre")
ip["trimestre"] = ip.data.dt.to_period("Q").astype(str).str.replace("Q", "T")
sg["trimestre"] = sg.data.dt.to_period("Q").astype(str).str.replace("Q", "T")
completos = set(ip.groupby("trimestre").size().loc[lambda s: s == 3].index) & \
            set(sg.groupby("trimestre").size().loc[lambda s: s == 3].index)
print("Trimestres da PNAD descartados (meses incompletos):", sorted(set(q.trimestre) - completos) or "nenhum")
q = q[q.trimestre.isin(completos)].reset_index(drop=True)
q["ano"] = q.trimestre.str[:4].astype(int)
q["tri_num"] = q.trimestre.str[-1].astype(int)
q["rend_var_trim_pct"] = q.rendimento_real.pct_change() * 100
q["rend_var_ano_pct"] = q.rendimento_real.pct_change(4) * 100
q["desocup_var_pp_ano"] = q.desocupacao.diff(4)
q["rendimento_idx_2012T1"] = q.rendimento_real / q.rendimento_real.iloc[0] * 100
ultimo = q.trimestre.iloc[-1]
q["periodo"] = [periodo(a, t, ultimo) for a, t in zip(q.ano, q.tri_num)]

m = ip[["data", "trimestre", "ipca_mensal", "ipca_12m"]].merge(
    sg[["data", "endividamento_familias", "endividamento_var_pp_12m"]], on="data")
m = m[m.trimestre.isin(q.trimestre)].reset_index(drop=True)
m.insert(1, "ano", m.data.dt.year)
m.insert(2, "mes", m.data.dt.month)
m.insert(4, "tri_num", m.trimestre.str[-1].astype(int))
m.insert(5, "mes_do_trimestre", (m.mes - 1) % 3 + 1)
m = m.merge(q[["trimestre", "desocupacao", "rendimento_real", "desocup_var_pp_ano", "rend_var_ano_pct",
               "rend_var_trim_pct", "rendimento_idx_2012T1", "periodo"]], on="trimestre")
m["indice_miseria"] = m.desocupacao + m.ipca_12m
m["periodo"] = m.pop("periodo")
m["granularidade_desocup_rendimento"] = "trimestral (repetido nos 3 meses do trimestre)"
m["granularidade_ipca_endividamento"] = "mensal (nativo)"
assert len(m) == 3 * len(q), "cada trimestre precisa ter 3 meses"

m.to_csv(O / "dataset_final.csv", index=False, encoding="utf-8-sig", lineterminator="\n")
q.to_csv(O / "dataset_trimestral.csv", index=False, encoding="utf-8-sig", lineterminator="\n")
ip[["data", "ipca_mensal", "fator", "ipca_12m"]].to_csv(O / "ipca_mensal_tratado.csv", index=False, lineterminator="\n")

print(f"dataset_final.csv: {m.shape[0]} meses x {m.shape[1]} colunas "
      f"({m.data.iloc[0]:%m/%Y} a {m.data.iloc[-1]:%m/%Y})")
print(f"dataset_trimestral.csv: {q.shape[0]} trimestres x {q.shape[1]} colunas ({q.trimestre.iloc[0]} a {ultimo})")
print(f"ipca_mensal_tratado.csv: {len(ip)} meses ({ip.data.iloc[0]:%m/%Y} a {ip.data.iloc[-1]:%m/%Y})")
print(q.groupby("periodo").size().to_string())
