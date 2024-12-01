import requests
rainbow = requests.get("https://github.com/holoviz/colorcet/raw/refs/heads/main/assets/CET/rainbow_bgyrm_35-85_c69_n256.csv").text.strip()

lines = rainbow.split("\n")
colors = [
  f"rgb({",".join(str(int(256*float(c))) for c in l.split(","))})"
  for l in lines[::(len(lines)//32)]
]
print(f"linear-gradient({
  ", ".join(colors)
})")
