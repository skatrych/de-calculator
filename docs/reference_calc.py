#!/usr/bin/env python3
"""Research aid used to produce the golden-test figures in SPEC.md.

Supports tax years 2023–2026 (including West/Ost Rechtskreis and the
mid-2023 weighted PV rate) and the three-year average (calculate_average).
This is NOT the product. The product is a TypeScript implementation of SPEC.md.
If this script and SPEC.md ever disagree, SPEC.md wins.
"""
from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN, localcontext
from dataclasses import dataclass, field
from typing import Optional

D = Decimal
C = D('0.01')

def d(x) -> Decimal:
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))

def floor_eur(x: Decimal) -> Decimal:
    return d(x).to_integral_value(rounding=ROUND_DOWN)

def floor_100(x: Decimal) -> Decimal:
    return (d(x) / 100).to_integral_value(rounding=ROUND_DOWN) * 100

def floor_cents(x: Decimal) -> Decimal:
    return (d(x) * 100).to_integral_value(rounding=ROUND_DOWN) / 100

def comm_cents(x: Decimal) -> Decimal:
    return d(x).quantize(C, rounding=ROUND_HALF_UP)

# ---- Year params ----
PARAMS = {
    2023: dict(
        gfb=D(10908),
        z1_hi=D(15999),
        z2_hi=D(62809),
        z3_hi=D(277825),
        a=D('979.18'),
        b=D('192.59'),
        c=D('966.53'),
        d_sub=D('9972.98'),
        e_sub=D('18307.73'),
        z_base=D(15999),
        soli_fg=D(17543),
        soli_fg_joint=D(35086),
        kv_bbg=D(59850),
        rv_rate=D('0.186'),
        av_rate=D('0.026'),
        zusatz=D('0.016'),
        alter_cap=D(26528),
        kfb_one=D(4476),   # 3,012 + 1,464
        kfb_both=D(8952),
        knap_bbg=D(107400),
        rv_min_m=comm_cents(D(520) * D('0.186')),  # 96.72
        west=dict(
            bez=D(40740), bez_m=D(3395),
            kv_min=D(40740) / 3,  # 13580
            rv_bbg=D(87600), rv_bbg_m=D(7300),
            rv_max_m=comm_cents(D(7300) * D('0.186')),  # 1357.80
            regel_m=comm_cents(D(3395) * D('0.186')),  # 631.47
        ),
        ost=dict(
            bez=D(39480), bez_m=D(3290),
            kv_min=D(39480) / 3,  # 13160
            rv_bbg=D(85200), rv_bbg_m=D(7100),
            rv_max_m=comm_cents(D(7100) * D('0.186')),  # 1320.60
            regel_m=comm_cents(D(3290) * D('0.186')),  # 611.94
        ),
    ),
    2024: dict(
        gfb=D(11784),
        z1_hi=D(17005),
        z2_hi=D(66760),
        z3_hi=D(277825),
        a=D('954.80'),
        b=D('181.19'),
        c=D('991.21'),
        d_sub=D('10636.31'),
        e_sub=D('18971.06'),
        z_base=D(17005),
        soli_fg=D(18130),
        soli_fg_joint=D(36260),
        kv_bbg=D(62100),
        rv_rate=D('0.186'),
        av_rate=D('0.026'),
        zusatz=D('0.017'),
        alter_cap=D(27566),
        kfb_one=D(4770),   # 3,306 + 1,464
        kfb_both=D(9540),
        knap_bbg=D(111600),
        rv_min_m=comm_cents(D(538) * D('0.186')),  # 100.07
        west=dict(
            bez=D(42420), bez_m=D(3535),
            kv_min=D(42420) / 3,  # 14140
            rv_bbg=D(90600), rv_bbg_m=D(7550),
            rv_max_m=comm_cents(D(7550) * D('0.186')),  # 1404.30
            regel_m=comm_cents(D(3535) * D('0.186')),  # 657.51
        ),
        ost=dict(
            bez=D(41580), bez_m=D(3465),
            kv_min=D(41580) / 3,  # 13860
            rv_bbg=D(89400), rv_bbg_m=D(7450),
            rv_max_m=comm_cents(D(7450) * D('0.186')),  # 1385.70
            regel_m=comm_cents(D(3465) * D('0.186')),  # 644.49
        ),
    ),
    2025: dict(
        gfb=D(12096),
        z1_hi=D(17443),
        z2_hi=D(68480),
        z3_hi=D(277825),
        a=D('932.30'),
        b=D('176.64'),
        c=D('1015.13'),
        d_sub=D('10911.92'),
        e_sub=D('19246.67'),
        z_base=D(17443),
        soli_fg=D(19950),
        soli_fg_joint=D(39900),
        kv_bbg=D(66150),
        kv_min=D(44940) / 3,  # 14980
        bez=D(44940),
        bez_m=D(3745),
        rv_bbg=D(96600),
        rv_rate=D('0.186'),
        rv_min_m=comm_cents(D(556) * D('0.186')),  # 103.42
        rv_max_m=comm_cents(D(8050) * D('0.186')),  # 1497.30
        regel_m=comm_cents(D(3745) * D('0.186')),  # 696.57
        av_rate=D('0.026'),
        zusatz=D('0.025'),
        alter_cap=D(29344),
        kfb_one=D(4800),
        kfb_both=D(9600),
        knap_bbg=D(118800),
    ),
    2026: dict(
        gfb=D(12348),
        z1_hi=D(17799),
        z2_hi=D(69878),
        z3_hi=D(277825),
        a=D('914.51'),
        b=D('173.10'),
        c=D('1034.87'),
        d_sub=D('11135.63'),
        e_sub=D('19470.38'),
        z_base=D(17799),
        soli_fg=D(20350),
        soli_fg_joint=D(40700),
        kv_bbg=D(69750),
        kv_min=D(47460) / 3,  # 15820
        bez=D(47460),
        bez_m=D(3955),
        rv_bbg=D(101400),
        rv_rate=D('0.186'),
        rv_min_m=comm_cents(D(603) * D('0.186')),  # 112.16
        rv_max_m=comm_cents(D(8450) * D('0.186')),  # 1571.70
        regel_m=comm_cents(D(3955) * D('0.186')),  # 735.63
        av_rate=D('0.026'),
        zusatz=D('0.029'),
        alter_cap=D(30826),
        kfb_one=D(4878),
        kfb_both=D(9756),
        knap_bbg=D(124800),
    ),
}

def tariff(zve: Decimal, year: int) -> Decimal:
    """§32a Abs. 1: zve already a whole euro. Returns whole euro (floored)."""
    p = PARAMS[year]
    x = floor_eur(zve)
    if x <= p['gfb']:
        raw = D(0)
        zone = 1
        detail = f"x={x} <= GFB {p['gfb']} -> 0"
    elif x <= p['z1_hi']:
        y = (x - p['gfb']) / 10000
        raw = (p['a'] * y + 1400) * y
        zone = 2
        detail = f"y=({x}-{p['gfb']})/10000={y}; raw=({p['a']}*y+1400)*y={raw}"
    elif x <= p['z2_hi']:
        z = (x - p['z_base']) / 10000
        raw = (p['b'] * z + 2397) * z + p['c']
        zone = 3
        detail = f"z=({x}-{p['z_base']})/10000={z}; raw=({p['b']}*z+2397)*z+{p['c']}={raw}"
    elif x <= p['z3_hi']:
        raw = D('0.42') * x - p['d_sub']
        zone = 4
        detail = f"raw=0.42*{x}-{p['d_sub']}={raw}"
    else:
        raw = D('0.45') * x - p['e_sub']
        zone = 5
        detail = f"raw=0.45*{x}-{p['e_sub']}={raw}"
    est = floor_eur(raw)
    return est, raw, zone, detail

def tariff_splitting(zve_joint: Decimal, year: int):
    half = floor_eur(d(zve_joint) / 2)
    est_half, raw, zone, detail = tariff(half, year)
    return est_half * 2, half, est_half, raw, zone, detail

def soli_on(est: Decimal, year: int, joint: bool):
    p = PARAMS[year]
    fg = p['soli_fg_joint'] if joint else p['soli_fg']
    if est <= fg:
        return D(0), f"ESt {est} <= Freigrenze {fg} -> 0"
    full = D('0.055') * est
    mild = D('0.119') * (est - fg)
    raw = min(full, mild)
    soli = floor_cents(raw)
    which = "full 5.5%" if full <= mild else "Milderung 11.9%"
    return soli, f"{which}: min(0.055*{est}={full}, 0.119*({est}-{fg})={mild})={raw} -> floor cents {soli}"

def resolve_params(year: int, rechtskreis: str = 'west') -> dict:
    """Return a flat param dict with Rechtskreis West/Ost applied for 2023-2024.
    From 2025 the Bezugsgröße and RV-BBG are nationwide (SVBezGrV 2025 onward).
    """
    base = dict(PARAMS[year])  # shallow
    if 'west' in base:
        rk = base['ost'] if rechtskreis == 'ost' else base['west']
        out = {k: v for k, v in base.items() if k not in ('west', 'ost')}
        out.update(rk)
        return out
    # 2025+ already flat and unified
    return base

def _pv_from_base(base: Decimal, surcharge_childless: Decimal, age23: bool, children: int, abschlag: bool) -> Decimal:
    """base = general PV rate; surcharge for childless 23+; if abschlag, -0.25 pp from 2nd to 5th child under 25."""
    if children <= 0:
        return base + (surcharge_childless if age23 else D(0))
    if children == 1 or not abschlag:
        return base  # Elterneigenschaft, no surcharge; pre-PUEG also no Abschlag
    n = min(children, 5)
    return base - D('0.0025') * (n - 1)

def pv_rate(year: int, age23: bool, children: int) -> Decimal:
    """Annual PV rate. For 2023, a 6+6 month weighted average around the 1 July PUEG change."""
    if year >= 2025:
        return _pv_from_base(D('0.036'), D('0.006'), age23, children, abschlag=True)
    if year == 2024:
        return _pv_from_base(D('0.034'), D('0.006'), age23, children, abschlag=True)
    if year == 2023:
        # 1 Jan–30 Jun: 3.05 % general, +0.35 pp childless 23+, no Abschlag
        # 1 Jul–31 Dec (PUEG): 3.40 % general, +0.60 pp childless, Abschlag 2nd–5th
        h1 = _pv_from_base(D('0.0305'), D('0.0035'), age23, children, abschlag=False)
        h2 = _pv_from_base(D('0.0340'), D('0.0060'), age23, children, abschlag=True)
        return (h1 + h2) / 2  # exact 6/12 + 6/12; equals (h1+h2)/2
    raise ValueError(year)

def calculate(inp: dict, verbose=True):
    year = inp['year']
    rechtskreis = inp.get('rechtskreis', 'west')
    p = resolve_params(year, rechtskreis)
    gewinn = d(inp['gewinn'])
    gewerbe = inp.get('gewerbe', False)
    hebesatz = d(inp.get('hebesatz', 400))
    married = inp.get('married', False)
    spouse = d(inp.get('spouse_zve', 0))
    church = d(inp.get('church', 0))  # 0, 0.08, 0.09
    children = inp.get('children', 0)  # under 25 for PV
    # Kinderfreibetrag-Zähler (SPEC v1.3). Default: children × (1.0 if married else 0.5).
    if 'kfb_zaehler' in inp:
        kfb_zaehler = D(str(inp['kfb_zaehler']))
    else:
        # Backward compatible with children_kfb / kfb_full if a caller still passes them.
        children_kfb = inp.get('children_kfb', children)
        kfb_full = inp.get('kfb_full', married)
        kfb_zaehler = D(children_kfb) * (D(1) if (married or kfb_full) else D('0.5'))
    age23 = inp.get('age23', True)
    kv_type = inp.get('kv_type', 'gkv_ermaessigt')  # gkv_ermaessigt, gkv_allgemein, pkv
    zusatz = d(inp.get('zusatz', p['zusatz']))
    pkv_month = d(inp.get('pkv_month', 0))
    pkv_basis_month = d(inp.get('pkv_basis_month', 0))
    ppv_month = d(inp.get('ppv_month', 0))  # private Pflege
    rv_mode = inp.get('rv_mode', 'none')  # none, voluntary, mandatory, regelbeitrag
    rv_voluntary_month = d(inp.get('rv_voluntary_month', 0))
    av = inp.get('av', False)
    av_start = inp.get('av_start', False)
    other_sa = d(inp.get('other_sa', 0))
    lines = []
    def log(s=""):
        lines.append(s)
        if verbose:
            print(s)

    log(f"=== {inp.get('name','case')} ===")
    log(f"Jahr={year} Rechtskreis={rechtskreis} Gewinn={gewinn} Gewerbe={gewerbe} Hebesatz={hebesatz} married={married} spouse={spouse}")
    log(f"KiSt={church} children={children} age23={age23} kv={kv_type} zusatz={zusatz} rv={rv_mode} av={av}")

    # --- Social: KV/PV ---
    kv_cash = D(0)
    pv_cash = D(0)
    kv_ded = D(0)  # deductible Basis-KV
    pv_ded = D(0)
    has_krankengeld = False
    kv_notes = ""

    if kv_type in ('gkv_ermaessigt', 'gkv_allgemein'):
        bem = gewinn
        if bem < p['kv_min']:
            bem = p['kv_min']
        if bem > p['kv_bbg']:
            bem = p['kv_bbg']
        bem = bem  # exact
        log(f"KV/PV-Bemessung: clamp({gewinn}, {p['kv_min']}, {p['kv_bbg']}) = {bem}")
        if kv_type == 'gkv_allgemein':
            kv_rate = D('0.146') + zusatz
            has_krankengeld = True
        else:
            kv_rate = D('0.140') + zusatz
            has_krankengeld = False
        kv_cash = comm_cents(bem * kv_rate)
        pvr = pv_rate(year, age23, children)
        pv_cash = comm_cents(bem * pvr)
        if has_krankengeld:
            kv_ded = comm_cents(kv_cash * D('0.96'))
            kv_notes = "96% (4% Krankengeld-Abschlag)"
        else:
            kv_ded = kv_cash
            kv_notes = "100% (kein Krankengeld)"
        pv_ded = pv_cash
        log(f"KV-Satz={kv_rate} KV={kv_cash} ({kv_notes}); deductible={kv_ded}")
        log(f"PV-Satz={pvr} PV={pv_cash}; deductible={pv_ded}")
    elif kv_type == 'pkv':
        kv_cash = comm_cents(pkv_month * 12)
        kv_ded = comm_cents(pkv_basis_month * 12)
        pv_cash = comm_cents(ppv_month * 12)
        pv_ded = pv_cash
        bem = None
        log(f"PKV cash={kv_cash} Basis-Anteil deductible={kv_ded}; priv. PV cash=ded={pv_cash}")
    else:
        raise ValueError(kv_type)

    # --- RV ---
    rv_cash = D(0)
    if rv_mode == 'none':
        pass
    elif rv_mode == 'voluntary':
        m = rv_voluntary_month
        if m < p['rv_min_m'] or m > p['rv_max_m']:
            log(f"WARNING: voluntary RV {m} outside [{p['rv_min_m']}, {p['rv_max_m']}]")
        rv_cash = comm_cents(m * 12)
    elif rv_mode == 'mandatory':
        bem_rv = gewinn
        min_annual = comm_cents(p['rv_min_m'] * 12)  # use monthly official * 12
        # For mandatory, assessment is Arbeitseinkommen clamped to [Geringfügigkeitsgrenze*12?, BBG]
        # Use: clamp Gewinn to [min_bemessung, BBG] where min is Geringfügigkeitsgrenze * 12
        # Actually mandatory: 18.6% of Gewinn, min Mindestbeitrag, max Höchstbeitrag
        raw_rv = comm_cents(gewinn * p['rv_rate'])
        min_rv = comm_cents(p['rv_min_m'] * 12)
        max_rv = comm_cents(p['rv_max_m'] * 12)
        rv_cash = min(max(raw_rv, min_rv), max_rv)
        log(f"RV Pflicht: clamp({raw_rv}, {min_rv}, {max_rv}) = {rv_cash}")
    elif rv_mode == 'regelbeitrag':
        rv_cash = comm_cents(p['regel_m'] * 12)
        log(f"RV Regelbeitrag: {p['regel_m']}*12={rv_cash}")

    # --- AV ---
    av_cash = D(0)
    if av:
        base = p['bez_m'] * (D('0.5') if av_start else D(1))
        av_m = comm_cents(base * p['av_rate'])
        av_cash = comm_cents(av_m * 12)
        log(f"AV: monthly {av_m} annual {av_cash} (start={av_start})")

    # --- Deductible Vorsorge §10 ---
    cap_alter = p['alter_cap'] * (2 if married else 1)
    ded_alter = min(rv_cash, cap_alter)
    log(f"Altersvorsorge deductible: min({rv_cash}, cap {cap_alter}) = {ded_alter}")

    basis = kv_ded + pv_ded
    sonstige_cap = D(2800)  # self-employed without employer KV subsidy
    # If married, joint cap = 2800+2800 if both self-employed without subsidy - v1: only user, use 2800
    # (simplification documented)
    if basis >= sonstige_cap:
        ded_basis = basis  # fully deductible
        ded_sonstige = D(0)  # AV etc. not deductible
        log(f"Basis-KV/PV {basis} >= {sonstige_cap}: fully deductible; sonstige (AV={av_cash}) not deductible")
    else:
        room = sonstige_cap - basis
        ded_basis = basis
        ded_sonstige = min(av_cash, room)  # Nr. 3a
        log(f"Basis-KV/PV {basis} < {sonstige_cap}: room {room}; sonstige deductible {ded_sonstige}")

    vorsorge = ded_alter + ded_basis + ded_sonstige
    log(f"Vorsorge total deductible = {vorsorge}")

    # --- GewSt ---
    messbetrag = D(0)
    gewst = D(0)
    if gewerbe:
        ge = floor_100(gewinn)
        after_fb = ge - D(24500)
        if after_fb < 0:
            after_fb = D(0)
        messbetrag = comm_cents(after_fb * D('0.035'))  # typically exact .00 or .50
        # Keep exact if it's X.00 or X.50 from 3.5% of multiples of 100
        messbetrag_exact = after_fb * D('0.035')
        messbetrag = messbetrag_exact  # exact; 3.5% of 100-multiple is 2 decimals max
        gewst = comm_cents(messbetrag * hebesatz / 100)
        log(f"Gewerbeertrag floor-100={ge}; nach FB={after_fb}; Messbetrag={messbetrag}; GewSt={gewst} (H {hebesatz}%)")
    else:
        log("Freiberufler: keine GewSt")

    # --- Iterate KiSt ---
    pausch = D(72) if married else D(36)
    kist = D(0)
    fest = D(0)
    est = D(0)
    zve = D(0)
    zve_joint = D(0)
    credit = D(0)
    for i in range(30):
        sa = max(pausch, other_sa + kist)
        zve = floor_eur(gewinn - vorsorge - sa)
        if zve < 0:
            zve = D(0)
        zve_joint = zve + floor_eur(spouse)
        if married:
            est, half, est_half, raw, zone, detail = tariff_splitting(zve_joint, year)
            tax_detail = f"Splitting: joint={zve_joint}, half={half}, est_half raw {raw} floor {est_half}*2={est} zone{zone} ({detail})"
        else:
            est, raw, zone, detail = tariff(zve, year)
            tax_detail = f"Grundtarif: zve={zve} {detail} floor->{est} zone{zone}"
        # §35
        if gewerbe and messbetrag > 0:
            four = D(4) * messbetrag
            # proportional: user Gewinn / (Gewinn + max(spouse,0)) if married and spouse>0
            pos_user = gewinn if gewinn > 0 else D(0)
            pos_spouse = spouse if (married and spouse > 0) else D(0)
            pos_sum = pos_user + pos_spouse
            if pos_sum > 0:
                prop = (pos_user / pos_sum) * est
            else:
                prop = est
            # Don't round prop? Use exact, then min, commercial cents?
            credit = min(four, gewst, prop)
            # credit used against whole-euro ESt; keep cents
            if credit > est:
                credit = est
        else:
            credit = D(0)
        fest = est - credit
        if fest < 0:
            fest = D(0)
        if church > 0:
            kist_new = comm_cents(church * fest)
        else:
            kist_new = D(0)
        log(f"  iter {i}: sa={sa} zve={zve} {tax_detail}")
        log(f"          §35 credit=min(4*Mess={D(4)*messbetrag}, GewSt={gewst}, prop)={credit}; fest={fest}; KiSt={kist_new}")
        if kist_new == kist:
            break
        kist = kist_new
    else:
        log("WARNING: KiSt did not converge")

    # --- Soli, possibly with Kinderfreibetrag ---
    kfb = p['kfb_both'] * kfb_zaehler if kfb_zaehler > 0 else D(0)
    # fictitious zve for Soli
    if kfb > 0:
        sa = max(pausch, other_sa + kist)
        zve_soli_user = floor_eur(gewinn - vorsorge - sa - kfb)
        if zve_soli_user < 0:
            zve_soli_user = D(0)
        if married:
            zve_soli_joint = zve_soli_user + floor_eur(spouse)
            est_soli, *_ = tariff_splitting(zve_soli_joint, year)
        else:
            est_soli, *_ = tariff(zve_soli_user, year)
        # recompute §35 on this fictitious ESt
        if gewerbe and messbetrag > 0:
            four = D(4) * messbetrag
            pos_user = gewinn if gewinn > 0 else D(0)
            pos_spouse = spouse if (married and spouse > 0) else D(0)
            pos_sum = pos_user + pos_spouse
            prop = (pos_user / pos_sum) * est_soli if pos_sum > 0 else est_soli
            credit_s = min(four, gewst, prop, est_soli)
        else:
            credit_s = D(0)
        fest_soli = est_soli - credit_s
        if fest_soli < 0:
            fest_soli = D(0)
        log(f"Soli-KFB={kfb}: zve_soli_user={zve_soli_user} est_soli={est_soli} credit={credit_s} fest_soli={fest_soli}")
    else:
        fest_soli = fest
    soli, soli_d = soli_on(fest_soli, year, married)
    log(f"Soli: {soli_d}")

    # User's share of joint taxes
    if married and zve_joint > 0:
        share = zve / zve_joint
    else:
        share = D(1)
    est_user = comm_cents(fest * share) if married else fest  # fest may have cents from credit
    # For unmarried, fest is whole euros minus credit (maybe cents)
    if not married:
        est_user = fest
    soli_user = comm_cents(soli * share) if married else soli
    kist_user = comm_cents(kist * share) if married else kist
    if married:
        log(f"Tax allocation share={share}: ESt_user={est_user} Soli_user={soli_user} KiSt_user={kist_user} (joint fest={fest} soli={soli} kist={kist})")

    # Optional Steuerbescheid override (ESt / Soli / KiSt). GewSt and socials stay computed.
    override_used = False
    if any(k in inp for k in ('override_est', 'override_soli', 'override_kist')):
        override_used = True
        log(f"OVERRIDE from Steuerbescheid: calculated ESt={est_user} Soli={soli_user} KiSt={kist_user}")
        if 'override_est' in inp:
            est_user = d(inp['override_est'])
        if 'override_soli' in inp:
            soli_user = d(inp['override_soli'])
        if 'override_kist' in inp:
            kist_user = d(inp['override_kist'])
        fest = est_user  # display
        soli = soli_user
        kist = kist_user
        log(f"  using ESt={est_user} Soli={soli_user} KiSt={kist_user}")

    total_tax = est_user + soli_user + kist_user + gewst
    total_soc = kv_cash + pv_cash + rv_cash + av_cash
    total_burden = total_tax + total_soc
    netto = gewinn - total_burden
    eff = (total_burden / gewinn * 100) if gewinn else D(0)
    log(f"ESt fest (joint)={fest} user={est_user}")
    log(f"Soli user={soli_user} KiSt user={kist_user} GewSt={gewst}")
    log(f"KV={kv_cash} PV={pv_cash} RV={rv_cash} AV={av_cash}")
    log(f"Total burden={total_burden} Netto={netto} monthly={comm_cents(netto/12)}")
    log(f"Effective burden={eff.quantize(D('0.01'), rounding=ROUND_HALF_UP)}%")
    log()

    result = dict(
        kv_cash=kv_cash, pv_cash=pv_cash, rv_cash=rv_cash, av_cash=av_cash,
        kv_ded=kv_ded, pv_ded=pv_ded, ded_alter=ded_alter, vorsorge=vorsorge,
        messbetrag=messbetrag, gewst=gewst, credit=credit,
        zve=zve, zve_joint=zve_joint, est=est, fest=fest,
        soli=soli, kist=kist,
        est_user=est_user, soli_user=soli_user, kist_user=kist_user,
        netto=netto, total_burden=total_burden, eff=eff,
        lines=lines,
        bem_kv=bem if kv_type.startswith('gkv') else None,
        override_used=override_used,
        year=year,
        gewinn=gewinn,
    )
    return result


def calculate_average(inputs, verbose=True):
    """Arithmetic mean of N yearly results (product rule: 3 consecutive closed years)."""
    results = [calculate(inp, verbose=verbose) for inp in inputs]
    n = D(len(results))
    def avg(key):
        return comm_cents(sum((r[key] for r in results), D(0)) / n)
    out = dict(
        n=len(results),
        years=[r['year'] for r in results],
        per_year=results,
        avg_netto=avg('netto'),
        avg_burden=avg('total_burden'),
        avg_est=avg('est_user'),
        avg_soli=avg('soli_user'),
        avg_kist=avg('kist_user'),
        avg_gewst=avg('gewst'),
        avg_kv=avg('kv_cash'),
        avg_pv=avg('pv_cash'),
        avg_rv=avg('rv_cash'),
        avg_av=avg('av_cash'),
        avg_gewinn=avg('gewinn'),
    )
    out['avg_monthly'] = comm_cents(out['avg_netto'] / 12)
    out['avg_eff'] = (out['avg_burden'] / out['avg_gewinn'] * 100).quantize(D('0.01'), rounding=ROUND_HALF_UP) if out['avg_gewinn'] else D(0)
    if verbose:
        print(f"=== DREIJAHRESDURCHSCHNITT {out['years']} ===")
        for r in results:
            print(f"  {r['year']}: Gewinn={r['gewinn']} Netto={r['netto']} Burden={r['total_burden']}")
        print(f"  AVERAGE Netto={out['avg_netto']} monthly={out['avg_monthly']} Burden={out['avg_burden']} effective={out['avg_eff']}%")
        print(f"  avg ESt={out['avg_est']} Soli={out['avg_soli']} KiSt={out['avg_kist']} GewSt={out['avg_gewst']}")
        print(f"  avg KV={out['avg_kv']} PV={out['avg_pv']} RV={out['avg_rv']} AV={out['avg_av']}")
        print()
    return out


def _main_golden():
    # ---- Isolated tariff table ----
    print("======== TARIFF UNIT TABLE ========")
    for year in (2023, 2024, 2025, 2026):
        print(f"\n-- {year} --")
        p = PARAMS[year]
        points = [
            0, p['gfb'], p['gfb']+1, p['z1_hi'], p['z1_hi']+1,
            D(30000), D(50000), p['z2_hi'], p['z2_hi']+1,
            D(80000), D(100000), D(105246), D(120000),
            p['soli_fg'],  # this is ESt not zve
            D(200000), p['z3_hi'], p['z3_hi']+1, D(400000),
        ]
        # also find zve where ESt just exceeds soli fg
        for x in points:
            est, raw, zone, detail = tariff(d(x), year)
            print(f"  zvE={x:>10}  zone={zone}  raw={raw}  ESt={est}  | {detail}")

        # Splitting examples
        for x in (D(80000), D(160000), D(0)):
            est, half, eh, raw, zone, detail = tariff_splitting(x, year)
            print(f"  SPLIT zve={x} half={half} ESt={est}")

    print("\n\n======== GOLDEN CASES ========\n")

    cases = [
        dict(name="G1 GKV-Mindestbemessung niedriges Einkommen",
             year=2026, gewinn=10000, gewerbe=False),
        dict(name="G2 Gewinn über KV-BBG (und Soli-Milderungszone)",
             year=2026, gewinn=120000, gewerbe=False),
        dict(name="G3 Gewerbe unter Freibetrag",
             year=2026, gewinn=20000, gewerbe=True, hebesatz=400),
        dict(name="G4 Gewerbe über Freibetrag Hebesatz 400%",
             year=2026, gewinn=80000, gewerbe=True, hebesatz=400),
        dict(name="G5 Gewerbe Hebesatz 500% Rest-GewSt",
             year=2026, gewinn=80000, gewerbe=True, hebesatz=500),
        dict(name="G6 Splitting Ehepartner-zvE 0",
             year=2026, gewinn=80000, gewerbe=False, married=True, spouse=0),
        dict(name="G7 Splitting Ehepartner-zvE 40000",
             year=2026, gewinn=80000, gewerbe=False, married=True, spouse=40000),
        dict(name="G8 Kirchensteuer 9% NRW",
             year=2026, gewinn=80000, gewerbe=False, church=D('0.09')),
        dict(name="G9 Drei Kinder PV-Abschlag + Soli-KFB",
             year=2026, gewinn=80000, gewerbe=False, children=3, children_kfb=3, kfb_full=False),
        dict(name="G10 PKV",
             year=2026, gewinn=80000, gewerbe=False, kv_type='pkv',
             pkv_month=700, pkv_basis_month=600, ppv_month=150),
        dict(name="G11 Jahr 2025 Vergleich Freiberufler 80000",
             year=2025, gewinn=80000, gewerbe=False),
        dict(name="G12 GKV allgemein mit Krankengeld 4%-Abschlag",
             year=2026, gewinn=80000, gewerbe=False, kv_type='gkv_allgemein'),
        dict(name="G13 Pflicht-RV einkommensbezogen",
             year=2026, gewinn=80000, gewerbe=False, rv_mode='mandatory'),
        dict(name="G14 Freiberufler 80000 Basis 2026 (Referenz)",
             year=2026, gewinn=80000, gewerbe=False),
        dict(name="G15 Reichensteuer-Zone",
             year=2026, gewinn=400000, gewerbe=False),
        dict(name="G16 Kirchensteuer 8% Bayern",
             year=2026, gewinn=80000, gewerbe=False, church=D('0.08')),
        dict(name="G17 Ein Kind PV 3,6% (kein Zuschlag)",
             year=2026, gewinn=80000, gewerbe=False, children=1, children_kfb=1),
        dict(name="G18 2025 niedriges Einkommen GKV-Min",
             year=2025, gewinn=10000, gewerbe=False),
    ]

    results = {}
    for c in cases:
        r = calculate(c, verbose=True)
        results[c['name']] = r

    # Marginal rate for G14: Gewinn+100
    print("======== MARGINAL G14 ========")
    base = dict(name="G14base", year=2026, gewinn=80000, gewerbe=False)
    plus = dict(name="G14plus", year=2026, gewinn=80100, gewerbe=False)
    rb = calculate(base, verbose=False)
    rp = calculate(plus, verbose=False)
    d_burden = rp['total_burden'] - rb['total_burden']
    d_netto = rb['netto'] - rp['netto']
    print(f"Burden 80k={rb['total_burden']} 80100={rp['total_burden']} delta={d_burden}")
    print(f"Netto 80k={rb['netto']} 80100={rp['netto']} delta={d_netto}")
    print(f"Grenzbelastung={d_burden/100*100}%")

    # Also +1
    plus1 = dict(name="G14plus1", year=2026, gewinn=80001, gewerbe=False)
    rp1 = calculate(plus1, verbose=False)
    print(f"+1 Burden={rp1['total_burden']} delta={rp1['total_burden']-rb['total_burden']}")
    print(f"+1 Netto={rp1['netto']}")


    # ---- Multi-year goldens M1–M4 ----
    print("======== MULTI-YEAR M1–M4 ========")
    def y(year, gewinn=80000, **kw):
        return dict(name=f'{year}-{gewinn}', year=year, gewinn=gewinn, gewerbe=False, **kw)
    calculate_average([y(2024), y(2025), y(2026)], verbose=True)
    calculate_average([y(2023), y(2024), y(2025)], verbose=True)
    calculate_average([
        dict(name='2023-override', year=2023, gewinn=80000, gewerbe=False,
             override_est=18500, override_soli=0, override_kist=0),
        y(2024), y(2025),
    ], verbose=True)
    calculate_average([y(2023, 50000), y(2024, 80000), y(2025, 120000)], verbose=True)


if __name__ == '__main__':
    _main_golden()
