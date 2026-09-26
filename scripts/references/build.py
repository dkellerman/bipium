"""Research-only reference corpus: public style pages and CC BY Groove MIDI beats.

Retrieval ranks source text with character n-gram TF-IDF. It does not choose
musical settings. All interpretation of a request is left to Jev.
"""
from __future__ import annotations

import collections
import concurrent.futures
import csv
import io
import json
import math
import re
import sqlite3
import sys
import time
import zipfile
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2] / "data"
DB = ROOT / "reference-patterns.sqlite"
ZIP = ROOT / "groove-v1.0.0-midionly.zip"

import mido


def ngrams(text: str) -> collections.Counter[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    stop = {"a", "an", "the", "me", "my", "i", "give", "make", "beat", "groove", "pattern", "with", "and", "at", "in", "for", "some", "something", "please", "want", "to", "of", "it"}
    out = collections.Counter()
    for word in words:
        if word in stop:
            continue
        out["w:" + word] += 2
        padded = f" {word} "
        for n in (3, 4):
            for i in range(len(padded) - n + 1):
                out[f"c:{padded[i:i+n]}"] += 1
    return out


def canon(word: str) -> str:
    return word[:-1] if len(word) > 4 and word.endswith("y") else word


def thump_links():
    html = requests.get("https://aphelion.music/thump", timeout=20).text
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    for a in soup.select('a[href^="/thump/"]'):
        url = "https://aphelion.music" + a["href"].split("?")[0]
        links.add(url)
    return sorted(links)


def thump_entry(url: str):
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    archive = ROOT / "thump-pages"
    archive.mkdir(exist_ok=True)
    (archive / (url.rstrip("/").split("/")[-1] + ".html")).write_text(r.text)
    soup = BeautifulSoup(r.text, "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    title = h1.get_text(" ", strip=True)
    subtitle = h1.find_next("p")
    subtitle = subtitle.get_text(" ", strip=True) if subtitle else ""
    alltext = soup.get_text(" ", strip=True)
    bpm = re.search(r"\b\d{2,3}\s*[-–]\s*\d{2,3}\s*bpm", alltext, re.I)
    heading = next((h for h in soup.find_all("h2") if h.get_text(" ", strip=True).lower() == "the pattern"), None)
    parts = []
    if heading:
        for sib in heading.next_siblings:
            if getattr(sib, "name", None) == "h2":
                break
            if getattr(sib, "name", None) == "p":
                parts.append(sib.get_text(" ", strip=True))
    paragraph = " ".join(parts[1:3] if len(parts) > 1 else parts)[:850]
    guide = f"{title}. {subtitle} Tempo range: {bpm.group(0) if bpm else 'not stated'}. Source pattern notes: {paragraph}"
    pattern = {"kick":set(),"snare":set(),"hat":set()}
    for pad in soup.select("span[data-voice][title]"):
        voice = pad.get("data-voice")
        lane = voice if voice in ("kick","snare") else "hat" if voice in ("closed","open") else None
        step_match = re.search(r"\bstep\s+(\d+)\b",pad.get("title",""),re.I)
        if lane and step_match:
            step = int(step_match.group(1))-1
            if 0 <= step < 16:
                pattern[lane].add(step)
    pattern = {lane:sorted(steps) for lane,steps in pattern.items()}
    return {"source": "Thump", "title": title, "url": url, "guide": guide, "search": f"{title} {title} {title} {subtitle} {paragraph}","pattern":pattern}


PITCH = {36: "kick", 38: "snare", 40: "snare", 37: "snare", 42: "hat", 22: "hat", 46: "hat", 26: "hat", 44: "hat", 51: "hat", 59: "hat", 53: "hat"}


def groove_entry(z, row):
    if row["time_signature"] != "4-4" or row["beat_type"] != "beat":
        return None
    path = "groove/" + row["midi_filename"]
    mid = mido.MidiFile(file=io.BytesIO(z.read(path)))
    bars = collections.defaultdict(lambda:{"kick":set(),"snare":set(),"hat":set()})
    tick = 0
    for track in mid.tracks:
        tick = 0
        for msg in track:
            tick += msg.time
            if msg.type != "note_on" or msg.velocity == 0 or msg.note not in PITCH:
                continue
            beats = tick / mid.ticks_per_beat
            if beats >= 256:
                continue
            bar = int(beats // 4)
            step = round((beats - bar*4) * 4)
            if 0 <= step < 16:
                bars[bar][PITCH[msg.note]].add(step)
    candidates = [(bar,pos) for bar,pos in sorted(bars.items()) if pos["kick"] and pos["snare"] and len(pos["hat"])>=2]
    if not candidates:
        return None
    bar, pos = candidates[0]
    genre, _, substyle = row["style"].partition("/")
    hits = "; ".join(f"{k} steps {','.join(str(x) for x in sorted(v)) or 'none'}" for k, v in pos.items())
    guide = f"Recorded {genre} {substyle} beat at {row['bpm']} BPM, 4/4. Played bar {bar+1}, quantized to 16 steps (0=beat 1, 4=beat 2, 8=beat 3, 12=beat 4; hat includes ride cymbal): {hits}. Human performance, not a genre rule."
    return {"source": "GMD", "title": f"{genre}/{substyle} {row['bpm']} BPM", "url": "https://magenta.tensorflow.org/datasets/groove", "guide": guide, "search": f"{genre} {genre} {genre} {substyle} {row['bpm']} bpm recorded drum groove","pattern":{lane:sorted(steps) for lane,steps in pos.items()}}


def build():
    t = time.perf_counter()
    ROOT.mkdir(exist_ok=True)
    download = requests.get("https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip", timeout=120)
    download.raise_for_status()
    ZIP.write_bytes(download.content)
    links = thump_links()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        thump = [x for x in pool.map(thump_entry, links) if x]
    with zipfile.ZipFile(ZIP) as z:
        rows = list(csv.DictReader(io.TextIOWrapper(z.open("groove/info.csv"), encoding="utf-8")))
        groove = [x for row in rows if (x := groove_entry(z, row))]
    docs = thump + groove
    counts = [ngrams(x["search"]) for x in docs]
    df = collections.Counter(k for c in counts for k in c)
    idf = {k: math.log((len(docs) + 1) / (n + 1)) + 1 for k, n in df.items()}
    with sqlite3.connect(DB) as db:
        db.execute("drop table if exists refs")
        db.execute("create table refs (id integer primary key, source text, title text, url text, guide text, search text, vector text, pattern text)")
        for doc, counts_ in zip(docs, counts):
            v = {k: (1 + math.log(n)) * idf[k] for k, n in counts_.items()}
            norm = math.sqrt(sum(x*x for x in v.values()))
            v = {k: x/norm for k, x in v.items()}
            db.execute("insert into refs(source,title,url,guide,search,vector,pattern) values(?,?,?,?,?,?,?)", (doc["source"], doc["title"], doc["url"], doc["guide"], doc["search"], json.dumps(v, separators=(",", ":")),json.dumps(doc["pattern"],separators=(",", ":"))))
        db.commit()
    (ROOT / "reference-idf.json").write_text(json.dumps(idf, separators=(",", ":")))
    with sqlite3.connect(DB) as db:
        db.row_factory = sqlite3.Row
        exported = []
        for row in db.execute("select * from refs"):
            item = dict(row)
            for key in ("vector", "pattern"):
                item[key] = json.loads(item[key])
            exported.append(item)
    (ROOT.parent / "server/reference-index.json").write_text(json.dumps({"idf": idf, "refs": exported}, separators=(",", ":")))
    print(json.dumps({"thump": len(thump), "gmd": len(groove), "total": len(docs), "build_s": round(time.perf_counter()-t, 2), "db": str(DB)}))


def lookup(request: str, per_source=2):
    start = time.perf_counter()
    idf = json.loads((ROOT / "reference-idf.json").read_text())
    count = ngrams(request)
    q = {k: (1+math.log(n))*idf[k] for k,n in count.items() if k in idf}
    qnorm = math.sqrt(sum(x*x for x in q.values())) or 1
    q = {k: x/qnorm for k,x in q.items()}
    request_words = [canon(w) for w in re.findall(r"[a-z0-9]+", request.lower())]
    query_words = [w for w in request_words if w not in {"a","an","the","me","my","i","give","make","beat","groove","pattern","with","and","at","in","for","some","something","please","want","to","of","it","bpm","tempo","mid","slow","fast","little","slight","straight","no","only","drum","metronome","plain"} and not w.isdigit()]
    tempo_match = re.search(r"\b(\d{2,3})\s*bpm\b|\b(?:at|around|about)\s+(\d{2,3})\b", request.lower())
    tempo = int(tempo_match.group(1) or tempo_match.group(2)) if tempo_match else None
    by_source = collections.defaultdict(list)
    with sqlite3.connect(DB) as db:
        for ident, source, title, url, guide, vec, pattern in db.execute("select id,source,title,url,guide,vector,pattern from refs"):
            v = json.loads(vec)
            vector_score = sum(weight * v.get(k,0) for k,weight in q.items())
            if source == "GMD":
                style = title.split(" ")[0]
                primary, _, secondary = style.partition("/")
                labels = [(canon(primary), 2.0)] + [(canon(w), 1.0) for w in re.findall(r"[a-z0-9]+", secondary) if len(w)>2]
            else:
                labels = [(canon(w), 1.0) for w in re.findall(r"[a-z0-9]+", title.lower()) if len(w)>2]
            matches = [max((weight for label,weight in labels if w==label),default=0) for w in query_words]
            score = sum(matches)/(math.sqrt(len(labels)) if source == "Thump" and labels else 1)
            title_words = [canon(w) for w in re.findall(r"[a-z0-9]+",title.lower())]
            if source == "Thump" and title_words and any(request_words[i:i+len(title_words)]==title_words for i in range(len(request_words)-len(title_words)+1)):
                score += 2
            if score < 0.65:
                continue
            if source == "GMD" and secondary and any(canon(w) in query_words for w in re.findall(r"[a-z0-9]+", secondary)):
                score += 2
            if source == "GMD" and tempo is not None:
                doc_tempo = int(title.rsplit(" ",2)[1])
                if abs(doc_tempo-tempo)>40:
                    continue
                score += max(0, 1-abs(doc_tempo-tempo)/40)
            by_source[source].append((score+vector_score*0.01, {"id":ident,"source":source,"title":title,"url":url,"guide":guide,"pattern":json.loads(pattern)}))
    selected=[]
    if by_source["Thump"] and by_source["GMD"]:
        best_thump = max(by_source["Thump"],key=lambda t:t[0])[1]["title"]
        anchor = [canon(w) for w in re.findall(r"[a-z0-9]+",best_thump.lower()) if len(w)>3]
        reranked=[]
        for score,doc in by_source["GMD"]:
            style_words = [canon(w) for w in re.findall(r"[a-z0-9]+",doc["title"].split(" ")[0].lower())]
            if any(a==w for a in anchor for w in style_words):
                score += 3
                reranked.append((score,doc))
        by_source["GMD"] = reranked
    for source in ("Thump","GMD"):
        ranked = sorted(by_source[source], key=lambda t: -t[0])
        if source == "GMD":
            seen = set()
            for _, x in ranked:
                if x["title"] in seen:
                    continue
                selected.append(x)
                seen.add(x["title"])
                if len(seen) == per_source:
                    break
        else:
            selected.extend(x for _,x in ranked[:per_source])
    return selected, time.perf_counter()-start


if __name__ == "__main__":
    build()
