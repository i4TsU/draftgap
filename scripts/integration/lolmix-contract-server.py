"""Serve the real LoLMix HTTP/export stack with synthetic, offline analysis."""

from __future__ import annotations

import argparse
import json
import sys
import threading

from lolmix import server
from lolmix.core import analyze, export
from lolmix.core.types import CombinedEntry, CombinedReport, Entry


class Catalog:
    champions = {157: "Yasuo", 122: "Darius", 238: "Zed", 121: "Kha'Zix"}

    def has_champion_key(self, key: int) -> bool:
        return key in self.champions

    def champion_name(self, key: int) -> str:
        return self.champions[key]


def entry(entry_id: int, section: str, name: str) -> CombinedEntry:
    return CombinedEntry(
        id=entry_id,
        name=name,
        section=section,
        score=0.034,
        overall_wr=0.512,
        overall_pr=0.42,
        overall_delta=0.012,
        overall_n=1200,
        combined_wr=0.527,
        combined_pr=0.433,
        context_wr=0.541,
        context_delta=0.029,
        context_pr=0.39,
        context_coverage=0.67,
        min_delta=-0.02,
        max_delta=0.04,
        total_n_max=1600,
        per_matchup={
            "lane": Entry(4, "Flash + Ignite", 0.55, 0.4, 0.03, 0.01, 800),
            "jungle": None,
        },
    )


def synthetic_analysis(*_args, **_kwargs):
    rune_key = (
        "rune_page:v2;kind={kind};pri_path=1;sec_path=0;"
        "primary=8112_8139_8140_8106;secondary=9105_8017;shards=5008_5008_5001"
    )
    report = CombinedReport(
        sections={
            "summoners": [entry(4, "summoners", "Flash + Ignite")],
            "rune_page": [
                entry(1, "rune_page", rune_key.format(kind="pick")),
                entry(2, "rune_page", rune_key.format(kind="win")),
                entry(3, "rune_page", rune_key.format(kind="optimal")),
            ],
            "keystones": [entry(8112, "keystones", "Electrocute")],
            "winning_items": [entry(3031, "winning_items", "Infinity Edge")],
        }
    )
    failures = [
        analyze.FailedFetch(
            "jungle", "Kha'Zix", ValueError("synthetic matchup unavailable")
        )
    ]
    return report, failures, {}, {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema-version", type=int, default=export.SCHEMA_VERSION)
    args = parser.parse_args()
    # A second instance tests the consumer's handling of a future API schema.
    export.SCHEMA_VERSION = args.schema_version
    httpd = server.create_server(
        "127.0.0.1", 0, catalog=Catalog(), analyze_fn=synthetic_analysis
    )
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        print(json.dumps({"host": "127.0.0.1", "port": httpd.server_port}), flush=True)
        # The owning Bun test closes this pipe to stop only its own server.
        sys.stdin.readline()
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
