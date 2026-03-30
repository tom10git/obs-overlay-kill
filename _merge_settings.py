# One-shot: merge split streamer tab panels in OverlaySettings.tsx
path = r"c:\coding\obs-overlay-kill\src\components\settings\OverlaySettings.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# After retry section: insert second-panel content (inner sections + close) from old block
# Old block: lines 2917-2918 open duplicate panel; we take 2918..3662 (inner + panel close + streamer close)
tail = lines[2918:3663]  # index 2918 .. 3662 inclusive
middle = lines[1790:2915]  # user tab: 1791 .. 2915 (blank before 2nd streamer)
rest = lines[3663:]
out = lines[:1790] + tail + middle + rest

with open(path, "w", encoding="utf-8") as f:
    f.writelines(out)
print("merged lines:", len(lines), "->", len(out))
