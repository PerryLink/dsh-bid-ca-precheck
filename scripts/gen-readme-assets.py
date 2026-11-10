#!/usr/bin/env python3
"""README visuals for dsh-bid-ca-precheck, drawn from the shipped material.

Two figures, both following this plugin's real pipeline rather than a template:

  hero 1440x576 (Pillow, 4 files: zh/en x light/dark)
      The register itself (project / bidder header, three rows, the blank
      response cell, the repeated clause number, the unreplaced placeholder),
      then the six-rule checklist with its two default-skipped rules, then one
      located finding card (BC-001, row 1, response: found / expected / fix) and
      the report line that keeps the verdict with the reviewer.

  flow 1100x660 (hand-written SVG, 2 files: light/dark)
      A clause cross-reference, not a left-to-right pipeline: six rows, each
      pairing what the register says in one column (left page) with the rule
      that reads that column and what it decided (right page). The two output
      channels issues[] and skipped[] leave the sheet and both reach the
      reviewer.

Every value in the figures comes from the repository itself:
  samples/quickstart/input/BC-001-unsafe.json      project, bidder, row 1
  tests/fixtures/BC-002/BC-002-unsafe.json         verdict 基本合格
  tests/fixtures/BC-003/BC-003-unsafe.json         clause 2.1 twice
  tests/fixtures/BC-004/BC-004-unsafe.json         header project/bidder absent
  tests/fixtures/BC-005/BC-005-unsafe.json         blank evidence, 资格 requirement
  tests/fixtures/BC-006/BC-006-unsafe.json         【填写资质等级】 placeholder
  README.md                                        row 3 (2.2, two comparable projects)
  rules/bid-ca-precheck.yaml                       rule ids, kinds, severities, terms
  src/shared/rows.ts                               skip reasons quoted on the sheet

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow + Windows fonts msyh.ttc / msyhbd.ttc / consola.ttf.
Only these assets are written; the older flow/hero/demo files are left alone
for external deep links, and the five READMEs reference only the new pair.
"""
from __future__ import annotations

import math
import os
from html import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_CJK = r"C:\Windows\Fonts\msyh.ttc"
FONT_CJK_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"
FONT_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
for _p in (FONT_CJK, FONT_CJK_BOLD, FONT_MONO, FONT_MONO_BOLD):
    if not os.path.exists(_p):
        raise SystemExit(f"FATAL: font missing: {_p}")

RADIUS = 22
SHADOW = 26

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        card="#ffffff", card_edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", accent2="#16a34a",
        pill="#ece7f9", band="#f5f2fb", grid="#e7e4f0",
        mark="#b45309", mark_bg="#fdf3e9",
        shadow=(32, 26, 64), glow2="#7a68c9",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        card="#1b2231", card_edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", accent2="#3fb950",
        pill="#242d42", band="#202839", grid="#262f42",
        mark="#d9a441", mark_bg="#2a2216",
        shadow=(0, 0, 0), glow2="#8496f5",
    ),
}

FONT_FILES = {"cjk": FONT_CJK, "cjk_bold": FONT_CJK_BOLD,
              "mono": FONT_MONO, "mono_bold": FONT_MONO_BOLD}


def font(size: int, kind: str = "cjk_bold") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_FILES[kind], size)


def hx(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w: int, h: int, c1: str, c2: str) -> Image.Image:
    base = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(base)
    a, b = hx(c1), hx(c2)
    for y in range(h):
        t = 0.15 * (y / h) + 0.85 * (y / h) ** 1.35
        d.line([(0, y), (w, y)],
               fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return base


def glow(img: Image.Image, cx: int, cy: int, r: int, color: tuple,
         alpha: int = 40) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(9, 0, -1):
        rr = r * i / 9
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=color + (int(alpha * (1 - i / 10)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img: Image.Image, box: tuple, s: dict, radius: int = RADIUS,
         shadow: int = SHADOW, fill: str | None = None) -> Image.Image:
    """A soft-shadowed rounded card on the gradient background."""
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle([x0 - i // 5, y0 + i // 2, x1 + i // 5, y1 + i],
                             radius=radius + i // 5,
                             fill=s["shadow"] + (int(9 * (1 - i / shadow)),))
    base = Image.alpha_composite(img.convert("RGBA"),
                                 sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(fill or s["card"]),
                        outline=hx(s["card_edge"]), width=2)
    return base.convert("RGB")


_SCRATCH = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def measure(text: str, size: int, kind: str) -> float:
    return _SCRATCH.textlength(text, font=font(size, kind))


def require_w(text: str, size: int, kind: str, max_w: float, what: str) -> None:
    """Fail loudly instead of shipping a clipped label."""
    w = measure(text, size, kind)
    if w > max_w + 0.4:
        raise SystemExit(
            f"FATAL: {what} overflows: {text!r} needs {w:.1f}px > {max_w}px")


def fit(text: str, kind: str, max_w: float, start: int, minimum: int) -> int:
    size = start
    while size > minimum:
        if measure(text, size, kind) <= max_w:
            return size
        size -= 1
    raise SystemExit(
        f"FATAL: text does not fit {max_w}px at >= {minimum}px: {text!r}")


def fit_lines(lines: list[str], kind: str, max_w: float, start: int,
              minimum: int) -> int:
    return min(fit(t, kind, max_w, start, minimum) for t in lines)


def wrap(text: str, size: int, kind: str, maxw: float) -> list[str]:
    """Word-wrap ASCII text, character-wrap CJK text."""
    f = font(size, kind)
    if " " in text and any(ord(c) < 0x2E80 for c in text):
        words, lines, cur = text.split(" "), [], ""
        for wd in words:
            cand = (cur + " " + wd) if cur else wd
            if _SCRATCH.textlength(cand, font=f) <= maxw or not cur:
                cur = cand
            else:
                lines.append(cur)
                cur = wd
        if cur:
            lines.append(cur)
        return lines
    lines, cur = [], ""
    for ch in text:
        if _SCRATCH.textlength(cur + ch, font=f) <= maxw or not cur:
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def pill(img: Image.Image, xy: tuple[int, int], text: str, s: dict,
         size: int = 16, fg: str | None = None, bg: str | None = None,
         kind: str = "cjk_bold") -> tuple[int, int]:
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    w = d.textlength(text, font=f)
    x, y = xy
    h = size + 20
    d.rounded_rectangle([x, y, x + w + 30, y + h], radius=h // 2,
                        fill=hx(bg or s["pill"]))
    d.text((x + 15, y + h / 2), text, font=f, fill=hx(fg or s["accent"]),
           anchor="lm")
    return int(x + w + 30), int(y + h)


def chip(img: Image.Image, xy: tuple[int, int], text: str, fg: str, bg: str,
         size: int = 11, kind: str = "cjk_bold", padx: int = 9,
         height: int = 20) -> int:
    """Draw a chip at (x, y); returns its full width."""
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    w = d.textlength(text, font=f)
    x, y = xy
    d.rounded_rectangle([x, y, x + w + padx * 2, y + height],
                        radius=height // 2, fill=hx(bg))
    d.text((x + padx, y + height / 2), text, font=f, fill=hx(fg), anchor="lm")
    return int(w + padx * 2)


def dash_rect(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int],
              color: str, width: int = 2, dash: int = 7, gap: int = 5) -> None:
    x0, y0, x1, y1 = box
    for a, b in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)),
                 ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        n = int(dist // (dash + gap)) + 1
        for i in range(n):
            t0 = i * (dash + gap) / dist
            t1 = min((i * (dash + gap) + dash) / dist, 1.0)
            if t0 >= 1:
                break
            d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                    (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)],
                   fill=hx(color), width=width)


# --------------------------------------------------------------------------- hero
# Every value is an excerpt of a fixture or of the quickstart sample; see the
# module docstring for the row-by-row mapping. Wrapping never rewrites a cell.
HERO = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · 台账核查器",
        value=["六条规则逐条对照台账", "差异落到行号与栏名"],
        sub="只列差异，不判合规——结论留给评标委员会。",
        meta="BC-001..BC-006 · 规则包即数据 · skipped 逐条说明",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        doc=dict(
            box=(700, 40, 1128, 344),
            title="投标符合性响应台账 · rows[]",
            chip="只读",
            header="某某厂房工程 · 某某建设有限公司",
            cols=[(52, "条款号"), (200, "招标要求"), (140, "投标响应")],
            rows=[
                dict(cells=["2.1", "投标人应具有建筑工程施工总承包二级及以上资质",
                            ""], blank=2),
                dict(cells=["2.1", "投标人应具有【填写资质等级】资质",
                            "已提供资质证书复印件，等级为二级"],
                     dup=True, span="【填写资质等级】"),
                dict(cells=["2.2", "近三年至少完成两项同类业绩",
                            "已提供合同及验收证明"]),
            ],
            note1="列名忽略大小写、空格与下划线；原件永不修改",
            note2="示例行取自 samples、README 示例与 tests/fixtures",
        ),
        rules=dict(
            box=(1144, 40, 1376, 344),
            title="规则清单",
            chip="6 条",
            note="跳过 = 清单未配置",
            rows=[("BC-001", "响应栏", True),
                  ("BC-002", "结论取值", False),
                  ("BC-003", "条款号", True),
                  ("BC-004", "项目 / 投标人", True),
                  ("BC-005", "证明材料", False),
                  ("BC-006", "占位符", True)],
            on="执行", off="跳过",
        ),
        issue=dict(box=(700, 358, 1376, 486),
                   rule="BC-001", sev="warn",
                   locator="第 1 行 · response",
                   labels=["发现", "应填", "建议"],
                   found="「投标响应」为空",
                   expected="「投标响应」应填写",
                   fix="补填；不判断是否实质性满足",
                   note="locator = 行号 + 栏名；fix 只给动作，不给结论"),
        strip=dict(box=(700, 502, 1376, 542),
                   left="issues[] 3 条 · skipped[] 2 条",
                   right="结论留给评标委员会"),
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · register checker",
        value=["Six rules, one register", "each difference has a cell"],
        sub="No compliance verdict — the committee decides.",
        meta="BC-001..BC-006 · the rule pack is data · skipped is explained",
        foot="Apache-2.0 · PerryLink DSH plugin family",
        doc=dict(
            box=(700, 40, 1150, 344),
            title="Bid compliance register · rows[]",
            chip="read-only",
            header="Some Plant Project · Some Construction Co., Ltd.",
            cols=[(50, "Clause"), (250, "Requirement"), (114, "Response")],
            rows=[
                dict(cells=["2.1",
                            "Bidder holds a Grade-2 construction licence or above",
                            ""], blank=2),
                dict(cells=["2.1", "Bidder holds a licence of grade {{grade}}",
                            "Licence copy (Grade 2)"],
                     dup=True, span="{{grade}}"),
                dict(cells=["2.2",
                            "At least two comparable projects in three years",
                            "Contracts + acceptance"]),
            ],
            note1="Column names ignore case and spaces; the original is never modified",
            note2="Illustrative English register; the tool also reads Chinese column names",
        ),
        rules=dict(
            box=(1166, 40, 1376, 344),
            title="Rule checklist",
            chip="6",
            note="skip = list not configured",
            rows=[("BC-001", "response", True),
                  ("BC-002", "verdict", False),
                  ("BC-003", "clause", True),
                  ("BC-004", "header", True),
                  ("BC-005", "evidence", False),
                  ("BC-006", "template", True)],
            on="run", off="skip",
        ),
        issue=dict(box=(700, 358, 1376, 486),
                   rule="BC-001", sev="warn",
                   locator="Row 1 · response",
                   labels=["Found", "Expected", "Fix"],
                   found="response is blank",
                   expected="response must be filled",
                   fix="fill it in; no verdict here",
                   note="locator = row + column; fix is an action, not a verdict"),
        strip=dict(box=(700, 502, 1376, 542),
                   left="issues[] 3 · skipped[] 2",
                   right="verdict stays with the committee"),
    ),
}


def hero(lang: str, skin: str) -> None:
    s = SKIN[skin]
    H = HERO[lang]
    W, HT = 1440, 576
    img = gradient(W, HT, s["bg_from"], s["bg_to"])
    img = glow(img, 1180, 24, 430, hx(s["accent"]),
               24 if skin == "light" else 38)
    img = glow(img, 90, 586, 300, hx(s["glow2"]),
               10 if skin == "light" else 16)

    m = 64
    col_w = 596

    # ---- left column: kicker / title / two value lines / sub / meta / footer --
    pill(img, (m, 56), H["kicker"], s, size=17)
    d = ImageDraw.Draw(img)

    title = "dsh-bid-ca-precheck"
    title_size = fit(title, "mono_bold", col_w, 58, 48)
    d.text((m - 2, 126), title, font=font(title_size, "mono_bold"),
           fill=hx(s["text"]))

    vf = fit_lines(H["value"], "cjk_bold", col_w, 42, 32)
    for i, line in enumerate(H["value"]):
        d.text((m, 226 + i * 56), line, font=font(vf, "cjk_bold"),
               fill=hx(s["text"]))

    require_w(H["sub"], 22, "cjk", col_w, "hero sub")
    d.text((m, 362), H["sub"], font=font(22, "cjk"), fill=hx(s["sub"]))

    require_w(H["meta"], 19, "cjk", col_w, "hero meta")
    require_w(H["foot"], 16, "cjk", col_w, "hero footer")
    d.text((m + 1, 418), H["meta"], font=font(19, "cjk"), fill=hx(s["faint"]))
    d.line([m + 1, 466, m + col_w - 4, 466], fill=hx(s["grid"]), width=2)
    d.text((m + 1, 480), H["foot"], font=font(16, "cjk"), fill=hx(s["faint"]))

    # ---- right: the register excerpt ----------------------------------------
    D = H["doc"]
    x0, y0, x1, y1 = D["box"]
    img = card(img, D["box"], s, radius=RADIUS, shadow=SHADOW)
    d = ImageDraw.Draw(img)
    d.text((x0 + 18, y0 + 16), D["title"], font=font(15, "cjk_bold"),
           fill=hx(s["accent"]))
    cw = measure(D["chip"], 11, "cjk")
    chip(img, (x1 - 18 - int(cw) - 18, y0 + 10), D["chip"], s["accent"],
         s["pill"], size=11)
    d = ImageDraw.Draw(img)
    require_w(D["header"], 12, "cjk", x1 - x0 - 40, "register header")
    d.text((x0 + 18, y0 + 46), D["header"], font=font(12, "cjk"),
           fill=hx(s["sub"]))

    cols_x, acc = [], x0 + 18
    for width, _label in D["cols"]:
        cols_x.append(acc)
        acc += width
    table_top = y0 + 64
    d.rounded_rectangle([x0 + 10, table_top, x1 - 10, table_top + 22],
                        radius=9, fill=hx(s["band"]))
    for i, (_w, label) in enumerate(D["cols"]):
        require_w(label, 11, "cjk_bold", D["cols"][i][0] - 14, "table header")
        d.text((cols_x[i] + 6, table_top + 5), label,
               font=font(11, "cjk_bold"), fill=hx(s["sub"]))

    line_h = 15
    wrapped_rows = []
    for row in D["rows"]:
        wrapped = []
        for i, value in enumerate(row["cells"]):
            if value == "":
                wrapped.append(["（空）" if lang == "zh" else "—"])
            else:
                wrapped.append(wrap(value, 11, "cjk", D["cols"][i][0] - 12))
        wrapped_rows.append(wrapped)

    ry = table_top + 22
    for r, (row, wrapped) in enumerate(zip(D["rows"], wrapped_rows)):
        n = max(len(lines) for lines in wrapped)
        row_h = max(44, n * line_h + 20)
        if ry + row_h > y1 - 34:
            raise SystemExit(f"FATAL: hero register rows overflow the card "
                             f"(row {r + 1})")
        for i, lines in enumerate(wrapped):
            cx = cols_x[i]
            cell_w = D["cols"][i][0]
            is_blank = row.get("blank") == i
            is_dup = bool(row.get("dup")) and i == 0
            if is_blank:
                cell = (cx + 1, ry + 4, cx + cell_w - 8, ry + row_h - 4)
                d.rounded_rectangle(cell, radius=9, fill=hx(s["mark_bg"]))
                dash_rect(d, cell, s["mark"], width=2, dash=7, gap=4)
            if is_dup:
                tw = measure(row["cells"][i], 11, "cjk")
                d.rounded_rectangle([cx - 1, ry + 7, cx + tw + 9,
                                     ry + 31], radius=8,
                                    fill=hx(s["mark_bg"]))
            span = row.get("span")
            if span and i == 1 and len(lines) == 1 and span in lines[0]:
                pre = lines[0].split(span)[0]
                sw = measure(span, 11, "cjk")
                px = cx + 4 + measure(pre, 11, "cjk")
                d.rounded_rectangle([px - 2, ry + 6, px + sw + 2,
                                     ry + 26], radius=5,
                                    fill=hx(s["mark_bg"]))
                d.rectangle([px - 2, ry + 26, px + sw + 2, ry + 28],
                            fill=hx(s["mark"]))
            for j, line in enumerate(lines):
                fill = s["text"]
                if is_blank or is_dup:
                    fill = s["mark"]
                require_w(line, 11, "cjk", cell_w - 12, "table cell")
                text_x = cx + (8 if is_blank else 4)
                d.text((text_x, ry + 9 + j * line_h), line,
                       font=font(11, "cjk"), fill=hx(fill))
        ry += row_h
        if r < len(D["rows"]) - 1:
            d.line([x0 + 18, ry, x1 - 18, ry], fill=hx(s["grid"]), width=1)

    require_w(D["note1"], 11.5, "cjk", x1 - x0 - 36, "register note 1")
    require_w(D["note2"], 11.5, "cjk", x1 - x0 - 36, "register note 2")
    d.text((x0 + 18, y1 - 50), D["note1"], font=font(11.5, "cjk"),
           fill=hx(s["faint"]))
    d.text((x0 + 18, y1 - 32), D["note2"], font=font(11.5, "cjk"),
           fill=hx(s["faint"]))

    # ---- right: the six-rule checklist --------------------------------------
    R = H["rules"]
    rx0, ry0, rx1, ry1 = R["box"]
    img = card(img, R["box"], s, radius=RADIUS, shadow=SHADOW)
    d = ImageDraw.Draw(img)
    d.text((rx0 + 18, ry0 + 16), R["title"], font=font(15, "cjk_bold"),
           fill=hx(s["accent"]))
    cw = measure(R["chip"], 11, "cjk")
    chip(img, (rx1 - 18 - int(cw) - 18, ry0 + 11), R["chip"], s["faint"],
         s["pill"], size=11)
    d = ImageDraw.Draw(img)

    top = ry0 + 48
    step = 38
    for i, (rid, label, ran) in enumerate(R["rows"]):
        cy = top + i * step
        if i > 0:
            d.line([rx0 + 18, cy, rx1 - 18, cy], fill=hx(s["grid"]), width=1)
        dot_y = cy + 20
        if ran:
            d.ellipse([rx0 + 20, dot_y - 4, rx0 + 28, dot_y + 4],
                      fill=hx(s["accent"]))
        else:
            d.ellipse([rx0 + 20, dot_y - 4, rx0 + 28, dot_y + 4],
                      fill=hx(s["card"]), outline=hx(s["mark"]), width=2)
        d.text((rx0 + 36, cy + 11), rid, font=font(11.5, "mono_bold"),
               fill=hx(s["text"]))
        require_w(label, 10.5, "cjk", rx1 - rx0 - 128, "checklist label")
        d.text((rx0 + 88, cy + 12), label, font=font(10.5, "cjk"),
               fill=hx(s["sub"]))
        status = R["on"] if ran else R["off"]
        sw = measure(status, 10.5, "cjk")
        d.text((rx1 - 18 - sw, cy + 12), status, font=font(10.5, "cjk"),
               fill=hx(s["sub"] if ran else s["mark"]))
    require_w(R["note"], 10.5, "cjk", rx1 - rx0 - 36, "checklist note")
    d.text((rx0 + 18, ry1 - 24), R["note"], font=font(10.5, "cjk"),
           fill=hx(s["faint"]))

    # ---- right: one located finding -----------------------------------------
    I = H["issue"]
    ix0, iy0, ix1, iy1 = I["box"]
    img = card(img, I["box"], s, radius=18, shadow=22)
    d = ImageDraw.Draw(img)
    d.text((ix0 + 20, iy0 + 18), I["rule"], font=font(13.5, "mono_bold"),
           fill=hx(s["accent"]))
    rw = measure(I["rule"], 13.5, "mono_bold")
    chip(img, (ix0 + 20 + int(rw) + 8, iy0 + 13), I["sev"], s["accent"],
         s["pill"], size=10)
    d = ImageDraw.Draw(img)
    lw = measure(I["locator"], 11, "cjk")
    d.text((ix1 - 20 - lw, iy0 + 16), I["locator"], font=font(11, "cjk"),
           fill=hx(s["sub"]))

    cols = [ix0 + 20, ix0 + 250, ix0 + 460]
    widths = [210, 190, 196]
    for i, lab in enumerate(I["labels"]):
        value = [I["found"], I["expected"], I["fix"]][i]
        d.text((cols[i], iy0 + 48), lab, font=font(10.5, "cjk"),
               fill=hx(s["faint"]))
        require_w(value, 12, "cjk", widths[i], "issue value")
        d.text((cols[i], iy0 + 66), value, font=font(12, "cjk"),
               fill=hx(s["text"]))
    require_w(I["note"], 10.5, "cjk", ix1 - ix0 - 40, "issue note")
    d.text((ix0 + 20, iy0 + 98), I["note"], font=font(10.5, "cjk"),
           fill=hx(s["faint"]))

    # ---- right: the report line ---------------------------------------------
    S = H["strip"]
    sx0, sy0, sx1, sy1 = S["box"]
    img = card(img, S["box"], s, radius=18, shadow=16)
    d = ImageDraw.Draw(img)
    require_w(S["left"], 13, "cjk", 560, "report strip")
    d.text((sx0 + 20, sy0 + 15), S["left"], font=font(13, "cjk"),
           fill=hx(s["text"]))
    tw = measure(S["right"], 13, "cjk_bold")
    d.text((sx1 - 20 - tw, sy0 + 15), S["right"], font=font(13, "cjk_bold"),
           fill=hx(s["accent2"]))

    name = f"dsh-bid-ca-precheck-hero-{lang}-{skin}.webp"
    img.save(os.path.join(OUT, name), "WEBP", quality=92, method=6)
    print(f"wrote {name} ({W}x{HT})")


# --------------------------------------------------------------------------- flow
FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        panel="#ffffff", edge="#e6e2ef", band="#f5f2fb", band_alt="#faf8fe",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", accent2="#16a34a", rule="#dcd8ea",
        card="#ffffff", shadow="0.10", mark="#b45309", mark_bg="#fdf3e9",
        pill="#ece7f9",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        panel="#1b2231", edge="#2e374b", band="#202839", band_alt="#1e2534",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", accent2="#3fb950", rule="#2b3348",
        card="#1b2231", shadow="0.45", mark="#d9a441", mark_bg="#2a2216",
        pill="#242d42",
    ),
}

FONT_CSS_CJK = ("'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',"
                "'Source Han Sans SC',sans-serif")
FONT_CSS_MONO = "'Consolas','SFMono-Regular','Menlo',ui-monospace,monospace"

# id, basis kind, result, locator/reason, what the rule checks, the register
# column it reads, that column's Chinese name, the fixture value, and the part
# of the value this rule points at (underlined).
FLOW_ROWS = [
    dict(rule="BC-001", kind="direct", result="warn",
         where="第 1 行 · response",
         check="每条招标要求都有记录在案的响应",
         field="response", label="投标响应", value="（空）", tone="mark"),
    dict(rule="BC-002", kind="local", result="skipped",
         where="values 未配置",
         check="结论取值须来自你配置的清单",
         field="verdict", label="响应结论", value="基本合格", tone="text"),
    dict(rule="BC-003", kind="principle", result="warn",
         where="第 2 行 · clause",
         check="条款号在台账内唯一",
         field="clause", label="条款号", value="2.1 · 2.1（重复）",
         tone="text", span="（重复）"),
    dict(rule="BC-004", kind="principle", result="warn",
         where="表头 · project",
         check="台账声明了项目与投标人",
         field="project / bidder", label="表头", value="两栏都缺", tone="mark"),
    dict(rule="BC-005", kind="direct", result="skipped",
         where="highRiskKeywords 未配置",
         check="高风险条款须填证明材料",
         field="evidence", label="证明材料", value="（空）", tone="mark"),
    dict(rule="BC-006", kind="principle", result="warn",
         where="第 1 行 · requirement",
         check="招标要求栏不残留占位符",
         field="requirement", label="招标要求",
         value="投标人应具有【填写资质等级】资质", tone="text",
         span="【填写资质等级】"),
]


class Svg:
    """Tiny SVG writer that measures every label before it is emitted."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.overflows: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def text(self, x: float, y: float, content: str, size: float, fill: str, *,
             anchor: str = "start", weight: int | None = None,
             mono: bool = False, max_w: float | None = None,
             opacity: float | None = None) -> float:
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        if max_w is not None:
            w = measure(content, size, kind)
            if w > max_w + 0.4:
                self.overflows.append(
                    f"{content!r} needs {w:.1f}px > {max_w}px")
        family = FONT_CSS_MONO if mono else FONT_CSS_CJK
        attrs = [f'x="{x}"', f'y="{y}"', f'fill="{fill}"',
                 f'font-family="{family}"', f'font-size="{size}"']
        if anchor != "start":
            attrs.append(f'text-anchor="{anchor}"')
        if weight:
            attrs.append(f'font-weight="{weight}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<text {" ".join(attrs)}>{escape(content)}</text>')
        return measure(content, size, kind)

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str,
             rx: float = 0, stroke: str | None = None, sw: float = 1.5,
             shadow: bool = False, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"']
        if rx:
            attrs.append(f'rx="{rx}"')
        attrs.append(f'fill="{fill}"')
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{sw}"')
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if shadow:
            attrs.append('filter="url(#soft)"')
        self.add(f'<rect {" ".join(attrs)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str,
             sw: float = 1.5, dash: str | None = None,
             marker: str | None = None, opacity: float | None = None) -> None:
        attrs = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"',
                 f'stroke="{stroke}"', f'stroke-width="{sw}"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<line {" ".join(attrs)}/>')

    def path(self, d: str, *, stroke: str, sw: float = 1.5,
             marker: str | None = None, dash: str | None = None,
             fill: str = "none") -> None:
        attrs = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"',
                 f'stroke-width="{sw}"', 'stroke-linecap="round"',
                 'stroke-linejoin="round"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        self.add(f'<path {" ".join(attrs)}/>')

    def chip(self, x: float, y: float, label: str, fg: str, bg: str, *,
             size: float = 10.5, pad: float = 9, height: float = 19,
             mono: bool = False, weight: int | None = None) -> float:
        """Draw a pill anchored on its left edge; also returns its width."""
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        w = measure(label, size, kind) + pad * 2
        self.rect(x, y, w, height, fill=bg, rx=height / 2)
        self.text(x + pad, y + height / 2 + size * 0.34, label, size, fg,
                  weight=weight, mono=mono)
        return w

    def svg(self, w: int, h: int, title: str, desc: str) -> str:
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" '
                f'height="{h}" viewBox="0 0 {w} {h}" role="img" '
                f'aria-labelledby="fig-title fig-desc">')
        return "\n".join([
            head,
            f'<title id="fig-title">{escape(title)}</title>',
            f'<desc id="fig-desc">{escape(desc)}</desc>',
            *self.parts, "</svg>",
        ]) + "\n"


def flow_svg(skin: str) -> str:
    s = FLOW[skin]
    W, H = 1100, 660
    v = Svg()

    v.add("<defs>")
    v.add(f'<linearGradient id="bg" x1="0" y1="0" x2="0.32" y2="1">'
          f'<stop offset="0" stop-color="{s["bg_from"]}"/>'
          f'<stop offset="1" stop-color="{s["bg_to"]}"/></linearGradient>')
    v.add(f'<filter id="soft" x="-30%" y="-30%" width="160%" height="170%">'
          f'<feDropShadow dx="0" dy="7" stdDeviation="9" '
          f'flood-color="#16122c" flood-opacity="{s["shadow"]}"/></filter>')
    v.add('<marker id="arr" viewBox="0 0 10 10" refX="8.6" refY="5" '
          'markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">'
          f'<path d="M0 1.6 L9 5 L0 8.4 z" fill="{s["accent"]}"/></marker>')
    v.add("</defs>")
    v.add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')

    # ---- header -------------------------------------------------------------
    v.text(44, 58, "dsh-bid-ca-precheck", 28, s["text"], weight=700, mono=True,
           max_w=620)
    v.text(44, 86,
           "bid_ca_precheck 读一份台账：六条规则各对照一栏；命中回到行号与栏名，"
           "未执行的进 skipped[]。",
           15, s["sub"], max_w=812)
    v.chip(946, 36, "规则包 2026.1 · 6 条", s["accent"], s["band"],
           size=12, pad=12, height=26)

    # ---- the clause cross-reference sheet -----------------------------------
    v.rect(44, 104, 1012, 362, fill=s["panel"], rx=20, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.line(560, 136, 560, 452, stroke=s["edge"], sw=1.2, dash="5 6",
           opacity=0.95)
    v.text(62, 126, "台账 · 按列名归一（JSON / YAML，只读）", 12, s["faint"],
           max_w=440)
    v.text(578, 126, "规则 · 读哪一栏", 12, s["faint"], max_w=240)
    v.text(1038, 126, "判定 · 级别 + 位置", 12, s["faint"], anchor="end",
           max_w=240)

    top = 144
    row_h = 52
    for i, row in enumerate(FLOW_ROWS):
        y = top + i * row_h
        if i > 0:
            v.line(62, y, 1038, y, stroke=s["rule"], sw=1)
        # status rail on the sheet's left edge
        rail = s["accent"] if row["result"] == "warn" else s["mark"]
        if row["result"] == "skipped":
            v.rect(50, y + 14, 4, 26, fill="none", rx=2, stroke=rail, sw=1.6)
        else:
            v.rect(50, y + 14, 4, 26, fill=rail, rx=2)

        # left page: the register's column, its name, and the value
        v.text(62, y + 21, row["field"], 11, s["faint"], mono=True,
               max_w=330)
        fw = measure(row["field"], 11, "mono")
        v.text(62 + fw + 8, y + 21, "·", 10.5, s["faint"])
        v.text(62 + fw + 18, y + 21, row["label"], 11.5, s["sub"],
               max_w=478 - fw - 18)
        value_fill = s["mark"] if row["tone"] == "mark" else s["text"]
        v.text(62, y + 43, row["value"], 12.5, value_fill, max_w=470)
        if row.get("span"):
            pre = row["value"].split(row["span"])[0]
            sw = measure(row["span"], 12.5, "cjk")
            px = 62 + measure(pre, 12.5, "cjk")
            v.line(px - 1, y + 47, px + sw + 1, y + 47, stroke=s["mark"],
                   sw=1.6)

        # right page: the rule, its basis kind, its result
        v.text(578, y + 20, row["rule"], 13.5, s["text"], weight=700,
               mono=True)
        rw = measure(row["rule"], 13.5, "mono_bold")
        v.chip(578 + rw + 8, y + 7, row["kind"], s["accent"], s["pill"],
               size=11, height=20)
        res_fg = s["accent"] if row["result"] == "warn" else s["mark"]
        v.chip(1038 - measure(row["result"], 11, "mono") - 18, y + 7,
               row["result"], res_fg, s["pill"], size=11, height=20,
               mono=True)
        v.text(578, y + 42, row["check"], 11.5, s["sub"], max_w=300)
        v.text(1038, y + 42, row["where"], 11,
               s["faint"] if row["result"] == "skipped" else s["sub"],
               anchor="end", max_w=240)

    # ---- the two report channels and the reviewer ---------------------------
    v.rect(44, 490, 424, 76, fill=s["card"], rx=16, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(62, 517, "issues[]", 14.5, s["accent"], weight=700, mono=True)
    v.chip(448 - measure("行号 + 栏名 + 应填", 11, "cjk") - 18, 503,
           "行号 + 栏名 + 应填", s["faint"], s["pill"], size=11,
           height=20)
    v.text(62, 541, "BC-001 · 第 1 行 · response →「应填写」", 11.5,
           s["text"], max_w=390)
    v.text(62, 558, "BC-006 · 第 1 行 · requirement → 占位符未替换", 11.5,
           s["text"], max_w=390)

    v.rect(484, 490, 572, 76, fill=s["card"], rx=16, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(502, 517, "skipped[]", 14.5, s["sub"], weight=700, mono=True)
    v.chip(1038 - measure("未执行也不静默通过", 11, "cjk") - 18, 503,
           "未执行也不静默通过", s["faint"], s["pill"], size=11,
           height=20)
    v.text(502, 541, "BC-002 · values 未配置（口径由本机构定）", 11.5,
           s["text"], max_w=525)
    v.text(502, 558,
           "BC-005 · highRiskKeywords 未配置（哪些条款高风险由招标文件定）",
           11.5, s["text"], max_w=525)

    v.rect(44, 576, 1012, 32, fill=s["card"], rx=16, stroke=s["accent"],
           sw=1.6, shadow=True)
    v.text(62, 597, "审核人", 12.5, s["text"], weight=700, max_w=70)
    v.text(118, 597, "· 结论不在报告里：issues[] 与 skipped[] 一起读，判定留给评标委员会",
           11.5, s["sub"], max_w=800)
    v.text(1038, 597, "评标委员会", 11, s["faint"], anchor="end")

    # sheet -> two channels -> reviewer
    v.path("M560 466 V474 H332 V490", stroke=s["accent"], sw=1.6, marker="arr")
    v.path("M560 474 H846 V490", stroke=s["accent"], sw=1.6, marker="arr")
    v.line(332, 566, 332, 574, stroke=s["accent"], sw=1.6, marker="arr")
    v.line(846, 566, 846, 574, stroke=s["accent"], sw=1.6, marker="arr")

    # ---- footer -------------------------------------------------------------
    v.text(44, 632,
           "严重级跟着证据走：derived-from-principle ≤ warn · institutional-configuration ≤ info ｜ excerpt 必须是逐字引文",
           11.5, s["sub"], max_w=1012)
    v.text(44, 648,
           "config：rulesFile · disabledRules · onlyRules · skipNotes · timeoutMs ｜ 空 issues ≠ 没问题：skipped 逐条写明原因",
           11.5, s["faint"], max_w=1012)

    if v.overflows:
        raise SystemExit("FATAL: SVG label overflow:\n  "
                         + "\n  ".join(v.overflows))
    return v.svg(
        W, H,
        "dsh-bid-ca-precheck 结构图：条款对照 —— 六条规则各读台账的一栏，"
        "逐行给出级别与位置，两条输出通道汇到审核人",
        "左页是台账每一栏的写法（列名归一后），右页是读这一栏的规则、依据类别与判定；"
        "实心轨道=该规则命中并给出级别，空心轨道=未执行（skipped）并写明原因。"
        "issues[] 与 skipped[] 两条通道同时进入审核人栏，结论不在报告里。")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin)
        name = f"dsh-bid-ca-precheck-flow-v5-{skin}.svg"
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(flow_svg(skin))
        print(f"wrote {name} (1100x660)")


if __name__ == "__main__":
    main()
