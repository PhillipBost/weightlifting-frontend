
"use client";

import React from "react";
import {
    Ad, Ae, Af, Ag, Ai, Al, Am, Ao, Aq, Ar, As, At, Au, Aw, Ax, Az,
    Ba, Bb, Bd, Be, Bf, Bg, Bh, Bi, Bj, Bl, Bm, Bn, Bo, Bq, Br, Bs, Bt, Bv, Bw, By, Bz,
    Ca, Cc, Cd, Cf, Cg, Ch, Ci, Ck, Cl, Cm, Cn, Co, Cr, Cu, Cv, Cw, Cx, Cy, Cz,
    De, Dj, Dk, Dm, Do, Dz, Ec, Ee, Eg, Er, Es, Et,
    Fi, Fj, Fk, Fm, Fo, Fr, Ga, Gb, Gd, Ge, Gf, Gg, Gh, Gi, Gl, Gm, Gn, Gp, Gq, Gr, Gs, Gt, Gu, Gw, Gy,
    Hk, Hm, Hn, Hr, Ht, Hu, Id, Ie, Im, In, Io, Iq, Ir, Is, It,
    Je, Jm, Jo, Jp, Ke, Kg, Kh, Ki, Km, Kn, Kp, Kr, Kw, Ky, Kz,
    La, Lb, Lc, Li, Lk, Lr, Ls, Lt, Lu, Lv, Ly, Ma, Mc, Md, Me, Mf, Mg, Mh, Mk, Ml, Mm, Mn, Mo, Mp, Mq, Mr, Ms, Mt, Mu, Mv, Mw, Mx, My, Mz,
    Na, Nc, Ne, Nf, Ng, Ni, Nl, No, Np, Nr, Nu, Nz, Om, Pa, Pe, Pf, Pg, Ph, Pk, Pl, Pm, Pn, Pr, Ps, Pt, Pw, Py,
    Qa, Re, Ro, Rs, Ru, Rw, Sa, Sb, Sc, Sd, Se, Sg, Sh, Si, Sj, Sk, Sl, Sm, Sn, So, Sr, Ss, St, Sv, Sx, Sy, Sz,
    Tc, Td, Tf, Tg, Th, Tj, Tk, Tl, Tm, Tn, To, Tr, Tt, Tv, Tw, Tz, Ua, Ug, Um, Us, Uy, Uz,
    Va, Vc, Ve, Vg, Vi, Vn, Vu, Wf, Ws, Xk, Ye, Yt, Za, Zm, Zw,
    GbEng, GbSct, GbWls
} from 'react-flag-icons';

// Custom ROC (Russian Olympic Committee) flag component
export const RocFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <img
        src="/roc-flag.svg"
        alt="ROC"
        style={{ ...style, width: '18px', height: 'auto' }}
    />
);

// Custom Israel flag component
export const IsraelFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <img
        src="/israel-flag.svg"
        alt="Israel"
        style={{ ...style, width: '18px', height: 'auto' }}
    />
);

// Olympic flag component (for neutral athletes: EOR, IOP, IOA, OAR)
export const OlympicFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <img
        src="/Olympic_flag.svg"
        alt="Olympic Neutral"
        style={{ ...style, width: '18px', height: 'auto' }}
    />
);

// ANA (Individual Neutral Athletes) flag component with year detection
export const AnaFlag: React.FC<{ style?: React.CSSProperties; year?: number }> = ({ style, year }) => {
    let flagFile = '/Flag_of_the_Individual_Neutral_Athletes_at_the_2024_Summer_Olympics.svg'; // default to 2024

    if (year) {
        if (year <= 2020) {
            flagFile = '/ANA_flag_(2017).svg';
        } else if (year <= 2023) {
            flagFile = '/ANA_flag_(2021)_WA.svg';
        }
    }

    return (
        <img
            src={flagFile}
            alt="ANA"
            style={{ ...style, width: '18px', height: 'auto' }}
        />
    );
};

// IOC to component mapping (from iwf-lifter-manager.js country codes)
const IOC_MAP: Record<string, React.ComponentType<any> | null> = {
    // European countries (IOC codes)
    'ALB': Al, 'AND': Ad, 'ARM': Am, 'AUT': At, 'AZE': Az, 'BEL': Be, 'BIH': Ba, 'BUL': Bg, 'CRO': Hr, 'CYP': Cy,
    'CZE': Cz, 'DEN': Dk, 'EST': Ee, 'FIN': Fi, 'FRA': Fr, 'GEO': Ge, 'GER': De, 'GRE': Gr, 'GBR': Gb, 'HUN': Hu,
    'ISL': Is, 'IRL': Ie, 'ISR': IsraelFlag, 'ITA': It, 'KOS': Xk, 'LAT': Lv, 'LIE': Li, 'LTU': Lt, 'LUX': Lu, 'MDA': Md, 'MON': Mc,
    'MNE': Me, 'NED': Nl, 'NOR': No, 'POL': Pl, 'POR': Pt, 'ROU': Ro, 'RUS': Ru, 'SMR': Sm, 'SRB': Rs, 'SVK': Sk,
    'SVN': Si, 'ESP': Es, 'SWE': Se, 'SUI': Ch, 'TUR': Tr, 'UKR': Ua,
    // Asian countries (IOC codes)
    'AFG': Af, 'BAN': Bd, 'CAM': Kh, 'CHN': Cn, 'HKG': Hk, 'IND': In, 'IDN': Id, 'IRN': Ir, 'JPN': Jp, 'JOR': Jo,
    'KAZ': Kz, 'KOR': Kr, 'KWT': Kw, 'KGZ': Kg, 'LAO': La, 'LBN': Lb, 'MAS': My, 'MGL': Mn, 'MYA': Mm, 'NEP': Np,
    'PAK': Pk, 'PHI': Ph, 'QAT': Qa, 'SGP': Sg, 'THA': Th, 'TJK': Tj, 'TPE': Tw, 'TKM': Tm, 'UZB': Uz, 'VIE': Vn,
    // Americas (IOC codes)
    'ARG': Ar, 'BAR': Bb, 'BRA': Br, 'CAN': Ca, 'CHI': Cl, 'COL': Co, 'CRC': Cr, 'CUB': Cu, 'DOM': Do, 'ECU': Ec,
    'SLV': Sv, 'GUA': Gt, 'HAI': Ht, 'HND': Hn, 'JAM': Jm, 'MEX': Mx, 'PAN': Pa, 'PAR': Py, 'PER': Pe, 'PUR': Pr,
    'URU': Uy, 'USA': Us, 'VEN': Ve,
    // Oceania (IOC codes)
    'AUS': Au, 'FIJ': Fj, 'NZL': Nz, 'PNG': Pg, 'SAM': Ws, 'TON': To,
    // Africa (IOC codes)
    'ALG': Dz, 'ANG': Ao, 'BOT': Bw, 'BWA': Bw, 'CMR': Cm, 'EGY': Eg, 'ETH': Et, 'GHA': Gh, 'KEN': Ke, 'LIB': Ly,
    'MAR': Ma, 'MRI': Mu, 'MOZ': Mz, 'NAM': Na, 'NGA': Ng, 'RWA': Rw, 'RSA': Za, 'SUD': Sd, 'TAN': Tz, 'TUN': Tn,
    'UGA': Ug, 'ZIM': Zw,
    // Special/Neutral codes
    'AIN': AnaFlag, 'ANA': AnaFlag, 'EOR': OlympicFlag, 'IOP': OlympicFlag, 'OAR': OlympicFlag, 'VAN': Vu, 'WRT': OlympicFlag, 'KUW': Kw, 'MLT': Mt, 'INA': Id, 'BRN': Bn, 'UAE': Ae, 'TGA': To, 'PRK': Kp,
    'PLE': Ps, 'NMI': Mp, 'NGR': Ng, 'KSA': Sa, 'IRI': Ir, 'ARU': Aw, 'ASA': As, 'BDI': Bi, 'BLR': By, 'BOL': Bo,
    'BRU': Bn, 'CGO': Cg, 'COD': Cd, 'COK': Ck, 'COM': Km, 'CPV': Cv, 'CUR': Cw, 'ENG': GbEng, 'ESA': Sv, 'FSM': Fm,
    'GAM': Gm, 'GEQ': Gq, 'GIB': Gi, 'GUI': Gn, 'GUM': Gu, 'GUY': Gy, 'HON': Hn, 'IOA': OlympicFlag, 'IRQ': Iq, 'KIR': Ki,
    'KRI': Ki, 'LBA': Ly, 'LBR': Lr, 'LES': Ls, 'MAC': Mo, 'MAD': Mg, 'MAW': Mw, 'MHL': Mh, 'MTN': Mr, 'NCA': Ni,
    'NCL': Nc, 'NIC': Ni, 'NIR': GbWls, 'NIU': Nu, 'NRU': Nr, 'OMA': Om, 'PLW': Pw, 'ROC': RocFlag, 'RWF': null, 'SCO': GbSct,
    'SEN': Sn, 'SEY': Sc, 'SLE': Sl, 'SLO': Si, 'SOL': Sb, 'SRI': Lk, 'SWZ': Sz, 'SYR': Sy, 'TAH': Pf, 'TCA': Tc,
    'TLS': Tl, 'TTO': Tt, 'TUV': Tv, 'VIN': Vc, 'WAL': GbWls, 'WLF': Wf, 'YEM': Ye, 'ZAM': Zm, 'ZAN': Tz,
    // Also support ISO 2-letter codes directly
    'AD': Ad, 'AE': Ae, 'AF': Af, 'AG': Ag, 'AI': Ai, 'AL': Al, 'AM': Am, 'AO': Ao, 'AQ': Aq, 'AR': Ar, 'AS': As, 'AT': At,
    'AU': Au, 'AW': Aw, 'AX': Ax, 'AZ': Az, 'BA': Ba, 'BB': Bb, 'BD': Bd, 'BE': Be, 'BF': Bf, 'BG': Bg, 'BH': Bh, 'BI': Bi,
    'BJ': Bj, 'BL': Bl, 'BM': Bm, 'BN': Bn, 'BO': Bo, 'BQ': Bq, 'BR': Br, 'BS': Bs, 'BT': Bt, 'BV': Bv, 'BW': Bw, 'BY': By,
    'BZ': Bz, 'CA': Ca, 'CC': Cc, 'CD': Cd, 'CF': Cf, 'CG': Cg, 'CH': Ch, 'CI': Ci, 'CK': Ck, 'CL': Cl, 'CM': Cm, 'CN': Cn,
    'CO': Co, 'CR': Cr, 'CU': Cu, 'CV': Cv, 'CW': Cw, 'CX': Cx, 'CY': Cy, 'CZ': Cz, 'DE': De, 'DJ': Dj, 'DK': Dk, 'DM': Dm,
    'DO': Do, 'DZ': Dz, 'EC': Ec, 'EE': Ee, 'EG': Eg, 'ER': Er, 'ES': Es, 'ET': Et, 'FI': Fi, 'FJ': Fj, 'FK': Fk,
    'FM': Fm, 'FO': Fo, 'FR': Fr, 'GA': Ga, 'GB': Gb, 'GD': Gd, 'GE': Ge, 'GF': Gf, 'GG': Gg, 'GH': Gh, 'GI': Gi, 'GL': Gl,
    'GM': Gm, 'GN': Gn, 'GP': Gp, 'GQ': Gq, 'GR': Gr, 'GS': Gs, 'GT': Gt, 'GU': Gu, 'GW': Gw, 'GY': Gy, 'HK': Hk, 'HM': Hm,
    'HN': Hn, 'HR': Hr, 'HT': Ht, 'HU': Hu, 'ID': Id, 'IE': Ie, 'IL': IsraelFlag, 'IM': Im, 'IN': In, 'IO': Io, 'IQ': Iq, 'IR': Ir,
    'IS': Is, 'IT': It, 'JE': Je, 'JM': Jm, 'JO': Jo, 'JP': Jp, 'KE': Ke, 'KG': Kg, 'KH': Kh, 'KI': Ki, 'KM': Km, 'KN': Kn,
    'KP': Kp, 'KR': Kr, 'KW': Kw, 'KY': Ky, 'KZ': Kz, 'XK': Xk, 'LA': La, 'LB': Lb, 'LC': Lc, 'LI': Li, 'LK': Lk, 'LR': Lr, 'LS': Ls,
    'LT': Lt, 'LU': Lu, 'LV': Lv, 'LY': Ly, 'MA': Ma, 'MC': Mc, 'MD': Md, 'ME': Me, 'MF': Mf, 'MG': Mg, 'MH': Mh, 'MK': Mk,
    'ML': Ml, 'MM': Mm, 'MN': Mn, 'MO': Mo, 'MP': Mp, 'MQ': Mq, 'MR': Mr, 'MS': Ms, 'MT': Mt, 'MU': Mu, 'MV': Mv, 'MW': Mw,
    'MX': Mx, 'MY': My, 'MZ': Mz, 'NA': Na, 'NC': Nc, 'NE': Ne, 'NF': Nf, 'NG': Ng, 'NI': Ni, 'NL': Nl, 'NO': No, 'NP': Np,
    'NR': Nr, 'NU': Nu, 'NZ': Nz, 'OM': Om, 'PA': Pa, 'PE': Pe, 'PF': Pf, 'PG': Pg, 'PH': Ph, 'PK': Pk, 'PL': Pl, 'PM': Pm,
    'PN': Pn, 'PR': Pr, 'PS': Ps, 'PT': Pt, 'PW': Pw, 'PY': Py, 'QA': Qa, 'RE': Re, 'RO': Ro, 'RS': Rs,
    'RU': Ru, 'RW': Rw, 'SA': Sa, 'SB': Sb, 'SC': Sc, 'SD': Sd, 'SE': Se, 'SG': Sg, 'SH': Sh, 'SI': Si, 'SJ': Sj, 'SK': Sk, 'SL': Sl,
    'SM': Sm, 'SN': Sn, 'SO': So, 'SR': Sr, 'SS': Ss, 'ST': St, 'SV': Sv, 'SX': Sx, 'SY': Sy, 'SZ': Sz, 'TC': Tc, 'TD': Td, 'TF': Tf,
    'TG': Tg, 'TH': Th, 'TJ': Tj, 'TK': Tk, 'TL': Tl, 'TM': Tm, 'TN': Tn, 'TO': To, 'TR': Tr, 'TT': Tt, 'TV': Tv, 'TW': Tw, 'TZ': Tz,
    'UA': Ua, 'UG': Ug, 'UM': Um, 'US': Us, 'UY': Uy, 'UZ': Uz, 'VA': Va, 'VC': Vc, 'VE': Ve, 'VG': Vg, 'VI': Vi, 'VN': Vn, 'VU': Vu,
    'WF': Wf, 'WS': Ws, 'YE': Ye, 'YT': Yt, 'ZA': Za, 'ZM': Zm, 'ZW': Zw
};

export const getCountryFlagComponent = (code: string): React.ComponentType<any> | null => {
    if (!code) return null;
    return IOC_MAP[code] || null;
};
