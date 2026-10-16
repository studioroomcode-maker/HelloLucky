"""
Hard negatives for the luck detector: real photos of three-leaf lookalikes (clover, wood sorrel,
medick) with NO four-leaf clover, from iNaturalist research-grade observations.

Only commercially usable licenses (CC0 / CC-BY / CC-BY-SA); credits go to <out>/credits.csv.
Observations whose text mentions a four-leaf are skipped (a stray one would teach "not luck").

Usage: python training/fetch_negatives.py --per-taxon 300
  → clover_dataset/negatives_inat/*.jpg  (train_local.py adds them with empty labels;
    every 7th image goes to clover_dataset/negatives_holdout/ for the false-positive check)
"""
import argparse
import csv
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent / "clover_dataset"
TAXA = ["Trifolium repens", "Trifolium pratense", "Trifolium dubium", "Oxalis corniculata", "Oxalis stricta", "Medicago lupulina"]
LICENSES = "cc0,cc-by,cc-by-sa"
FOUR = re.compile(r"four|4[\s-]*leaf|quatre|vier|네잎|四つ葉|四叶", re.I)


def observations(taxon: str, want: int):
    page, got = 1, 0
    while got < want:
        r = requests.get("https://api.inaturalist.org/v1/observations", timeout=20, params={
            "taxon_name": taxon, "photos": "true", "quality_grade": "research", "photo_license": LICENSES,
            "per_page": 100, "page": page, "order_by": "id",
        })
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return
        for obs in results:
            text = " ".join(str(obs.get(k) or "") for k in ("description", "species_guess"))
            text += " ".join(t.get("tag", "") if isinstance(t, dict) else str(t) for t in obs.get("tags") or [])
            if FOUR.search(text):
                continue
            photo = next((p for p in obs.get("photos", []) if (p.get("license_code") or "") in LICENSES.split(",")), None)
            if photo:
                got += 1
                yield obs, photo
                if got >= want:
                    return
        page += 1
        time.sleep(1.1)  # iNaturalist asks for <= 60 requests/minute


def download(job):
    url, path = job
    if path.exists():
        return True
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200 and len(r.content) > 5000:
            path.write_bytes(r.content)
            return True
    except requests.RequestException:
        pass
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-taxon", type=int, default=300)
    args = ap.parse_args()
    train_dir, hold_dir = ROOT / "negatives_inat", ROOT / "negatives_holdout"
    train_dir.mkdir(parents=True, exist_ok=True)
    hold_dir.mkdir(parents=True, exist_ok=True)

    jobs, credits, n = [], [], 0
    for taxon in TAXA:
        before = len(jobs)
        for obs, photo in observations(taxon, args.per_taxon):
            n += 1
            name = f"inat_{photo['id']}.jpg"
            dest = (hold_dir if n % 7 == 0 else train_dir) / name
            jobs.append((photo["url"].replace("square", "large"), dest))
            credits.append([name, taxon, photo.get("attribution", ""), photo["license_code"], f"https://www.inaturalist.org/observations/{obs['id']}"])
        print(f"{taxon}: {len(jobs) - before}")

    with ThreadPoolExecutor(6) as pool:
        ok = sum(pool.map(download, jobs))
    with open(ROOT / "negatives_credits.csv", "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([["file", "taxon", "attribution", "license", "source"], *credits])
    print(f"✅ {ok}/{len(jobs)} downloaded → {train_dir.name} / {hold_dir.name}")


if __name__ == "__main__":
    main()
