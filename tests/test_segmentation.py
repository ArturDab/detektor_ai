from detektor.text import segment


def test_offsets_align_with_source():
    txt = "Ala ma kota i psa."
    doc = segment(txt)
    assert doc.word_count == 5
    for t in doc.tokens:
        assert txt[t.start : t.end] == t.text


def test_paragraphs_and_abbreviation_guard():
    txt = (
        "Pierwsze zdanie. Drugie zdanie!\n\nTrzecie zdanie np. ze skrotem nadal trwa dalej. Koniec."
    )
    doc = segment(txt)
    assert len(doc.paragraphs) == 2
    texts = [s.text for s in doc.sentences]
    # "np." nie konczy zdania -> zdanie zawiera i "np." i "trwa".
    assert any("np." in t and "trwa" in t for t in texts)


def test_empty_text():
    doc = segment("    \n\n   ")
    assert doc.word_count == 0
    assert doc.sentences == []
