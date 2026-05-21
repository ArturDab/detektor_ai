from detektor.heuristics.punctuation_calque import PunctuationCalqueAnalyzer
from detektor.heuristics.slop_phrases import SlopPhraseAnalyzer
from detektor.heuristics.structural import StructuralAnalyzer
from detektor.text import segment


def test_slop_phrase_offsets_point_at_match():
    txt = "Warto zauważyć, że ten projekt naprawdę dobrze działa i wszyscy są zadowoleni."
    doc = segment(txt)
    res = SlopPhraseAnalyzer().analyze(doc)
    assert res.metrics["hits"] >= 1
    f = res.findings[0]
    assert txt[f.start : f.end].lower().startswith("warto zauważyć")
    assert res.score > 0


def test_model_leak_forces_max_score():
    txt = (
        "To jest zupełnie normalny tekst o pogodzie i kotach. "
        "Jako model językowy nie mam dostępu do internetu w tej chwili."
    )
    doc = segment(txt)
    res = PunctuationCalqueAnalyzer().analyze(doc)
    assert res.score == 100
    assert any(f.label == "model_leak" for f in res.findings)


def test_title_case_heading_flagged():
    txt = "Najlepsze Sposoby Na Zdrowy Sen\n\nTo jest zwykły akapit z całkiem normalnym zdaniem."
    doc = segment(txt)
    res = StructuralAnalyzer().analyze(doc)
    assert any(f.label == "title_case_heading" for f in res.findings)


def test_connector_at_sentence_start_flagged():
    txt = "Lubię koty. Ponadto lubię psy oraz inne zwierzęta domowe w naszym otoczeniu."
    doc = segment(txt)
    res = StructuralAnalyzer().analyze(doc)
    assert any(f.label == "connector" for f in res.findings)
