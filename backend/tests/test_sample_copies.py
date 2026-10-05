"""Files that ship twice must stay identical: the sample CSV (backend tests + frontend download)
and the architecture diagram (docs/ source + frontend/public copy shown in Tab 4)."""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
PAIRS = [
    (ROOT / "backend" / "data" / "sample_transactions.csv", ROOT / "frontend" / "public" / "sample_transactions.csv"),
    (ROOT / "docs" / "architecture.svg", ROOT / "frontend" / "public" / "architecture.svg"),
    (ROOT / "docs" / "architecture.drawio", ROOT / "frontend" / "public" / "architecture.drawio"),
]


@pytest.mark.parametrize("source,copy", PAIRS, ids=lambda p: p.name)
def test_copies_match(source: Path, copy: Path):
    if not copy.exists():
        pytest.skip(f"{copy.relative_to(ROOT)} not created yet")
    assert copy.read_bytes().replace(b"\r\n", b"\n") == source.read_bytes().replace(b"\r\n", b"\n")


def test_build_prompt_matches_docs():
    copy = ROOT / "frontend" / "public" / "build-prompt.txt"
    if not copy.exists():
        pytest.skip("frontend/public/build-prompt.txt not created yet")
    doc = (ROOT / "docs" / "PROMPT.md").read_text(encoding="utf-8").replace("\r\n", "\n")
    block = doc.split("```text\n", 1)[1].split("\n```", 1)[0]
    assert copy.read_text(encoding="utf-8").replace("\r\n", "\n").strip() == block.strip()
