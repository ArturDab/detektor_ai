from detektor.heuristics.lexical_diversity import LexicalDiversityAnalyzer
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


def test_repeated_proper_name_title_not_flagged():
    txt = (
        "Zero Parades to nowa produkcja niezależnego studia z Krakowa. "
        "Zero Parades opowiada o samotności i pamięci w opuszczonym mieście. "
        "Zero Parades zostało docenione przez krytyków za odważną narrację. "
        "Invincible VS pojawi się w tym samym miesiącu na konsolach nowej generacji. "
        "Invincible VS przyciąga fanów dynamicznymi pojedynkami i bogatą obsadą postaci."
    )
    doc = segment(txt)
    res = LexicalDiversityAnalyzer().analyze(doc)
    assert not any(f.label == "repeated_opening" for f in res.findings)


def test_repeated_slop_opener_still_flagged():
    txt = (
        "Należy podkreślić, że technologia zmienia się naprawdę bardzo szybko. "
        "Należy podkreślić znaczenie regularnego odpoczynku dla naszego zdrowia. "
        "Należy podkreślić rolę edukacji w rozwoju całego społeczeństwa polskiego. "
        "Należy podkreślić, że każda firma musi mieć swoją własną stronę internetową."
    )
    doc = segment(txt)
    res = LexicalDiversityAnalyzer().analyze(doc)
    flagged = [f for f in res.findings if f.label == "repeated_opening"]
    assert flagged
    f = flagged[0]
    assert txt[f.start : f.end].lower().startswith("należy podkreślić")
