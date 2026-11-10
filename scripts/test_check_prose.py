"""
Tests for scripts/check-prose.py (#1143). Run: python3 -m unittest scripts/test_check_prose.py
"""
import importlib.util
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('check_prose', pathlib.Path(__file__).with_name('check-prose.py'))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)


def hits(text: str) -> list[str]:
    with tempfile.NamedTemporaryFile('w', suffix='.md', dir=cp.ROOT, delete=False) as f:
        f.write(text)
    path = pathlib.Path(f.name)
    try:
        return [h.split(': ')[1] for h in cp.check([path])]
    finally:
        path.unlink()


class CheckProse(unittest.TestCase):
    def test_flags_dashes(self):
        self.assertEqual(hits('Setup is quick — five minutes.\n'), ['dash'])
        self.assertEqual(hits('Mon–Fri\n'), ['dash'])

    def test_flags_contrasts(self):
        self.assertEqual(hits("It's not a calendar, it's a hub.\n"), ['contrast'])
        self.assertEqual(hits('It syncs, not just reads.\n'), ['contrast'])
        self.assertEqual(hits('Shown rather than hidden.\n'), ['contrast'])

    def test_flags_hype_words(self):
        self.assertEqual(hits('A seamless setup.\n'), ['hype word'])

    def test_flags_two_word_sentences(self):
        self.assertEqual(hits('Points add up over a month. Slow burn. Then a prize.\n'), ['two-word sentence'])

    def test_leaves_plain_prose_alone(self):
        self.assertEqual(hits('Open Settings and choose a calendar. It syncs every 15 minutes.\n'), [])

    def test_two_word_list_labels_and_abbreviations_pass(self):
        self.assertEqual(hits('- Point cost.\n- Parent vs. child roles.\n'), [])

    def test_skips_code(self):
        self.assertEqual(hits('```\necho a — b\n```\nUse `a -- b` here.\n'), [])

    def test_skips_comments_and_front_matter(self):
        self.assertEqual(hits('---\ntitle: A — B\n---\n<!-- not just this -->\nPlain text goes here.\n'), [])


if __name__ == '__main__':
    unittest.main()
