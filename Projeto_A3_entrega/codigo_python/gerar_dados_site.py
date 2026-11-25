import json
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
m = pd.read_csv(RAIZ / "dados" / "gerados" / "dataset_final.csv")
q = pd.read_csv(RAIZ / "dados" / "gerados" / "dataset_trimestral.csv")

mq = m.groupby("trimestre").agg(
    endividamento_familias=("endividamento_familias", "mean"),
    ipca_12m_trim=("ipca_12m", "last"),
    ipca_trimestre=("ipca_mensal", lambda s: (np.prod(1 + s / 100) - 1) * 100),
).reset_index()
t = q.merge(mq, on="trimestre", how="left")
t["endiv_var_pp_ano"] = t.endividamento_familias.diff(4)
t["indice_miseria"] = t.desocupacao + t.ipca_12m_trim
t = t.rename(columns={"tri_num": "tri"})

COLS_TRI = ["trimestre", "ano", "tri", "periodo", "desocupacao", "rendimento_real", "ipca_trimestre", "endividamento_familias",
            "rend_var_trim_pct", "rend_var_ano_pct", "desocup_var_pp_ano", "endiv_var_pp_ano", "ipca_12m_trim",
            "indice_miseria", "rendimento_idx_2012T1"]
mm = m.rename(columns={"ipca_12m": "ipca_12m_trim", "endividamento_var_pp_12m": "endiv_var_pp_ano"})
COLS_MES = ["ano", "mes", "trimestre", "periodo", "desocupacao", "rendimento_real", "endividamento_familias",
            "ipca_12m_trim", "rend_var_ano_pct", "desocup_var_pp_ano", "endiv_var_pp_ano"]


def registros(df, cols):
    out = []
    for r in df[cols].to_dict("records"):
        out.append({k: (None if isinstance(v, float) and np.isnan(v) else round(v, 6) if isinstance(v, float) else v)
                    for k, v in r.items()})
    return out


linhas = registros(t, COLS_TRI)
mensal = registros(mm, COLS_MES)
saida = RAIZ / "dashboard_online" / "dados.js"
saida.parent.mkdir(exist_ok=True)
dados = {"fonte": "dataset_final.csv e dataset_trimestral.csv, gerados pelo etl.py", "linhas": linhas, "mensal": mensal}
saida.write_text("window.DADOS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{len(linhas)} trimestres ({linhas[0]['trimestre']} a {linhas[-1]['trimestre']}) e {len(mensal)} meses gravados em {saida}")
