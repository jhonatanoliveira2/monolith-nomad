#!/usr/bin/env python3
"""Tests for the JSON translation API's routing. No Bergamot, no network.

    python3 install/nomad-translate/test_api.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("MODELS", "/nonexistent")

import proxy  # noqa: E402

PAIRS = {"enpt", "pten", "enes", "esen", "ende"}


class PlanRoute(unittest.TestCase):
    def test_direct(self):
        self.assertEqual(proxy.plan_route("en", "pt", PAIRS), ["enpt"])
        self.assertEqual(proxy.plan_route("pt", "en", PAIRS), ["pten"])

    def test_pivot_through_english(self):
        self.assertEqual(proxy.plan_route("es", "pt", PAIRS), ["esen", "enpt"])

    def test_missing_direction(self):
        # German -> Portuguese needs deen, which is not on disk
        self.assertIsNone(proxy.plan_route("de", "pt", PAIRS))
        self.assertIsNone(proxy.plan_route("en", "fr", PAIRS))

    def test_same_language_is_a_no_op(self):
        self.assertEqual(proxy.plan_route("pt", "pt", PAIRS), [])

    def test_no_models_dir(self):
        self.assertEqual(proxy.available_pairs(), set())


if __name__ == "__main__":
    unittest.main()
