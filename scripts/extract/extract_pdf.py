"""
Extração BRUTA de PDFs de catálogo (etapa 1 do pipeline).

Produz, por página, todos os spans de texto com coordenadas, fonte, tamanho,
cor e as imagens (xref + digest) com bounding box. NÃO interpreta dados:
a interpretação acontece nos parsers TypeScript (scripts/pipeline/parsers).

Uso:
    python scripts/extract/extract_pdf.py <pdf> <sourceId> <paginas> <saida.json>

    <paginas>: lista "4-31,36-39" (1-based, inclusivo)

Requer: PyMuPDF (pip install pymupdf)
"""
import hashlib
import json
import sys

import pymupdf


def parse_pages(spec: str, total: int) -> list[int]:
    pages: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-")
            pages.extend(range(int(a), int(b) + 1))
        else:
            pages.append(int(part))
    return [p for p in pages if 1 <= p <= total]


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def r(v: float) -> float:
    return round(v, 2)


def extract_page(page: "pymupdf.Page") -> dict:
    spans = []
    d = page.get_text("dict")
    for bi, block in enumerate(d["blocks"]):
        if block.get("type") != 0:
            continue
        for li, line in enumerate(block["lines"]):
            for s in line["spans"]:
                text = s["text"]
                if not text.strip():
                    continue
                x0, y0, x1, y1 = s["bbox"]
                spans.append(
                    {
                        "t": text,
                        "b": bi,
                        "l": li,
                        "x0": r(x0),
                        "y0": r(y0),
                        "x1": r(x1),
                        "y1": r(y1),
                        "sz": r(s["size"]),
                        "f": s["font"],
                        "c": s["color"],
                    }
                )
    images = []
    try:
        for info in page.get_image_info(hashes=True, xrefs=True):
            x0, y0, x1, y1 = info["bbox"]
            digest = info.get("digest")
            images.append(
                {
                    "xref": info.get("xref", 0),
                    "digest": digest.hex() if isinstance(digest, (bytes, bytearray)) else None,
                    "x0": r(x0),
                    "y0": r(y0),
                    "x1": r(x1),
                    "y1": r(y1),
                    "w": info.get("width"),
                    "h": info.get("height"),
                }
            )
    except Exception as exc:  # pragma: no cover - diagnóstico
        images.append({"error": str(exc)})
    return {
        "page": page.number + 1,
        "width": r(page.rect.width),
        "height": r(page.rect.height),
        "spans": spans,
        "images": images,
    }


def main() -> None:
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(2)
    pdf, source_id, spec, out = sys.argv[1:5]
    doc = pymupdf.open(pdf)
    pages = parse_pages(spec, doc.page_count)
    result = {
        "sourceId": source_id,
        "file": pdf.replace("\\", "/").split("/")[-1],
        "sha256": sha256_file(pdf),
        "pageCount": doc.page_count,
        "extractor": f"pymupdf {pymupdf.VersionBind}",
        "pages": [extract_page(doc[p - 1]) for p in pages],
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{source_id}: {len(pages)} paginas -> {out}")


if __name__ == "__main__":
    main()
