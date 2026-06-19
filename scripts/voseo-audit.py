#!/usr/bin/env python3
"""Auditor de voseo para polar-school.

Detecta voseo real con alta precisión (sin falsos positivos como subjuntivos,
presentes genéricos tú, o palabras terminadas en -á/-é/-í que no son voseo).

Exit code 1 si encuentra voseo real.
"""
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

# ========================================================================
# Reglas: patrones que SOLO aparecen en voseo real (concordancia/pronombre)
# ========================================================================

# Regla 1: Verbo conjugado en voseo (presente -ás/-és/-ís) con pronombre "vos"
# explícito antes, o "vosotros" en subjuntivo.
VOS_PRONOUN_PRESENTE = re.compile(
    r'\bVos\s+(?:'
    r'podés|querés|tenés|sabés|decís|hacés|ves|oís|venís|salís|entrás|'
    r'corrés|perdés|administrás|revisás|guardás|borrás|buscás|'
    r'descargás|instalás|ejecutás|probás|comprás|empezás|terminás|'
    r'configurás|conectás|esperás|organizás|consultás|necesitás|pasás|'
    r'correntás|deshabilitás|abrís|decidís|elegís|'
    r'decís|comentás|preguntás|avisás|avisás|llamás|enviás|'
    r'trabajás|estudiás|leés|escuchás|mirás|jugás|usás|'
    r'recordás|olvidás|recordás|piensás|creés|sentís|'
    r'esperás|llegás|volvés|entendés|comprendés|aprendés'
    r')\b',
    re.IGNORECASE,
)

# Regla 2: Imperativo voseante (sin pronombre). El comando va al inicio de línea
# o después de signo de puntuación, y NO va seguido de "que" (eso es subjuntivo).
# Palabras terminadas en -á/-é/-í que son inequívocamente voseo:
#   probá, mirá, pará, pasá, fijate, acordate, mandale, etc.
IMPERATIVO_VOSEANTE = re.compile(
    r'(?:^|[\.\?\!\n;:\(]\s)'           # inicio de línea o después de puntuación
    r'(?:'
    r'Probá(?!\s+que)\b|'
    r'proba(?!r)(?!s)\b|'
    r'Mirá(?!\s+que)\b|'
    r'Pará(?!\s+que)\b|'
    r'Pasá(?!\s+que)\b|'
    r'Tirá(?!\s+que)\b|'
    r'Sacá(?!\s+que)\b|'
    r'Fijate\b|'
    r'Acordate\b|'
    r'Asegurate\b|'
    r'Recordá(?!\s+que)\b|'
    r'Empezá(?!\s+que)\b|'
    r'Comenza(?!\s+que)\b|'
    r'Terminá(?!\s+que)\b|'
    r'Cerrá(?!\s+que)\b|'
    r'Guardá(?!\s+que)\b|'
    r'Corré(?!\s+que)\b|'
    r'Buscá(?!\s+que)\b|'
    r'Encontrá(?!\s+que)\b|'
    r'Escuchá(?!\s+que)\b|'
    r'Leé(?!\s+que)\b|'
    r'Mandá(?!\s+que)\b|'
    r'Compartí(?!\s+que)\b|'
    r'Poné(?!\s+que)\b|'
    r'Quitá(?!\s+que)\b'
    r')',
    re.MULTILINE,
)

# Regla 3: Headers/frases lexicalizadas voseantes (sin importar posición).
LEXICAL_VOSEANTE = re.compile(
    r'\b(?:Probá\s+esto|Escribí\s+los\s+comandos|proba\s+<)\b',
    re.IGNORECASE,
)

EXTS = {".ts", ".astro", ".svelte", ".tsx", ".md", ".mdx", ".json"}
SKIP = {"node_modules", ".turbo", "dist", ".astro", ".git", "drizzle"}

findings: list[tuple[str, int, str, str]] = []

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    if any(s in path.parts for s in SKIP):
        continue
    if path.suffix not in EXTS:
        continue

    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue

    rel = path.relative_to(ROOT)

    for i, line in enumerate(text.splitlines(), 1):
        for rx, kind in [
            (VOS_PRONOUN_PRESENTE, "voseo-pronombre-vos"),
            (IMPERATIVO_VOSEANTE, "voseo-imperativo"),
            (LEXICAL_VOSEANTE, "voseo-lexical"),
        ]:
            for m in rx.finditer(line):
                findings.append((str(rel), i, kind, line.strip()[:100]))

if findings:
    # Dedup
    seen = set()
    print(f"❌ {len(findings)} instancia(s) de voseo:")
    for path, line, kind, ctx in findings:
        key = (path, line, kind)
        if key in seen:
            continue
        seen.add(key)
        print(f"  {path}:{line} [{kind}] {ctx}")
    sys.exit(1)
else:
    print("✓ Sin voseo detectado")
    sys.exit(0)
