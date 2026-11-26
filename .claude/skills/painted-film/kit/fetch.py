"""Public-domain paintings from Wikimedia Commons.
  python3 fetch.py --search "Vermeer milkmaid"            list file titles
  python3 fetch.py out.jpg "File:Exact title.jpg" [3840]  download at a standard width (1920 default; 3840 for crops)
Commons refuses odd thumbnail widths with 429: use 1920 or 3840. Wait a few seconds between files."""
import json, sys, time, urllib.parse, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (painted-film kit)"}
def get(url):
    for a in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
            if r: return r
        except Exception as e: print("  wait:", e); time.sleep(10 * (a + 1))
    raise SystemExit("gave up: " + url)
def api(**q): q["format"] = "json"; return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)))
if sys.argv[1] == "--search":
    for h in api(action="query", list="search", srsearch=sys.argv[2], srnamespace=6, srlimit=10)["query"]["search"]: print(h["title"])
else:
    out, title, width = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1920
    info = list(api(action="query", titles=title, prop="imageinfo", iiprop="url|size", iiurlwidth=width)["query"]["pages"].values())[0]["imageinfo"][0]
    time.sleep(3); open(out, "wb").write(get(info.get("thumburl") or info["url"]))
    print(out, "<-", title, f"(original {info['width']}x{info['height']})", info["descriptionurl"])
