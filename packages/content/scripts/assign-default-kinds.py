#!/usr/bin/env python3
"""
assign-default-kinds.py (B1, one-shot)

Agrega el campo `kind` a cada lesson según el slug del curso.
Idempotente: si ya tiene `kind`, lo deja.

Defaults por curso:
  linux-*, tu-primer-vps            -> terminal-linux
  primer-sitio-web                  -> playground-html
  git-github                        -> playground-git
  docker                            -> playground-docker
  bases-de-datos (y default)        -> reading-only
"""

import re
import sys
from pathlib import Path

COURSES_DIR = Path(__file__).parent.parent / "src" / "courses"

DEFAULT_KIND_BY_SLUG = {
    "linux-basico": "terminal-linux",
    "linux-intermedio": "terminal-linux",
    "linux-avanzado": "terminal-linux",
    "tu-primer-vps": "terminal-linux",
    "primer-sitio-web": "playground-html",
    "git-github": "playground-git",
    "docker": "playground-docker",
    "bases-de-datos": "reading-only",
}


def process_file(path: Path) -> tuple[int, int, str]:
    """Returns (lesson_count, updated_count, course_slug)."""
    original = path.read_text()

    # Detectar slug del curso: el primer slug dentro del archivo
    # es el de meta. Lo capturamos con un patrón simple.
    slug_match = re.search(r"slug:\s*['\"]([^'\"]+)['\"]", original)
    if not slug_match:
        print(f"  WARN {path.name}: sin slug, saltando", file=sys.stderr)
        return (0, 0, "")
    course_slug = slug_match.group(1)

    default_kind = DEFAULT_KIND_BY_SLUG.get(course_slug, "reading-only")

    # Detectar si ya tiene el campo kind (idempotencia)
    if re.search(r"^\s*kind:\s*['\"]", original, re.MULTILINE):
        # Contar lecciones y reportar sin cambios
        slug_lines = re.findall(r"^\s*slug:\s*['\"]", original, re.MULTILINE)
        # El primer slug es el del curso
        lesson_count = max(0, len(slug_lines) - 1)
        print(f"= {path.name} ({course_slug}): ya tiene kind ({lesson_count} lecciones)")
        return (lesson_count, 0, course_slug)

    # Reemplazar cada `readTime: N,` que NO esté seguido por `kind:`
    # e insertar `      kind: 'X',` después.
    pattern = re.compile(
        r"^(\s*readTime:\s*\d+,)(\s*\n(?!\s*kind:))",
        re.MULTILINE,
    )
    replacement = rf"\1\2      kind: '{default_kind}',"

    new_content, n_subs = pattern.subn(replacement, original)

    if n_subs == 0:
        print(f"  WARN {path.name}: 0 readTime matches, revisar formato")
        return (0, 0, course_slug)

    path.write_text(new_content)
    lesson_count = n_subs
    print(f"+ {path.name} ({course_slug}): {lesson_count} lecciones -> {default_kind}")
    return (lesson_count, n_subs, course_slug)


def main():
    files = sorted(COURSES_DIR.glob("*.ts"))
    total_lessons = 0
    total_updated = 0
    by_kind: dict[str, int] = {}

    for f in files:
        lessons, _, _ = process_file(f)
        total_lessons += lessons

    # Recalcular por curso (segunda pasada para reportar)
    for f in files:
        content = f.read_text()
        slug_m = re.search(r"slug:\s*['\"]([^'\"]+)['\"]", content)
        if not slug_m:
            continue
        course_slug = slug_m.group(1)
        default_kind = DEFAULT_KIND_BY_SLUG.get(course_slug, "reading-only")
        kind_matches = re.findall(rf"^\s*kind:\s*['\"]({re.escape(default_kind)})['\"]", content, re.MULTILINE)
        by_kind[default_kind] = by_kind.get(default_kind, 0) + len(kind_matches)

    print("\n--- Resumen ---")
    print(f"Archivos escaneados: {len(files)}")
    print(f"Lecciones etiquetadas: {total_lessons}")
    for kind, n in sorted(by_kind.items()):
        print(f"  {kind}: {n}")


if __name__ == "__main__":
    main()
