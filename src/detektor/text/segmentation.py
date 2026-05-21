"""Lekka segmentacja tekstu (akapity / zdania / tokeny) z offsetami znakowymi.

Domyslnie dziala na regexach + liscie polskich skrotow-straznikow, dzieki czemu
nie wymaga ciezkich zaleznosci NLP. Opcjonalnie (USE_SPACY=true) potrafi uzyc
spaCy do granic zdan, jesli pakiet i model sa zainstalowane.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .normalize import has_letter

_TOKEN = re.compile(r"\w+", re.UNICODE)
# Granica zdania: znaki konca + opcjonalny cudzyslow/nawias + bialy znak lub koniec.
_SENT_BOUNDARY = re.compile(r"([.!?…]+[\"'\)\]]?)(\s+|$)")
_PARA_SPLIT = re.compile(r"\n[ \t]*\n+")

# Skroty, po ktorych kropka nie konczy zdania.
_ABBREV: frozenset[str] = frozenset(
    {
        "np",
        "m.in",
        "min",
        "itd",
        "itp",
        "tzw",
        "tzn",
        "tj",
        "dr",
        "prof",
        "inz",
        "inż",
        "mgr",
        "hab",
        "ul",
        "al",
        "nr",
        "godz",
        "ok",
        "por",
        "red",
        "wg",
        "ww",
        "p.n.e",
        "n.e",
        "art",
        "ust",
        "pkt",
        "str",
        "rys",
        "tab",
        "zob",
        "cyt",
        "sp",
        "z.o.o",
        "s.a",
        "cd",
        "ds",
        "płk",
        "gen",
    }
)


@dataclass
class Token:
    text: str
    start: int
    end: int


@dataclass
class Sentence:
    text: str
    start: int
    end: int
    tokens: list[Token] = field(default_factory=list)


@dataclass
class Paragraph:
    text: str
    start: int
    end: int
    sentences: list[Sentence] = field(default_factory=list)


@dataclass
class Document:
    text: str
    paragraphs: list[Paragraph] = field(default_factory=list)
    sentences: list[Sentence] = field(default_factory=list)
    tokens: list[Token] = field(default_factory=list)

    @property
    def word_tokens(self) -> list[Token]:
        return [t for t in self.tokens if has_letter(t.text)]

    @property
    def word_count(self) -> int:
        return len(self.word_tokens)


def _word_before(text: str, pos: int) -> str:
    start = pos
    while start > 0 and (text[start - 1].isalnum() or text[start - 1] in "._-"):
        start -= 1
    return text[start:pos]


def _is_blocked_boundary(text: str, punct_start: int) -> bool:
    if punct_start == 0 or text[punct_start] != ".":
        # Tylko kropka bywa myloca (skroty). ! ? ... zawsze koncza zdanie.
        return False
    token = _word_before(text, punct_start).strip("._-").casefold()
    if not token:
        return False
    return token in _ABBREV or len(token) == 1 or token.isdigit()


def _split_sentence_spans(par_text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    cursor = 0
    for m in _SENT_BOUNDARY.finditer(par_text):
        if _is_blocked_boundary(par_text, m.start(1)):
            continue
        end = m.end(1)
        if end > cursor:
            spans.append((cursor, end))
        cursor = m.end(2)
    if cursor < len(par_text):
        tail = par_text[cursor:].rstrip()
        if tail:
            spans.append((cursor, cursor + len(tail)))
    return spans


def _tokenize(text: str, base: int) -> list[Token]:
    return [Token(m.group(0), base + m.start(), base + m.end()) for m in _TOKEN.finditer(text)]


def _paragraph_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    cursor = 0
    for sep in _PARA_SPLIT.finditer(text):
        spans.append((cursor, sep.start()))
        cursor = sep.end()
    spans.append((cursor, len(text)))
    out: list[tuple[int, int]] = []
    for start, end in spans:
        chunk = text[start:end]
        lstrip = len(chunk) - len(chunk.lstrip())
        rstrip = len(chunk) - len(chunk.rstrip())
        s, e = start + lstrip, end - rstrip
        if e > s:
            out.append((s, e))
    return out


def _spacy_sentence_spans(text: str):  # pragma: no cover - opcjonalne
    try:
        import spacy
    except ImportError:
        return None
    try:
        nlp = spacy.load("pl_core_news_sm", disable=["ner", "lemmatizer"])
    except OSError:
        return None
    doc = nlp(text)
    return [(s.start_char, s.end_char) for s in doc.sents]


def segment(text: str, use_spacy: bool = False) -> Document:
    """Podziel tekst na akapity, zdania i tokeny z zachowaniem offsetow."""
    document = Document(text=text)
    if not text.strip():
        return document

    spacy_spans = _spacy_sentence_spans(text) if use_spacy else None

    for p_start, p_end in _paragraph_spans(text):
        par_text = text[p_start:p_end]
        paragraph = Paragraph(text=par_text, start=p_start, end=p_end)

        if spacy_spans is not None:
            local = [(s, e) for s, e in spacy_spans if s >= p_start and e <= p_end]
            rel_spans = [(s - p_start, e - p_start) for s, e in local] or [(0, len(par_text))]
        else:
            rel_spans = _split_sentence_spans(par_text) or [(0, len(par_text))]

        for rs, re_ in rel_spans:
            abs_start, abs_end = p_start + rs, p_start + re_
            sent_text = text[abs_start:abs_end]
            if not sent_text.strip():
                continue
            sentence = Sentence(text=sent_text, start=abs_start, end=abs_end)
            sentence.tokens = _tokenize(sent_text, abs_start)
            paragraph.sentences.append(sentence)
            document.sentences.append(sentence)
            document.tokens.extend(sentence.tokens)

        if paragraph.sentences:
            document.paragraphs.append(paragraph)

    return document
