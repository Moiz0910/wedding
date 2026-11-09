"""Reads the 3 CSVs exported from Access and writes one encrypted file per invitation into /data.
Usage: python tools/build.py [folder_with_csvs]     (needs: pip install cryptography)"""
import csv, json, os, sys, hashlib, secrets, base64
from datetime import datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I
src = sys.argv[1] if len(sys.argv) > 1 else "access-export"
rd = lambda n: list(csv.DictReader(open(f"{src}/{n}.csv", encoding="utf-8-sig")))
b64 = lambda b: base64.b64encode(b).decode()

def iso_date(s):
    """Accepts 2026-12-11, 11/12/2026 (day first), 11 December 2026, Friday, 11 December 2026."""
    s = s.strip()
    for cand in (s, s.split(" ")[0]):
        for f in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y", "%A, %d %B %Y", "%d %b %Y", "%A, %d %b %Y"):
            try: return datetime.strptime(cand, f).strftime("%Y-%m-%d")
            except ValueError: pass
    sys.exit(f"Cannot read EventDate '{s}'. Use e.g. 2026-12-11 or 11/12/2026 (day first).")

events = {e["EventID"]: e for e in rd("Events")}
guests = {}
for g in rd("Guests"):
    guests.setdefault(g["InvitationID"], []).append(g["GuestName"].strip())

old = {}
if os.path.exists("codes.csv"):
    old = {r["InvitationID"]: r["InviteCode"] for r in csv.DictReader(open("codes.csv", encoding="utf-8"))}

os.makedirs("data", exist_ok=True)
for f in os.listdir("data"):
    if f.endswith(".json"): os.remove(f"data/{f}")

used, out = set(), []
for r in rd("Invitations"):
    iid = r["InvitationID"]
    code = "".join(c for c in (r.get("InviteCode") or old.get(iid, "")).upper() if c.isalnum())
    while not code or code in used:
        code = "".join(secrets.choice(ALPHA) for _ in range(8))
    if len(code) != 8: sys.exit(f"Code for invitation {iid} must be 8 characters: {code}")
    used.add(code)
    e = events[r["EventID"]]
    payload = {"family": r["FamilyName"], "guests": guests.get(iid, []),
               "event": {"name": e["EventName"], "date": e["EventDate"], "dateISO": iso_date(e["EventDate"]), "time": e["EventTime"], "venue": e["Venue"],
                         "address": e["Address"], "mapUrl": e["MapUrl"], "dressCode": e["DressCode"], "notes": e["Notes"]}}
    salt, iv = os.urandom(16), os.urandom(12)
    key = hashlib.pbkdf2_hmac("sha256", code.encode(), salt, 200000, 32)
    ct = AESGCM(key).encrypt(iv, json.dumps(payload).encode(), None)
    name = hashlib.sha256(code.encode()).hexdigest()[:32]
    json.dump({"salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}, open(f"data/{name}.json", "w"))
    out.append({"InvitationID": iid, "FamilyName": r["FamilyName"], "InviteCode": f"{code[:4]}-{code[4:]}"})

with open("codes.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["InvitationID", "FamilyName", "InviteCode"]); w.writeheader(); w.writerows(out)
print(f"Built {len(out)} invitations. Codes saved to codes.csv (keep this file private).")
