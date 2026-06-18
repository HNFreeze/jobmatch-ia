# -*- coding: utf-8 -*-
"""Reproducible, offline evaluation of JobMatch IA's matching and agent logic.

Run with:  python -m app.evaluation.run

Everything here is deterministic and runs without a database or the Claude API:
it exercises the real scoring, skill-extraction, seniority-inference and
natural-language interpretation code paths against a versioned, anonymised
fixture dataset. This is the objective, repeatable evaluation expected of an
AI-focused TFM.
"""
