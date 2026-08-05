"""
Site layout sketch for IPAS 2 Bantargebang.

The point of the drawing is one idea: the site has far more land than the
process needs, and the surplus should be spent as distance from the waste slope
rather than saved by stacking the plant. Everything else on the page supports
that — the ordering of the units by how replaceable they are, and the buffer
zone drawn at the same scale as the plant so the comparison is not rhetorical.

Areas come from scripts/out/bantargebang.json so the blocks are proportional to
what the model actually sized.
"""
import json
from PIL import Image, ImageDraw, ImageFont

with open("scripts/out/bantargebang.json", encoding="utf-8") as fh:
    D = json.load(fh)

SITE_M = 141.4                      # a 2 ha square plot, 141.4 m a side
PX_PER_M = 7
PAD_X = 70
PAD_TOP = 190
PAD_BOT = 40
W = int(SITE_M * PX_PER_M) + PAD_X * 2
H = int(SITE_M * PX_PER_M) + PAD_TOP + PAD_BOT + 200

NAVY = (15, 41, 66)
INK = (45, 60, 75)
GREY = (120, 134, 148)
LINE = (170, 185, 198)
AQUA = (8, 165, 224)
MINT = (14, 124, 90)
SUN = (222, 152, 20)
CORAL = (176, 48, 36)
VIOLET = (109, 74, 168)
BUF = (232, 245, 236)
WASTE = (222, 208, 190)


def font(sz, bold=False):
    for name in (("arialbd.ttf", "calibrib.ttf") if bold else ("arial.ttf", "calibri.ttf")):
        try:
            return ImageFont.truetype(name, sz)
        except OSError:
            continue
    return ImageFont.load_default()


def draw(path, lang):
    T = {
        "id": dict(
            title="TATA LETAK USULAN — IPAS 2 BANTARGEBANG",
            sub="Lahan 2 ha · 1.200 m³/hari · jarak dari lereng sampah sebagai mitigasi utama",
            waste="TUMPUKAN SAMPAH — lereng tinggi, dinding penahan pernah roboh berulang",
            wall="Dinding penahan (batas)",
            buffer="ZONA PENYANGGA — TIDAK DIBANGUN",
            bufnote="±70 m. Satu-satunya mitigasi yang gratis, tanpa perawatan,\ndan tetap bekerja bila mitigasi lain gagal.",
            r1="Baris 1 — pekerjaan sipil, paling cepat dibangun ulang",
            r2="Baris 2 — proses menengah",
            r3="Baris 3 — peralatan tak tergantikan, jarak terjauh",
            road="Jalan akses · gudang kimia · pos jaga · parkir",
            legend="Urutan penempatan mengikuti apa yang sanggup direlakan bila dinding roboh lagi.",
            scale="meter",
            areas="Luas proses",
            of="dari",
            note1="Luas proses %s m² dari %s m² tersedia (%s %%).",
            note2="Bangunan bertingkat tidak menghemat lahan yang dibutuhkan di sini,",
            note3="dan menambah risiko geoteknik pada tanah yang sudah terbukti bergerak.",
        ),
        "en": dict(
            title="PROPOSED SITE LAYOUT — IPAS 2 BANTARGEBANG",
            sub="2 ha site · 1,200 m³/day · set-back from the waste slope as the primary mitigation",
            waste="WASTE PILE — high slope, retaining wall has failed repeatedly",
            wall="Retaining wall (boundary)",
            buffer="BUFFER ZONE — LEFT UNBUILT",
            bufnote="~70 m. The only mitigation that is free, needs no maintenance,\nand still works when every other measure fails.",
            r1="Row 1 — civil works, quickest to rebuild",
            r2="Row 2 — intermediate process",
            r3="Row 3 — irreplaceable equipment, furthest away",
            road="Access road · chemical store · gatehouse · parking",
            legend="Placement follows what you can afford to lose if the wall fails again.",
            scale="metres",
            areas="Process area",
            of="of",
            note1="Process occupies %s m² of the %s m² available (%s %%).",
            note2="Building upward saves land that is not needed here,",
            note3="and adds geotechnical risk on ground already proven to move.",
        ),
    }[lang]

    img = Image.new("RGB", (W, H), "white")
    dr = ImageDraw.Draw(img)
    f_t, f_s, f_h, f_b, f_n = font(30, True), font(18), font(16, True), font(15, True), font(13)

    def m2px(x, y):
        return PAD_X + x * PX_PER_M, PAD_TOP + y * PX_PER_M

    def tint(c, k=0.86):
        return tuple(int(v * (1 - k) + 255 * k) for v in c)

    dr.text((PAD_X, 30), T["title"], font=f_t, fill=NAVY)
    dr.text((PAD_X, 70), T["sub"], font=f_s, fill=MINT)

    x0, y0 = m2px(0, 0)
    x1, y1 = m2px(SITE_M, SITE_M)

    # the waste pile, outside the boundary
    dr.rectangle([x0 - 40, y0 - 66, x1 + 40, y0], fill=WASTE)
    for i in range(-40, int(x1 - x0) + 40, 16):
        dr.line([x0 + i, y0, x0 + i + 24, y0 - 66], fill=(198, 178, 154), width=2)
    dr.rectangle([x0 + 4, y0 - 58, x0 + 640, y0 - 34], fill=WASTE)
    dr.text((x0 + 8, y0 - 56), T["waste"], font=f_b, fill=(116, 78, 36))

    # retaining wall
    dr.line([x0 - 40, y0, x1 + 40, y0], fill=CORAL, width=7)
    wl = T["wall"]
    wlw = dr.textlength(wl, font=f_n)
    dr.rectangle([x1 - wlw - 14, y0 - 26, x1 - 2, y0 - 5], fill=WASTE)
    dr.text((x1 - wlw - 8, y0 - 24), wl, font=f_n, fill=CORAL)

    # site boundary
    dr.rectangle([x0, y0, x1, y1], outline=NAVY, width=3)

    # buffer
    bx0, by0 = m2px(0, 0)
    bx1, by1 = m2px(SITE_M, 70)
    dr.rectangle([bx0 + 3, by0 + 3, bx1 - 3, by1], fill=BUF, outline=(150, 200, 172), width=2)
    dr.text((bx0 + 20, by0 + 40), T["buffer"], font=f_h, fill=MINT)
    dr.multiline_text((bx0 + 20, by0 + 64), T["bufnote"], font=f_n, fill=(70, 110, 90), spacing=6)
    # dimension arrow
    ax = bx1 - 90
    dr.line([ax, by0 + 4, ax, by1 - 2], fill=MINT, width=2)
    for yy in (by0 + 4, by1 - 2):
        dr.line([ax - 6, yy + (6 if yy == by0 + 4 else -6), ax, yy], fill=MINT, width=2)
        dr.line([ax + 6, yy + (6 if yy == by0 + 4 else -6), ax, yy], fill=MINT, width=2)
    dr.text((ax + 8, (by0 + by1) // 2 - 10), "70 m", font=f_b, fill=MINT)

    # unit blocks, area-proportional
    U = {u["label"]: u["area_m2"] for u in D["caseC"]["units"]}

    def block(x, y, w, h, label, area, color, small=False):
        px0, py0 = m2px(x, y)
        px1, py1 = m2px(x + w, y + h)
        dr.rectangle([px0, py0, px1, py1], fill=tint(color), outline=color, width=2)
        dr.rectangle([px0, py0, px1, py0 + 5], fill=color)
        ff = f_n if small else f_b
        dr.text((px0 + 7, py0 + 13), label, font=ff, fill=INK)
        if area:
            dr.text((px0 + 7, py0 + 13 + (15 if small else 18)), f"{area:.0f} m2", font=f_n, fill=(90, 104, 118))

    # Row 1 — civil, nearest the slope
    dr.text(m2px(2, 73), T["r1"], font=f_n, fill=SUN)
    block(2, 77, 26, 15, "Equalisation", U.get("Equalisation", 191), SUN)
    block(30, 77, 22, 15, "Coag + Lamella", U.get("Lamella Clarifier", 36) + 10, SUN)
    block(54, 77, 30, 15, "Thickener + Filter Press", U.get("Filter Press", 131) + U.get("Sludge Thickener", 36), SUN)
    block(86, 77, 20, 15, "Intake & Screen", U.get("Intake & Screen", 58), SUN)

    # Row 2 — mid process
    dr.text(m2px(2, 94), T["r2"], font=f_n, fill=VIOLET)
    block(2, 98, 40, 14, "UASB", U.get("UASB", 952), VIOLET)
    block(44, 98, 24, 14, "NH3 Stripping", U.get("Ammonia Stripping", 59), VIOLET, small=True)
    block(70, 98, 18, 14, "pH Dosing", 17, VIOLET, small=True)

    # Row 3 — irreplaceable, furthest
    dr.text(m2px(2, 114), T["r3"], font=f_n, fill=AQUA)
    block(2, 118, 22, 13, "MBR", U.get("MBR", 280), AQUA)
    block(26, 118, 20, 13, "DTRO 2-stage", U.get("DTRO 2-stage", 160), AQUA)
    block(48, 118, 18, 13, "AOP", U.get("Catalytic AOP", 102), AQUA)
    block(68, 118, 20, 13, "MVR + Cryst.", U.get("MVR Evaporator", 174) + U.get("Crystalliser", 131), AQUA)
    block(90, 118, 24, 13, "MCC + Control", 180, AQUA)

    # service strip
    sx0, sy0 = m2px(0, 133)
    sx1, sy1 = m2px(SITE_M, SITE_M)
    dr.rectangle([sx0 + 3, sy0, sx1 - 3, sy1 - 3], fill=(245, 247, 249), outline=LINE, width=1)
    dr.text((sx0 + 16, sy0 + 8), T["road"], font=f_n, fill=GREY)

    # scale bar
    ly = y1 + 46
    dr.line([x0, ly, x0 + 50 * PX_PER_M, ly], fill=NAVY, width=3)
    for i in range(0, 51, 25):
        dr.line([x0 + i * PX_PER_M, ly - 6, x0 + i * PX_PER_M, ly + 6], fill=NAVY, width=2)
        dr.text((x0 + i * PX_PER_M - 6, ly + 10), str(i), font=f_n, fill=NAVY)
    dr.text((x0 + 52 * PX_PER_M, ly - 6), T["scale"], font=f_n, fill=NAVY)

    C = D["caseC"]
    site = D["site"]["landAvailable_m2"]
    pct = C["processArea_m2"] / site * 100
    dr.text((x0, ly + 44), T["legend"], font=f_b, fill=INK)
    def num(v):
        t = f"{v:,}"
        return t.replace(",", ".") if lang == "id" else t

    pct_s = f"{pct:.1f}".replace(".", ",") if lang == "id" else f"{pct:.1f}"
    dr.text((x0, ly + 66), T["note1"] % (num(C["processArea_m2"]), num(site), pct_s),
            font=f_n, fill=GREY)
    dr.text((x0, ly + 84), T["note2"], font=f_n, fill=CORAL)
    dr.text((x0, ly + 100), T["note3"], font=f_n, fill=CORAL)

    img.save(path, dpi=(160, 160))
    print("wrote", path, img.size)


draw("scripts/out/layout-id.png", "id")
draw("scripts/out/layout-en.png", "en")
